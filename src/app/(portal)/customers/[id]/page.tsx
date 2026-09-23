import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ClipboardPlus, Mail, MapPin, Phone, ShoppingCart, Truck } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { setCustomerStage } from '@/actions/customers';
import {
  CUSTOMER_STAGES,
  CUSTOMER_STAGE_META,
  PERGOLA_COLOUR_META,
  type PergolaColour,
} from '@/lib/constants';
import { formatDate, formatMoney, formatPrice, parseTags, relativeTime } from '@/lib/utils';

import { ActionForm } from '@/components/ui/action-form';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader, EmptyState } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Stat } from '@/components/ui/stat';
import {
  BillingChip,
  CustomerStageChip,
  DispatchStatusChip,
  OrderStatusChip,
  PaymentChip,
  PriorityChip,
  SlaChip,
  SourceChip,
  TaskStatusChip,
  TicketStatusChip,
} from '@/components/status-chips';
import { Timeline, timelineSelect } from '@/components/work/timeline';
import { LogInteractionForm } from '@/components/work/log-interaction-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const customer = await db.customer.findUnique({ where: { id }, select: { name: true } });
  return { title: customer?.name ?? 'Customer' };
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true, avatarTone: true, jobTitle: true } },
      orders: {
        orderBy: { orderedAt: 'desc' },
        include: {
          keyDates: {
            where: { doneAt: null },
            orderBy: { dueAt: 'asc' },
            take: 1,
            select: { label: true, dueAt: true },
          },
        },
      },
      tickets: {
        orderBy: { openedAt: 'desc' },
        include: { assignee: { select: { name: true, avatarTone: true } } },
      },
      tasks: {
        orderBy: { createdAt: 'desc' },
        include: { assignee: { select: { name: true, avatarTone: true } } },
      },
      partsOrders: {
        orderBy: { placedAt: 'desc' },
        include: {
          lines: { select: { id: true, qty: true, description: true } },
          dispatch: { select: { status: true, carrier: true, trackingRef: true } },
        },
      },
      activities: { select: timelineSelect, orderBy: { occurredAt: 'desc' }, take: 80 },
    },
  });

  if (!customer) notFound();

  const lifetimeValue = customer.orders
    .filter((o) => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum + o.value, 0);
  const openCases = customer.tickets.filter(
    (t) => !['RESOLVED', 'CLOSED'].includes(t.status),
  );
  const openTasks = customer.tasks.filter((t) => t.status !== 'DONE');
  const address = [customer.addressL1, customer.addressL2, customer.city, customer.county, customer.postcode]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <Link
        href="/customers"
        className="inline-flex items-center gap-1.5 text-xs text-slate transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to customers
      </Link>

      <PageHeader
        eyebrow={customer.ref}
        title={customer.name}
        description={address || undefined}
        actions={
          <>
          <ButtonLink href={`/parts-orders/new?customerId=${customer.id}`} variant="secondary" size="sm" className="h-9">
            <ShoppingCart className="h-4 w-4" />
            Order parts
          </ButtonLink>
          <ActionForm
            action={setCustomerStage}
            fields={{ customerId: customer.id }}
            className="flex items-end gap-2"
          >
            <div>
              <label className="field-label" htmlFor="stage">
                Stage
              </label>
              <select
                id="stage"
                name="stage"
                defaultValue={customer.stage}
                className="field h-9 w-44 text-xs"
              >
                {CUSTOMER_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {CUSTOMER_STAGE_META[s].label}
                  </option>
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
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <CustomerStageChip value={customer.stage} size="md" />
        <SourceChip value={customer.source} dot={false} size="md" />
        {parseTags(customer.tags).map((tag) => (
          <Badge key={tag} tone="ember" dot={false} size="md">
            {tag}
          </Badge>
        ))}
        {customer.owner && (
          <span className="ml-1 inline-flex items-center gap-2 text-xs text-slate">
            <Avatar name={customer.owner.name} tone={customer.owner.avatarTone} size="xs" />
            Owned by {customer.owner.name}
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Lifetime value" value={formatMoney(lifetimeValue)} sub={`${customer.orders.length} orders`} tone="ember" />
        <Stat label="Open cases" value={openCases.length} sub={`${customer.tickets.length} all time`} tone={openCases.length ? 'clay' : 'moss'} />
        <Stat label="Open tasks" value={openTasks.length} sub="Assigned to the team" tone={openTasks.length ? 'amber' : 'moss'} />
        <Stat label="Interactions" value={customer.activities.length} sub="Logged on this record" tone="sky" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        {/* Facts and related records */}
        <div className="space-y-6">
          <Card>
            <CardHeader eyebrow="Contact" title="How to reach them" />
            <CardBody className="space-y-3 text-xs">
              {customer.phone && (
                <a href={`tel:${customer.phone}`} className="flex items-center gap-2.5 text-ink hover:text-ember-dark">
                  <Phone className="h-4 w-4 text-slate" />
                  {customer.phone}
                </a>
              )}
              {customer.email && (
                <a href={`mailto:${customer.email}`} className="flex items-center gap-2.5 break-all text-ink hover:text-ember-dark">
                  <Mail className="h-4 w-4 shrink-0 text-slate" />
                  {customer.email}
                </a>
              )}
              {address && (
                <p className="flex items-start gap-2.5 text-ink">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate" />
                  {address}
                </p>
              )}
              {customer.notes && (
                <p className="rounded-brand bg-sand/60 p-3 text-xs leading-relaxed text-slate">
                  {customer.notes}
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              eyebrow={`${customer.orders.length} total`}
              title="Orders"
              action={
                <ButtonLink href={`/orders?new=1&customerId=${customer.id}`} variant="ghost" size="sm">
                  <ClipboardPlus className="h-3.5 w-3.5" />
                  New order
                </ButtonLink>
              }
            />
            {customer.orders.length ? (
              <ul className="divide-y divide-stone/60">
                {customer.orders.map((o) => (
                  <li key={o.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/orders/${o.id}`} className="font-mono text-2xs text-slate hover:text-ember-dark">
                        {o.ref}
                      </Link>
                      <OrderStatusChip value={o.status} />
                    </div>
                    <Link href={`/orders/${o.id}`} className="mt-1 block text-sm font-medium text-ink hover:text-ember-dark">
                      {o.productLine}
                    </Link>
                    <p className="mt-0.5 text-2xs text-slate">
                      {o.sizeSpec} · {o.extras}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-2xs text-slate">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="h-3 w-3 rounded-full ring-1 ring-stone"
                          style={{
                            background:
                              PERGOLA_COLOUR_META[o.colour as PergolaColour]?.swatch ?? '#ccc',
                          }}
                        />
                        {PERGOLA_COLOUR_META[o.colour as PergolaColour]?.label ?? o.colour}
                      </span>
                      <span className="font-medium text-ink">{formatMoney(o.value)}</span>
                      <span>Ordered {formatDate(o.orderedAt)}</span>
                      {o.deliveryDue && <span>Delivery {formatDate(o.deliveryDue)}</span>}
                      {o.installedAt && <span className="text-moss">Installed {formatDate(o.installedAt)}</span>}
                    </div>
                    {o.keyDates[0] && (
                      <p className={`mt-1.5 text-2xs ${o.keyDates[0].dueAt < new Date() ? 'text-clay' : 'text-slate'}`}>
                        Next: {o.keyDates[0].label} · {formatDate(o.keyDates[0].dueAt)} ({relativeTime(o.keyDates[0].dueAt)})
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No orders yet" description="This customer has not ordered." />
            )}
          </Card>

          <Card>
            <CardHeader
              eyebrow={`${customer.partsOrders.length} total`}
              title="Parts orders"
              action={
                <ButtonLink href={`/parts-orders/new?customerId=${customer.id}`} variant="ghost" size="sm">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Order parts
                </ButtonLink>
              }
            />
            {customer.partsOrders.length ? (
              <ul className="divide-y divide-stone/60">
                {customer.partsOrders.map((p) => (
                  <li key={p.id} className="px-5 py-3.5">
                    <Link href={`/parts-orders/${p.id}`} className="group block">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-2xs text-slate group-hover:text-ember-dark">{p.ref}</span>
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
                      <ul className="mt-1.5 space-y-0.5 text-2xs text-slate">
                        {p.lines.map((l) => (
                          <li key={l.id}>
                            {l.qty} × {l.description}
                          </li>
                        ))}
                      </ul>
                    </Link>
                    {p.dispatch?.trackingRef && (
                      <p className="mt-1.5 inline-flex items-center gap-1.5 text-2xs text-moss">
                        <Truck className="h-3 w-3" />
                        {p.dispatch.carrier} · {p.dispatch.trackingRef}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No parts ordered" description="Nothing has been ordered for this customer." />
            )}
          </Card>
        </div>

        {/* Conversation */}
        <div className="space-y-6">
          {openCases.length > 0 && (
            <Card className="border-clay/30">
              <CardHeader
                eyebrow="Needs attention"
                title={`${openCases.length} open ${openCases.length === 1 ? 'case' : 'cases'}`}
              />
              <ul className="divide-y divide-stone/60">
                {openCases.map((t) => (
                  <li key={t.id} className="px-5 py-3">
                    <Link href={`/cases/${t.id}`} className="group block">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-2xs text-slate">{t.ref}</span>
                        <TicketStatusChip value={t.status} />
                        <PriorityChip value={t.priority} dot={false} />
                        <SlaChip dueAt={t.dueAt} compact />
                      </div>
                      <p className="mt-1 text-sm font-medium text-ink group-hover:text-ember-dark">
                        {t.subject}
                      </p>
                      <p className="mt-0.5 text-2xs text-slate">
                        {t.assignee?.name ?? 'Unassigned'} · opened {relativeTime(t.openedAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {openTasks.length > 0 && (
            <Card>
              <CardHeader eyebrow="Outstanding" title="Tasks on this account" />
              <ul className="divide-y divide-stone/60">
                {openTasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <TaskStatusChip value={t.status} />
                      <p className="mt-1 truncate text-xs font-medium text-ink">{t.title}</p>
                      <p className="text-2xs text-slate">
                        {t.assignee?.name ?? 'Unassigned'}
                        {t.dueAt ? ` · due ${relativeTime(t.dueAt)}` : ''}
                      </p>
                    </div>
                    {t.assignee && (
                      <Avatar name={t.assignee.name} tone={t.assignee.avatarTone} size="xs" />
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader
              eyebrow="Log something"
              title="Add to the record"
              description="Whatever you write here is what the next agent reads before they call."
            />
            <CardBody>
              <LogInteractionForm customerId={customer.id} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              eyebrow={`${customer.activities.length} entries`}
              title="Everything that has happened"
              description="Calls, chats, emails, notes and status changes on one spine."
            />
            <Timeline entries={customer.activities} />
          </Card>
        </div>
      </div>
    </>
  );
}
