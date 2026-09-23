import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Check, Circle, CircleCheck, Truck } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { BILLING_META, type BillingType } from '@/lib/constants';
import { cn, formatDate, formatDateTime, formatPrice } from '@/lib/utils';

import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { PrintButton } from '@/components/ui/print-button';
import { Badge } from '@/components/ui/badge';
import { HyggeWordmark } from '@/components/brand/logo';
import {
  BillingChip,
  DispatchStatusChip,
  PaymentChip,
  PriorityChip,
} from '@/components/status-chips';
import { Timeline, timelineSelect } from '@/components/work/timeline';
import { CancelOrderForm, MarkPaidForm } from '@/components/parts-orders/parts-order-actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const order = await db.partsOrder.findUnique({ where: { id }, select: { ref: true } });
  return { title: order?.ref ?? 'Parts order' };
}

const DISPATCH_RANK: Record<string, number> = {
  REQUESTED: 0,
  APPROVED: 1,
  AWAITING_STOCK: 1,
  PICKING: 2,
  DISPATCHED: 3,
  DELIVERED: 4,
};

export default async function PartsOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const { placed } = await searchParams;

  const order = await db.partsOrder.findUnique({
    where: { id },
    include: {
      lines: true,
      customer: true,
      order: { select: { id: true, ref: true, productLine: true } },
      ticket: { select: { id: true, ref: true, subject: true } },
      createdBy: { select: { name: true } },
      dispatch: true,
    },
  });
  if (!order) notFound();

  const activities = await db.activity.findMany({
    where: {
      OR: [{ partsOrderId: order.id }, ...(order.dispatchId ? [{ partRequestId: order.dispatchId }] : [])],
    },
    select: timelineSelect,
    orderBy: { occurredAt: 'desc' },
  });

  const chargeable = order.billing === 'CHARGEABLE';
  const cancelled = order.status === 'CANCELLED';
  const dispatch = order.dispatch;
  const rank = dispatch ? DISPATCH_RANK[dispatch.status] ?? -1 : -1;
  const shipped = dispatch && ['DISPATCHED', 'DELIVERED'].includes(dispatch.status);
  const billingLabel = BILLING_META[order.billing as BillingType]?.label ?? order.billing;

  const steps = [
    { label: 'Order placed', done: true, at: order.placedAt, note: `by ${order.createdBy.name}` },
    ...(chargeable
      ? [{ label: 'Paid', done: order.paymentStatus === 'PAID', at: order.paidAt, note: order.paymentRef ?? undefined }]
      : [{ label: 'Approved', done: rank >= 1, at: null, note: undefined }]),
    { label: 'Picked in the warehouse', done: !!dispatch?.pickedAt || rank >= 3, at: dispatch?.pickedAt ?? null, note: undefined },
    {
      label: 'Dispatched',
      done: rank >= 3,
      at: dispatch?.dispatchedAt ?? null,
      note: dispatch?.trackingRef ? `${dispatch.carrier} · ${dispatch.trackingRef}` : undefined,
    },
    { label: 'Delivered', done: rank >= 4, at: dispatch?.deliveredAt ?? null, note: undefined },
  ];
  const current = steps.findIndex((s) => !s.done);

  const address = [order.shipToName, order.shipToLine1, order.shipToLine2, order.shipToCity, order.shipToPost].filter(Boolean);

  return (
    <>
      <Link href="/parts-orders" className="inline-flex items-center gap-1.5 text-xs text-slate transition-colors hover:text-ink print:hidden">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to parts orders
      </Link>

      <PageHeader
        eyebrow="Parts order"
        title={`${order.ref} — ${order.customer.name}`}
        className="print:hidden"
        actions={<PrintButton label="Print confirmation" />}
      />

      {placed && !cancelled && (
        <div role="status" className="rounded-brand border border-moss/30 bg-moss-soft px-4 py-3 text-sm text-moss print:hidden">
          Order placed. {dispatch ? `Dispatch ${dispatch.ref} is in the warehouse queue` : 'The dispatch has been created'}
          {chargeable && order.paymentStatus === 'AWAITING' ? ', held until it is paid.' : '.'}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <BillingChip value={order.billing} size="md" dot={false} />
        <PaymentChip value={order.paymentStatus} size="md" />
        {dispatch && <DispatchStatusChip value={dispatch.status} size="md" />}
        {dispatch && <PriorityChip value={dispatch.priority} dot={false} />}
        {cancelled && (
          <Badge tone="clay" size="md" dot>
            Cancelled {formatDate(order.cancelledAt)}
          </Badge>
        )}
        {cancelled && order.paymentStatus === 'PAID' && order.total > 0 && (
          <Badge tone="clay" size="md">Refund due {formatPrice(order.total)}</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* The document the customer gets */}
        <Card className="print:border-0 print:shadow-none">
          <CardBody className="space-y-7 p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <HyggeWordmark subline="Pergola" />
              <div className="text-right">
                <p className="brand-eyebrow">{cancelled ? 'Cancelled order' : 'Order confirmation'}</p>
                <p className="mt-1 font-display text-xl font-medium text-ink">{order.ref}</p>
                <p className="mt-0.5 text-xs text-slate">{formatDate(order.placedAt)}</p>
              </div>
            </div>

            <div className="grid gap-5 text-xs sm:grid-cols-3">
              <div>
                <p className="brand-eyebrow mb-1.5">Customer</p>
                <p className="text-sm text-ink">{order.customer.name}</p>
                <p className="text-slate">{order.customer.ref}</p>
                {order.customer.email && <p className="text-slate">{order.customer.email}</p>}
              </div>
              <div>
                <p className="brand-eyebrow mb-1.5">Deliver to</p>
                {address.map((line, i) => (
                  <p key={i} className={i === 0 ? 'text-sm text-ink' : 'text-slate'}>{line}</p>
                ))}
              </div>
              <div>
                <p className="brand-eyebrow mb-1.5">Details</p>
                <p className="text-ink">{billingLabel}</p>
                {order.order && (
                  <p className="text-slate">
                    For {order.order.ref}
                    <span className="block">{order.order.productLine}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Unit price</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <span className="block text-sm text-ink">{l.description}</span>
                        <span className="font-mono text-2xs text-slate">{l.sku}</span>
                      </td>
                      <td className="text-right tabular-nums">{l.qty}</td>
                      <td className="text-right tabular-nums text-slate">{formatPrice(l.unitPrice)}</td>
                      <td className="text-right tabular-nums">{formatPrice(l.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="ml-auto max-w-xs space-y-1.5 text-xs">
              <div className="flex justify-between gap-6">
                <dt className="text-slate">Subtotal</dt>
                <dd className="tabular-nums text-ink">{formatPrice(order.subtotal)}</dd>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between gap-6">
                  <dt className="text-slate">{chargeable ? 'Discount' : `Covered — ${billingLabel.toLowerCase()}`}</dt>
                  <dd className="tabular-nums text-moss">−{formatPrice(order.discount)}</dd>
                </div>
              )}
              {order.deliveryCharge > 0 && (
                <div className="flex justify-between gap-6">
                  <dt className="text-slate">Delivery</dt>
                  <dd className="tabular-nums text-ink">{formatPrice(order.deliveryCharge)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-6">
                <dt className="text-slate">VAT at {Math.round(order.vatRate * 100)}%</dt>
                <dd className="tabular-nums text-ink">{formatPrice(order.vat)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-6 border-t border-stone pt-2">
                <dt className="font-medium text-ink">Total</dt>
                <dd className="font-display text-lg font-medium tabular-nums text-ink">{formatPrice(order.total)}</dd>
              </div>
              {chargeable && (
                <p className="pt-1 text-right text-2xs text-slate">
                  {order.paymentStatus === 'PAID' ? `Paid ${formatDate(order.paidAt)} — thank you` : 'Payment due before dispatch'}
                </p>
              )}
            </dl>

            {order.customerNote && (
              <p className="rounded-brand bg-sand/60 p-3 text-xs leading-relaxed text-slate">{order.customerNote}</p>
            )}

            <p className="border-t border-stone/70 pt-4 text-2xs text-slate">
              Hygge Pergola · hyggepergola.co.uk · Prices in GBP. Please quote {order.ref} if you contact us about this order.
            </p>
          </CardBody>
        </Card>

        {/* What the team needs */}
        <div className="space-y-6 print:hidden">
          {!cancelled && chargeable && order.paymentStatus === 'AWAITING' && (
            <Card className="border-amber/40">
              <CardHeader
                eyebrow="Awaiting payment"
                title={`${formatPrice(order.total)} to take`}
                description="The warehouse will not pick this until it is paid. Recording the payment releases it to them."
              />
              <CardBody>
                <MarkPaidForm partsOrderId={order.id} total={order.total} />
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader
              eyebrow="Fulfilment"
              title={dispatch ? `Dispatch ${dispatch.ref}` : 'No dispatch'}
              action={
                dispatch && (
                  <Link href={`/dispatch?view=all&q=${dispatch.ref}`} className="text-2xs text-slate hover:text-ink">
                    In the queue
                  </Link>
                )
              }
            />
            <ol className="space-y-0 px-5 py-4">
              {steps.map((s, i) => {
                const isCurrent = !cancelled && i === current;
                return (
                  <li key={s.label} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < steps.length - 1 && (
                      <span className={cn('absolute left-[9px] top-5 h-full w-px', s.done ? 'bg-moss/40' : 'bg-stone')} aria-hidden />
                    )}
                    <span className="relative z-10 mt-0.5 bg-white">
                      {s.done ? (
                        <CircleCheck className="h-[19px] w-[19px] text-moss" />
                      ) : (
                        <Circle className={cn('h-[19px] w-[19px]', isCurrent ? 'text-ember' : 'text-stone')} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className={cn('text-sm', s.done ? 'text-ink' : isCurrent ? 'font-medium text-ink' : 'text-slate')}>
                        {s.label}
                        {isCurrent && dispatch?.status === 'AWAITING_STOCK' && (
                          <span className="ml-2 text-2xs text-sky">waiting for stock</span>
                        )}
                      </p>
                      {(s.at || s.note) && (
                        <p className="text-2xs text-slate">
                          {s.at ? formatDateTime(s.at) : ''}
                          {s.at && s.note ? ' · ' : ''}
                          {s.note}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            {dispatch?.trackingRef && (
              <p className="flex items-center gap-2 border-t border-stone/60 px-5 py-3 text-xs text-moss">
                <Truck className="h-4 w-4" />
                {dispatch.carrier} · {dispatch.trackingRef}
              </p>
            )}
          </Card>

          <Card>
            <CardHeader eyebrow="For the team" title="Why it was placed" />
            <CardBody className="space-y-2 text-xs">
              <p className="text-ink">{order.internalNote ?? '—'}</p>
              <p className="text-slate">
                Placed by {order.createdBy.name} on {formatDateTime(order.placedAt)}.
              </p>
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-slate">
                <Link href={`/customers/${order.customer.id}`} className="hover:text-ember-dark">Customer record</Link>
                {order.order && (
                  <Link href={`/orders/${order.order.id}`} className="hover:text-ember-dark">Order {order.order.ref}</Link>
                )}
                {order.ticket && (
                  <Link href={`/cases/${order.ticket.id}`} className="hover:text-ember-dark">Case {order.ticket.ref}</Link>
                )}
              </p>
              {!cancelled && !shipped && (
                <div className="border-t border-stone/60 pt-3">
                  <CancelOrderForm partsOrderId={order.id} />
                </div>
              )}
              {!cancelled && shipped && (
                <p className="flex items-center gap-1.5 border-t border-stone/60 pt-3 text-2xs text-slate">
                  <Check className="h-3.5 w-3.5 text-moss" />
                  Sent — any problem with it is now a return, not a cancellation.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader eyebrow={`${activities.length} entries`} title="History" />
            <Timeline entries={activities} />
          </Card>
        </div>
      </div>
    </>
  );
}
