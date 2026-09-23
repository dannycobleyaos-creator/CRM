import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { CalendarClock, ClipboardList, PoundSterling, Truck } from 'lucide-react';

import { canManageStock, requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { PURCHASE_OPEN_STATUSES } from '@/lib/constants';
import { formatDate, formatMoney, formatPrice, isOverdue, relativeTime } from '@/lib/utils';

import { Card, CardHeader, EmptyState } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Stat } from '@/components/ui/stat';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { Badge } from '@/components/ui/badge';
import { PurchaseStatusChip } from '@/components/status-chips';
import { InventoryNav } from '@/components/inventory/inventory-nav';
import { NewPurchaseOrderForm } from '@/components/inventory/new-purchase-order-form';

export const metadata: Metadata = { title: 'Purchasing' };
export const dynamic = 'force-dynamic';

export default async function PurchasingPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requireUser();
  const manage = canManageStock(user);
  const { view = 'open' } = await searchParams;

  const where: Prisma.PurchaseOrderWhereInput =
    view === 'open'
      ? { status: { in: [...PURCHASE_OPEN_STATUSES] } }
      : view === 'received'
        ? { status: 'RECEIVED' }
        : view === 'cancelled'
          ? { status: 'CANCELLED' }
          : {};

  const [orders, openOrders, parts] = await Promise.all([
    db.purchaseOrder.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        lines: { include: { part: { select: { name: true } } } },
        createdBy: { select: { name: true } },
      },
    }),
    db.purchaseOrder.findMany({ where: { status: { in: [...PURCHASE_OPEN_STATUSES] } } }),
    manage
      ? db.part.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: { id: true, sku: true, name: true, supplier: true, unitCost: true, stockQty: true, reorderLevel: true, reorderQty: true },
        })
      : Promise.resolve([]),
  ]);

  const drafts = openOrders.filter((o) => o.status === 'DRAFT').length;
  const sent = openOrders.filter((o) => o.status === 'SENT');
  const late = sent.filter((o) => isOverdue(o.expectedAt)).length;
  const valueOnOrder = sent.reduce((s, o) => s + o.total, 0);
  const lowStock = await db.part.count({ where: { isActive: true, stockQty: { lte: db.part.fields.reorderLevel } } });
  const suppliers = [...new Set(parts.map((p) => p.supplier).filter((s): s is string => !!s))].sort();

  return (
    <>
      <PageHeader
        eyebrow="Warehouse"
        title="Purchasing"
        description="Stock we are buying back in. Receiving a purchase order books it straight onto the shelf through the stock ledger."
      />

      <InventoryNav active="purchasing" lowStock={lowStock} openPurchases={openOrders.length} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Drafts to check" value={drafts} sub="Raised but not yet sent" tone={drafts ? 'amber' : 'moss'} icon={<ClipboardList className="h-4 w-4" />} />
        <Stat label="With suppliers" value={sent.length} sub="Sent and awaiting delivery" tone="sky" icon={<Truck className="h-4 w-4" />} />
        <Stat label="Late" value={late} sub="Past the expected delivery date" tone={late ? 'clay' : 'moss'} icon={<CalendarClock className="h-4 w-4" />} />
        <Stat label="Value on order" value={formatMoney(valueOnOrder)} sub="Sent orders, at cost ex VAT" tone="ember" icon={<PoundSterling className="h-4 w-4" />} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          basePath="/inventory/purchasing"
          paramKey="view"
          active={view}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'received', label: 'Received' },
            { value: 'cancelled', label: 'Cancelled' },
            { value: 'all', label: 'Everything' },
          ]}
        />
        {manage && <NewPurchaseOrderForm parts={parts} suppliers={suppliers} />}
      </div>

      <Card>
        <CardHeader eyebrow={`${orders.length} purchase ${orders.length === 1 ? 'order' : 'orders'}`} title="Purchase orders" />
        {orders.length ? (
          <ul className="divide-y divide-stone/60">
            {orders.map((o) => {
              const lateNow = o.status === 'SENT' && isOverdue(o.expectedAt);
              return (
                <li key={o.id}>
                  <Link href={`/inventory/purchasing/${o.id}`} className="block px-5 py-4 transition-colors hover:bg-sand/40">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-2xs text-slate">{o.ref}</span>
                        <PurchaseStatusChip value={o.status} />
                        {lateNow && <Badge tone="clay" dot>Late</Badge>}
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-ink">{formatPrice(o.total)}</span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-ink">{o.supplier}</p>
                    <p className="mt-0.5 truncate text-2xs text-slate">
                      {o.lines.map((l) => `${l.qty} × ${l.part.name}`).join(' · ')}
                    </p>
                    <p className="mt-1 text-2xs text-slate/80">
                      Raised by {o.createdBy.name} {relativeTime(o.createdAt)}
                      {o.status === 'SENT' && o.expectedAt ? ` · expected ${formatDate(o.expectedAt)}` : ''}
                      {o.status === 'RECEIVED' && o.receivedAt ? ` · received ${formatDate(o.receivedAt)}` : ''}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<Truck className="h-5 w-5" />}
            title="Nothing here"
            description={view === 'open' ? 'No purchase orders are open. Low-stock parts can be reordered from the inventory.' : 'No purchase orders match that view.'}
          />
        )}
      </Card>
    </>
  );
}
