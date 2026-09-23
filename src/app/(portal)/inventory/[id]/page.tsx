import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Archive, ArchiveRestore } from 'lucide-react';

import { canManageStock, requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { PURCHASE_OPEN_STATUSES } from '@/lib/constants';
import { formatDate, formatDateTime, formatPrice, percent, relativeTime } from '@/lib/utils';
import { setPartActive } from '@/actions/inventory';

import { Card, CardBody, CardHeader, EmptyState } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Stat } from '@/components/ui/stat';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { ActionForm } from '@/components/ui/action-form';
import {
  BillingChip,
  PartCategoryChip,
  PurchaseStatusChip,
  StockBadge,
  StockMoveChip,
} from '@/components/status-chips';
import { PartForm } from '@/components/inventory/part-form';
import { StockAdjustForm } from '@/components/inventory/stock-adjust-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const part = await db.part.findUnique({ where: { id }, select: { name: true } });
  return { title: part?.name ?? 'Part' };
}

export default async function PartPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const manage = canManageStock(user);
  const { id } = await params;

  const part = await db.part.findUnique({
    where: { id },
    include: {
      stockMoves: {
        orderBy: { createdAt: 'desc' },
        take: 40,
        include: { user: { select: { name: true, avatarTone: true } } },
      },
      bomLines: { include: { product: { select: { id: true, name: true, code: true } } } },
      purchaseLines: {
        where: { purchaseOrder: { status: { in: [...PURCHASE_OPEN_STATUSES] } } },
        include: { purchaseOrder: { select: { id: true, ref: true, status: true, expectedAt: true, supplier: true } } },
      },
      partsOrderLines: {
        orderBy: { partsOrder: { placedAt: 'desc' } },
        take: 10,
        include: {
          partsOrder: {
            select: { id: true, ref: true, billing: true, placedAt: true, status: true, customer: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!part) notFound();

  const suppliers = manage
    ? (
        await db.part.findMany({
          where: { supplier: { not: null } },
          distinct: ['supplier'],
          select: { supplier: true },
        })
      ).map((s) => s.supplier!)
    : [];

  const onOrder = part.purchaseLines.reduce((s, l) => s + l.qty, 0);
  const margin = part.unitPrice > 0 ? percent(part.unitPrice - part.unitCost, part.unitPrice) : null;
  const sold90 = await db.stockMove.aggregate({
    where: { partId: part.id, reason: 'PICKED', createdAt: { gte: new Date(Date.now() - 90 * 864e5) } },
    _sum: { change: true },
  });
  const pickedLately = Math.abs(sold90._sum.change ?? 0);

  return (
    <>
      <Link href="/inventory" className="inline-flex items-center gap-1.5 text-xs text-slate transition-colors hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to inventory
      </Link>

      <PageHeader
        eyebrow={part.sku}
        title={part.name}
        description={[part.supplier, part.location ? `Bay ${part.location}` : null].filter(Boolean).join(' · ') || undefined}
        actions={
          manage ? (
            <ActionForm action={setPartActive} fields={{ partId: part.id, active: String(!part.isActive) }}>
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-2 rounded-brand border border-stone bg-white px-3 text-xs font-medium text-slate transition-colors hover:bg-sand hover:text-ink"
              >
                {part.isActive ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                {part.isActive ? 'Retire part' : 'Bring back into use'}
              </button>
            </ActionForm>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <PartCategoryChip value={part.category} size="md" dot={false} />
        <StockBadge qty={part.stockQty} reorderLevel={part.reorderLevel} />
        {!part.isActive && <Badge tone="slate">Retired — cannot be ordered</Badge>}
        {part.notes && <span className="text-xs text-slate">{part.notes}</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="On the shelf"
          value={part.stockQty}
          sub={`Reorder at ${part.reorderLevel}, buy ${part.reorderQty} at a time`}
          tone={part.stockQty <= 0 ? 'clay' : part.stockQty <= part.reorderLevel ? 'amber' : 'moss'}
        />
        <Stat
          label="On order"
          value={onOrder}
          sub={onOrder ? `Expected ${formatDate(part.purchaseLines[0]?.purchaseOrder.expectedAt)}` : `${part.leadTimeDays} day lead time`}
          tone="sky"
        />
        <Stat
          label="Selling price"
          value={formatPrice(part.unitPrice)}
          sub={`Cost ${formatPrice(part.unitCost)}${margin === null ? '' : ` · ${margin}% margin`}`}
          tone="ember"
        />
        <Stat
          label="Picked, last 90 days"
          value={pickedLately}
          sub="Units sent out to customers"
          tone="slate"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {manage ? (
            <Card>
              <CardHeader eyebrow="Catalogue" title="Details and prices" description="Price changes apply to new orders only — placed orders keep the price they were quoted." />
              <CardBody>
                <PartForm
                  suppliers={suppliers}
                  part={{
                    id: part.id,
                    sku: part.sku,
                    name: part.name,
                    category: part.category,
                    unitCost: part.unitCost,
                    unitPrice: part.unitPrice,
                    reorderLevel: part.reorderLevel,
                    reorderQty: part.reorderQty,
                    leadTimeDays: part.leadTimeDays,
                    supplier: part.supplier,
                    location: part.location,
                    notes: part.notes,
                  }}
                />
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              eyebrow={`Last ${part.stockMoves.length} movements`}
              title="Stock ledger"
              description="Every change to the level on the shelf, newest first, with who made it and why."
            />
            {part.stockMoves.length ? (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>What</th>
                      <th className="text-right">Change</th>
                      <th className="text-right">Balance</th>
                      <th className="hidden md:table-cell">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {part.stockMoves.map((m) => (
                      <tr key={m.id}>
                        <td className="whitespace-nowrap text-2xs text-slate" title={formatDateTime(m.createdAt)}>
                          {relativeTime(m.createdAt)}
                        </td>
                        <td>
                          <StockMoveChip value={m.reason} dot={false} />
                          {(m.ref || m.note) && (
                            <p className="mt-1 text-2xs text-slate">
                              {m.ref && <span className="font-mono">{m.ref}</span>}
                              {m.ref && m.note ? ' · ' : ''}
                              {m.note}
                            </p>
                          )}
                        </td>
                        <td className={`text-right text-sm font-medium tabular-nums ${m.change > 0 ? 'text-moss' : 'text-clay'}`}>
                          {m.change > 0 ? `+${m.change}` : m.change}
                        </td>
                        <td className="text-right text-sm tabular-nums text-ink">{m.balance}</td>
                        <td className="hidden md:table-cell">
                          {m.user ? (
                            <span className="inline-flex items-center gap-1.5 text-2xs text-slate">
                              <Avatar name={m.user.name} tone={m.user.avatarTone} size="xs" />
                              {m.user.name}
                            </span>
                          ) : (
                            <span className="text-2xs text-slate">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No movements yet" description="Stock changes will be listed here as they happen." />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {manage && (
            <Card>
              <CardHeader eyebrow="Stock control" title="Correct the stock level" description={`Currently ${part.stockQty} on the shelf.`} />
              <CardBody>
                <StockAdjustForm partId={part.id} current={part.stockQty} />
              </CardBody>
            </Card>
          )}

          {part.purchaseLines.length > 0 && (
            <Card>
              <CardHeader eyebrow="Coming in" title="On order from the supplier" />
              <ul className="divide-y divide-stone/60">
                {part.purchaseLines.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <Link href={`/inventory/purchasing/${l.purchaseOrder.id}`} className="min-w-0 hover:text-ember-dark">
                      <span className="font-mono text-2xs text-slate">{l.purchaseOrder.ref}</span>
                      <span className="block text-xs text-ink">
                        {l.qty} from {l.purchaseOrder.supplier}
                        {l.purchaseOrder.expectedAt ? ` · due ${formatDate(l.purchaseOrder.expectedAt)}` : ''}
                      </span>
                    </Link>
                    <PurchaseStatusChip value={l.purchaseOrder.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader eyebrow="Bills of materials" title="Used in" />
            {part.bomLines.length ? (
              <ul className="divide-y divide-stone/60">
                {part.bomLines.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <Link href={`/inventory/bom/${l.product.id}`} className="min-w-0 text-xs font-medium text-ink hover:text-ember-dark">
                      {l.product.name}
                      <span className="block font-mono text-2xs font-normal text-slate">{l.product.code}</span>
                    </Link>
                    <span className="text-xs tabular-nums text-slate">{l.qty} per pergola</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Not in any bill of materials" description="Standalone spare or accessory." />
            )}
          </Card>

          <Card>
            <CardHeader eyebrow="Recent" title="Ordered for customers" />
            {part.partsOrderLines.length ? (
              <ul className="divide-y divide-stone/60">
                {part.partsOrderLines.map((l) => (
                  <li key={l.id} className="px-5 py-3">
                    <Link href={`/parts-orders/${l.partsOrder.id}`} className="group block">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-2xs text-slate">{l.partsOrder.ref}</span>
                        <BillingChip value={l.partsOrder.billing} dot={false} />
                      </div>
                      <p className="mt-0.5 text-xs text-ink group-hover:text-ember-dark">
                        {l.qty} × for {l.partsOrder.customer.name}
                        {l.partsOrder.status === 'CANCELLED' ? ' (cancelled)' : ''}
                      </p>
                      <p className="text-2xs text-slate">{relativeTime(l.partsOrder.placedAt)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Not ordered yet" description="No parts orders include this part." />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
