import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { canManageStock, requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { addDays, formatDate, formatPrice } from '@/lib/utils';

import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { PrintButton } from '@/components/ui/print-button';
import { HyggeWordmark } from '@/components/brand/logo';
import { PurchaseStatusChip, StockBadge } from '@/components/status-chips';
import { PurchaseActions } from '@/components/inventory/purchase-actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const po = await db.purchaseOrder.findUnique({ where: { id }, select: { ref: true } });
  return { title: po?.ref ?? 'Purchase order' };
}

export default async function PurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const manage = canManageStock(user);
  const { id } = await params;

  const po = await db.purchaseOrder.findUnique({
    where: { id },
    include: {
      lines: { include: { part: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!po) notFound();

  const lead = Math.max(14, ...po.lines.map((l) => l.part.leadTimeDays));
  const units = po.lines.reduce((s, l) => s + l.qty, 0);

  return (
    <>
      <Link href="/inventory/purchasing" className="inline-flex items-center gap-1.5 text-xs text-slate transition-colors hover:text-ink print:hidden">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to purchasing
      </Link>

      <PageHeader
        eyebrow="Purchase order"
        title={`${po.ref} — ${po.supplier}`}
        className="print:hidden"
        actions={<PrintButton label="Print purchase order" />}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card className="print:border-0 print:shadow-none">
          <CardBody className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <HyggeWordmark subline="Pergola" />
              <div className="text-right">
                <p className="brand-eyebrow">Purchase order</p>
                <p className="mt-1 font-display text-xl font-medium text-ink">{po.ref}</p>
                <div className="mt-1.5 flex justify-end"><PurchaseStatusChip value={po.status} /></div>
              </div>
            </div>

            <div className="grid gap-4 text-xs sm:grid-cols-3">
              <div>
                <p className="brand-eyebrow mb-1">Supplier</p>
                <p className="text-sm text-ink">{po.supplier}</p>
              </div>
              <div>
                <p className="brand-eyebrow mb-1">Raised</p>
                <p className="text-ink">{formatDate(po.createdAt)} by {po.createdBy.name}</p>
                {po.sentAt && <p className="text-slate">Sent {formatDate(po.sentAt)}</p>}
              </div>
              <div>
                <p className="brand-eyebrow mb-1">{po.receivedAt ? 'Received' : 'Expected'}</p>
                <p className="text-ink">{formatDate(po.receivedAt ?? po.expectedAt)}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Part</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Unit cost</th>
                    <th className="text-right">Line total</th>
                    <th className="print:hidden">Stock now</th>
                  </tr>
                </thead>
                <tbody>
                  {po.lines.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <Link href={`/inventory/${l.part.id}`} className="text-sm text-ink hover:text-ember-dark">{l.part.name}</Link>
                        <span className="block font-mono text-2xs text-slate">{l.part.sku}</span>
                      </td>
                      <td className="text-right tabular-nums">{l.qty}</td>
                      <td className="text-right tabular-nums text-slate">{formatPrice(l.unitCost)}</td>
                      <td className="text-right tabular-nums">{formatPrice(l.qty * l.unitCost)}</td>
                      <td className="print:hidden"><StockBadge qty={l.part.stockQty} reorderLevel={l.part.reorderLevel} compact /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="px-4 py-3 text-2xs font-semibold uppercase tracking-brand text-slate">Total ex VAT</td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums text-slate">{units}</td>
                    <td />
                    <td className="px-4 py-3 text-right text-base font-semibold tabular-nums text-ink">{formatPrice(po.total)}</td>
                    <td className="print:hidden" />
                  </tr>
                </tfoot>
              </table>
            </div>

            {po.notes && <p className="rounded-brand bg-sand/60 p-3 text-xs text-slate">{po.notes}</p>}
          </CardBody>
        </Card>

        <div className="space-y-6 print:hidden">
          <Card>
            <CardHeader
              eyebrow="Next step"
              title={po.status === 'DRAFT' ? 'Check and send' : po.status === 'SENT' ? 'When it arrives' : 'Closed'}
              description={
                po.status === 'DRAFT'
                  ? 'Send the order to the supplier, then mark it sent here so everyone can see it is on its way.'
                  : po.status === 'SENT'
                    ? `Receiving adds ${units} items to stock and records it in each part's ledger.`
                    : po.status === 'RECEIVED'
                      ? `Booked into stock on ${formatDate(po.receivedAt)}.`
                      : 'This purchase order was cancelled.'
              }
            />
            {manage && (
              <CardBody>
                <PurchaseActions
                  purchaseOrderId={po.id}
                  status={po.status}
                  defaultExpected={addDays(new Date(), lead).toISOString().slice(0, 10)}
                />
              </CardBody>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
