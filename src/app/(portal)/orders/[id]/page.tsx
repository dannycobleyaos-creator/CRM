import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarClock, Layers, MessagesSquare, PoundSterling, ShoppingCart } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  ORDER_STATUSES,
  ORDER_STATUS_META,
  PERGOLA_COLOUR_META,
  TICKET_ACTIVE_STATUSES,
  byCatalogueOrder,
  type PergolaColour,
} from '@/lib/constants';
import { formatDate, formatDateTime, formatMoney, formatPrice, relativeTime } from '@/lib/utils';
import { setOrderStatus } from '@/actions/orders';

import { ActionForm } from '@/components/ui/action-form';
import { Card, CardBody, CardHeader, EmptyState } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Stat } from '@/components/ui/stat';
import { Avatar } from '@/components/ui/avatar';
import { ButtonLink } from '@/components/ui/button';
import {
  BillingChip,
  DispatchStatusChip,
  OrderStatusChip,
  PaymentChip,
  SlaChip,
  StockBadge,
  TaskStatusChip,
  TicketStatusChip,
} from '@/components/status-chips';
import { Timeline, timelineSelect } from '@/components/work/timeline';
import { LogInteractionForm } from '@/components/work/log-interaction-form';
import { KeyDates } from '@/components/orders/key-dates';
import { AddOrderDateForm } from '@/components/orders/order-date-forms';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const order = await db.order.findUnique({ where: { id }, select: { ref: true } });
  return { title: order?.ref ?? 'Order' };
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-2xs uppercase tracking-brand text-slate">{label}</dt>
      <dd className="text-right text-xs text-ink">{children}</dd>
    </div>
  );
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const now = new Date();

  const [order, team] = await Promise.all([
    db.order.findUnique({
      where: { id },
      include: {
        customer: true,
        owner: { select: { id: true, name: true, avatarTone: true } },
        product: {
          include: {
            bom: { include: { part: true } },
          },
        },
        keyDates: {
          orderBy: { dueAt: 'asc' },
          include: { owner: { select: { id: true, name: true, avatarTone: true } } },
        },
        tickets: {
          orderBy: { openedAt: 'desc' },
          include: { assignee: { select: { name: true } } },
        },
        tasks: {
          where: { status: { not: 'DONE' } },
          orderBy: { dueAt: 'asc' },
          include: { assignee: { select: { name: true, avatarTone: true } } },
        },
        partsOrders: {
          orderBy: { placedAt: 'desc' },
          include: { dispatch: { select: { status: true } }, lines: { select: { qty: true, description: true } } },
        },
        partRequests: { select: { id: true } },
      },
    }),
    db.user.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, team: true } }),
  ]);
  if (!order) notFound();

  // The order's whole story: notes on it, its cases, its parts and dispatches.
  const activities = await db.activity.findMany({
    where: {
      OR: [
        { orderId: order.id },
        { ticketId: { in: order.tickets.map((t) => t.id) } },
        { partRequestId: { in: order.partRequests.map((r) => r.id) } },
        { partsOrderId: { in: order.partsOrders.map((p) => p.id) } },
      ],
    },
    select: timelineSelect,
    orderBy: { occurredAt: 'desc' },
    take: 120,
  });

  order.product?.bom.sort((a, b) => byCatalogueOrder(a.part, b.part));
  const colour = PERGOLA_COLOUR_META[order.colour as PergolaColour];
  const white = order.colour === 'MATT_WHITE';
  const openDates = order.keyDates.filter((d) => !d.doneAt);
  const nextDate = openDates[0];
  const missed = openDates.filter((d) => d.dueAt < now).length;
  const openCases = order.tickets.filter((t) => (TICKET_ACTIVE_STATUSES as string[]).includes(t.status));
  const liveParts = order.partsOrders.filter((p) => p.status !== 'CANCELLED');
  const partsSpend = liveParts.reduce((s, p) => s + (p.billing === 'CHARGEABLE' ? 0 : p.listValue), 0);
  const address = [order.customer.addressL1, order.customer.city, order.customer.postcode].filter(Boolean).join(', ');
  const orderPartsHref = `/parts-orders/new?customerId=${order.customerId}&orderId=${order.id}`;

  return (
    <>
      <Link href="/orders" className="inline-flex items-center gap-1.5 text-xs text-slate transition-colors hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to orders
      </Link>

      <PageHeader
        eyebrow={order.ref}
        title={order.productLine}
        description={`${order.customer.name}${address ? ` · ${address}` : ''}`}
        actions={
          <>
            <ActionForm action={setOrderStatus} fields={{ orderId: order.id }} className="flex items-end gap-2">
              <div>
                <label className="field-label" htmlFor="status">Status</label>
                <select id="status" name="status" defaultValue={order.status} className="field h-9 w-44 text-xs">
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>{ORDER_STATUS_META[s].label}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="h-9 rounded-brand border border-stone bg-white px-3 text-xs font-medium text-ink transition-colors hover:bg-sand"
              >
                Update
              </button>
            </ActionForm>
            <ButtonLink href={orderPartsHref} size="sm" className="h-9">
              <ShoppingCart className="h-4 w-4" />
              Order parts
            </ButtonLink>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <OrderStatusChip value={order.status} size="md" />
        {colour && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-stone bg-white px-3 py-1 text-xs text-ink">
            <span className="h-3 w-3 rounded-full ring-1 ring-stone" style={{ background: colour.swatch }} />
            {colour.label}
          </span>
        )}
        {order.owner && (
          <span className="ml-1 inline-flex items-center gap-2 text-xs text-slate">
            <Avatar name={order.owner.name} tone={order.owner.avatarTone} size="xs" />
            Owned by {order.owner.name}
          </span>
        )}
        <Link href={`/customers/${order.customer.id}`} className="ml-1 text-xs text-slate underline-offset-4 hover:text-ink hover:underline">
          Customer record
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Order value" value={formatMoney(order.value)} sub={`Ordered ${formatDate(order.orderedAt)}`} tone="ember" icon={<PoundSterling className="h-4 w-4" />} />
        <Stat
          label="Next date"
          value={nextDate ? nextDate.dueAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
          sub={nextDate ? `${nextDate.label} · ${relativeTime(nextDate.dueAt, now)}` : 'Nothing booked'}
          tone={nextDate && nextDate.dueAt < now ? 'clay' : 'sky'}
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <Stat
          label="Open cases"
          value={openCases.length}
          sub={`${order.tickets.length} raised against this order`}
          tone={openCases.length ? 'amber' : 'moss'}
          icon={<MessagesSquare className="h-4 w-4" />}
        />
        <Stat
          label="Parts sent"
          value={liveParts.length}
          sub={partsSpend ? `${formatPrice(partsSpend)} free of charge at list price` : 'Nothing sent free of charge'}
          tone="slate"
          icon={<ShoppingCart className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className={missed ? 'border-clay/30' : undefined}>
            <CardHeader
              eyebrow={missed ? `${missed} overdue` : `${openDates.length} to come`}
              title="Key dates"
              description="Tick each one off when it happens. Moving a date keeps the old one in the history."
              action={<AddOrderDateForm orderId={order.id} team={team} defaultOwnerId={order.owner?.id ?? user.id} />}
            />
            <KeyDates dates={order.keyDates} team={team} />
          </Card>

          <Card>
            <CardHeader eyebrow="The pergola" title="Order details" />
            <CardBody className="py-2">
              <dl className="divide-y divide-stone/60">
                <Fact label="Customer">
                  <Link href={`/customers/${order.customer.id}`} className="hover:text-ember-dark">
                    {order.customer.name} · {order.customer.ref}
                  </Link>
                </Fact>
                <Fact label="Product">
                  {order.product ? (
                    <Link href={`/inventory/bom/${order.product.id}`} className="hover:text-ember-dark">{order.productLine}</Link>
                  ) : (
                    order.productLine
                  )}
                </Fact>
                <Fact label="Size and layout">{order.sizeSpec ?? '—'}</Fact>
                <Fact label="Extras">{order.extras ?? '—'}</Fact>
                <Fact label="Delivery due">{order.deliveryDue ? formatDateTime(order.deliveryDue) : '—'}</Fact>
                <Fact label="Installed">{order.installedAt ? formatDate(order.installedAt) : '—'}</Fact>
                {order.installerRef && <Fact label="Installer ref">{order.installerRef}</Fact>}
                {order.customer.phone && (
                  <Fact label="Phone">
                    <a href={`tel:${order.customer.phone}`} className="hover:text-ember-dark">{order.customer.phone}</a>
                  </Fact>
                )}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              eyebrow={`${order.partsOrders.length} total`}
              title="Parts orders"
              action={
                <ButtonLink href={orderPartsHref} variant="ghost" size="sm">
                  Order parts
                </ButtonLink>
              }
            />
            {order.partsOrders.length ? (
              <ul className="divide-y divide-stone/60">
                {order.partsOrders.map((p) => (
                  <li key={p.id}>
                    <Link href={`/parts-orders/${p.id}`} className="block px-5 py-3 hover:bg-sand/40">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-2xs text-slate">{p.ref}</span>
                        <BillingChip value={p.billing} dot={false} />
                        {p.status === 'CANCELLED' ? (
                          <span className="text-2xs text-clay">Cancelled</span>
                        ) : (
                          <>
                            {p.paymentStatus === 'AWAITING' && <PaymentChip value="AWAITING" />}
                            {p.dispatch && <DispatchStatusChip value={p.dispatch.status} />}
                          </>
                        )}
                        <span className="ml-auto text-xs tabular-nums text-ink">
                          {p.billing === 'CHARGEABLE' ? formatPrice(p.total) : 'No charge'}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-2xs text-slate">
                        {p.lines.map((l) => `${l.qty} × ${l.description}`).join(' · ')} · {relativeTime(p.placedAt, now)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No parts sent" description="Replacement or extra parts for this pergola will be listed here." />
            )}
          </Card>

          {order.product && order.product.bom.length > 0 && (
            <Card>
              <details>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
                  <span>
                    <span className="brand-eyebrow mb-1 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5" />
                      Bill of materials
                    </span>
                    <span className="font-display text-base font-medium text-ink">What went into this pergola</span>
                  </span>
                  <span className="text-2xs text-slate">{order.product.bom.length} lines — show</span>
                </summary>
                <div className="overflow-x-auto border-t border-stone/70">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Part</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Spare price</th>
                        <th>Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.product.bom.map((l) => (
                        <tr key={l.id}>
                          <td>
                            <Link href={`/inventory/${l.part.id}`} className="text-xs text-ink hover:text-ember-dark">{l.part.name}</Link>
                            <span className="block font-mono text-2xs text-slate">{l.part.sku}</span>
                          </td>
                          <td className="text-right text-xs tabular-nums">{l.qty}</td>
                          <td className="text-right text-xs tabular-nums text-slate">{formatPrice(l.part.unitPrice)}</td>
                          <td><StockBadge qty={l.part.stockQty} reorderLevel={l.part.reorderLevel} compact /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {white && (
                    <p className="border-t border-stone/60 px-5 py-2.5 text-2xs text-slate">
                      Colour-specific parts are listed in matt grey. Ordering parts for this pergola picks the matt white version automatically.
                    </p>
                  )}
                </div>
              </details>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              eyebrow="Notes and contact"
              title="Add to this order"
              description="Logged here, it is on the order's history and the customer's."
            />
            <CardBody>
              <LogInteractionForm
                customerId={order.customerId}
                orderId={order.id}
                placeholder="Customer confirmed the base is ready for the install"
              />
            </CardBody>
          </Card>

          {(openCases.length > 0 || order.tasks.length > 0) && (
            <Card className={openCases.length ? 'border-amber/40' : undefined}>
              <CardHeader eyebrow="Needs attention" title="Open work on this order" />
              <ul className="divide-y divide-stone/60">
                {openCases.map((t) => (
                  <li key={t.id} className="px-5 py-3">
                    <Link href={`/cases/${t.id}`} className="group block">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-2xs text-slate">{t.ref}</span>
                        <TicketStatusChip value={t.status} />
                        <SlaChip dueAt={t.dueAt} compact />
                      </div>
                      <p className="mt-1 text-sm font-medium text-ink group-hover:text-ember-dark">{t.subject}</p>
                      <p className="text-2xs text-slate">{t.assignee?.name ?? 'Unassigned'}</p>
                    </Link>
                  </li>
                ))}
                {order.tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <TaskStatusChip value={t.status} />
                      <p className="mt-1 truncate text-xs font-medium text-ink">{t.title}</p>
                      <p className="text-2xs text-slate">
                        {t.assignee?.name ?? 'Unassigned'}
                        {t.dueAt ? ` · due ${relativeTime(t.dueAt, now)}` : ''}
                      </p>
                    </div>
                    {t.assignee && <Avatar name={t.assignee.name} tone={t.assignee.avatarTone} size="xs" />}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader
              eyebrow={`${activities.length} entries`}
              title="Everything that has happened"
              description="Notes, calls and emails on the order, its cases, and every part sent for it."
            />
            <Timeline entries={activities} />
          </Card>
        </div>
      </div>
    </>
  );
}
