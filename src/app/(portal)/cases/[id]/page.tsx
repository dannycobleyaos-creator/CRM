import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Clock3,
  Mail,
  MapPin,
  Phone,
  ShoppingBag,
  UserCheck,
} from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { assignCase, claimCase, setCaseStatus } from '@/actions/tickets';
import { TICKET_STATUSES, TICKET_STATUS_META, type TicketStatus } from '@/lib/constants';
import { formatDate, formatDateTime, formatDuration, formatMoney, relativeTime } from '@/lib/utils';

import { ActionForm } from '@/components/ui/action-form';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  ChannelChip,
  CustomerStageChip,
  DispatchStatusChip,
  OrderStatusChip,
  PriorityChip,
  SlaChip,
  TaskStatusChip,
  TicketCategoryChip,
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
  const ticket = await db.ticket.findUnique({ where: { id }, select: { ref: true, subject: true } });
  return { title: ticket ? `${ticket.ref} · ${ticket.subject}` : 'Case' };
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="shrink-0 text-2xs uppercase tracking-brand text-slate">{label}</dt>
      <dd className="min-w-0 text-right text-xs text-ink">{children}</dd>
    </div>
  );
}

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const [ticket, team] = await Promise.all([
    db.ticket.findUnique({
      where: { id },
      include: {
        customer: { include: { owner: { select: { name: true, avatarTone: true } } } },
        order: true,
        assignee: { select: { id: true, name: true, avatarTone: true, jobTitle: true } },
        activities: { select: timelineSelect, orderBy: { occurredAt: 'desc' } },
        tasks: {
          orderBy: { createdAt: 'desc' },
          include: { assignee: { select: { name: true, avatarTone: true } } },
        },
        partRequests: {
          orderBy: { requestedAt: 'desc' },
          include: {
            lines: { include: { part: true } },
            partsOrder: { select: { id: true, ref: true, billing: true } },
          },
        },
      },
    }),
    db.user.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, team: true },
    }),
  ]);

  if (!ticket) notFound();

  const responseMins = ticket.firstResponseAt
    ? (ticket.firstResponseAt.getTime() - ticket.openedAt.getTime()) / 60000
    : null;
  const metSla =
    responseMins !== null && ticket.dueAt ? ticket.firstResponseAt! <= ticket.dueAt : null;
  const isOpen = !['RESOLVED', 'CLOSED'].includes(ticket.status);

  return (
    <>
      <Link
        href="/cases"
        className="inline-flex items-center gap-1.5 text-xs text-slate transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to cases
      </Link>

      <header className="border-b border-stone pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-slate">{ticket.ref}</span>
          <TicketStatusChip value={ticket.status} />
          <PriorityChip value={ticket.priority} />
          <TicketCategoryChip value={ticket.category} dot={false} />
          <ChannelChip value={ticket.channel} dot={false} />
          {ticket.reopenCount > 0 && (
            <Badge tone="amber" dot={false}>
              Reopened {ticket.reopenCount}×
            </Badge>
          )}
        </div>

        <h1 className="mt-2.5 font-display text-2xl font-medium text-ink">{ticket.subject}</h1>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate">
          <Link
            href={`/customers/${ticket.customer.id}`}
            className="inline-flex items-center gap-1.5 font-medium text-ink transition-colors hover:text-ember-dark"
          >
            <Building2 className="h-3.5 w-3.5" />
            {ticket.customer.name}
          </Link>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" />
            Opened {relativeTime(ticket.openedAt)}
          </span>
          {isOpen && <SlaChip dueAt={ticket.dueAt} />}
          {ticket.assignee ? (
            <span className="inline-flex items-center gap-1.5">
              <Avatar name={ticket.assignee.name} tone={ticket.assignee.avatarTone} size="xs" />
              {ticket.assignee.name}
            </span>
          ) : (
            <Badge tone="clay" dot>
              Nobody has picked this up
            </Badge>
          )}
        </div>
      </header>

      {/* Action bar — everything an agent can do to this case, in one strip */}
      <Card>
        <CardBody className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <div>
            <p className="field-label">Move this case to</p>
            <div className="flex flex-wrap gap-1.5">
              {TICKET_STATUSES.filter((s) => s !== ticket.status).map((s) => (
                <ActionForm
                  key={s}
                  action={setCaseStatus}
                  fields={{ ticketId: ticket.id, status: s }}
                >
                  <button
                    type="submit"
                    title={TICKET_STATUS_META[s as TicketStatus].hint}
                    className="rounded-full border border-stone bg-white px-3 py-1.5 text-xs text-slate transition-colors hover:border-charcoal hover:bg-charcoal hover:text-white"
                  >
                    {TICKET_STATUS_META[s as TicketStatus].label}
                  </button>
                </ActionForm>
              ))}
            </div>
          </div>

          <ActionForm
            action={assignCase}
            fields={{ ticketId: ticket.id }}
            className="flex items-end gap-2"
          >
            <div>
              <label className="field-label" htmlFor="assigneeId">
                Owner
              </label>
              <select
                id="assigneeId"
                name="assigneeId"
                defaultValue={ticket.assigneeId ?? ''}
                className="field h-9 w-56 text-xs"
              >
                <option value="">Unassigned</option>
                {team.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {t.team}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="secondary" size="sm">
              Update
            </Button>
          </ActionForm>

          {ticket.assigneeId !== user.id && (
            <ActionForm action={claimCase} fields={{ ticketId: ticket.id }}>
              <Button type="submit" size="sm">
                <UserCheck className="h-3.5 w-3.5" />
                Assign to me
              </Button>
            </ActionForm>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              eyebrow="Log an interaction"
              title="What did you just do?"
              description="Notes stay internal. Calls, emails, chats and texts count as a customer response and stop the SLA clock."
            />
            <CardBody>
              <LogInteractionForm ticketId={ticket.id} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              eyebrow={`${ticket.activities.length} entries`}
              title="Full history"
              description="Every channel on one spine, newest first."
            />
            <Timeline entries={ticket.activities} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader eyebrow="Customer" title={ticket.customer.name} />
            <CardBody className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <CustomerStageChip value={ticket.customer.stage} />
                <span className="font-mono text-2xs text-slate">{ticket.customer.ref}</span>
              </div>
              <dl className="divide-y divide-stone/60 text-xs">
                {ticket.customer.phone && (
                  <Fact label="Phone">
                    <a href={`tel:${ticket.customer.phone}`} className="inline-flex items-center gap-1.5 hover:text-ember-dark">
                      <Phone className="h-3 w-3" />
                      {ticket.customer.phone}
                    </a>
                  </Fact>
                )}
                {ticket.customer.email && (
                  <Fact label="Email">
                    <a href={`mailto:${ticket.customer.email}`} className="inline-flex items-center gap-1.5 break-all hover:text-ember-dark">
                      <Mail className="h-3 w-3" />
                      {ticket.customer.email}
                    </a>
                  </Fact>
                )}
                <Fact label="Address">
                  <span className="inline-flex items-start gap-1.5">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      {[ticket.customer.addressL1, ticket.customer.city, ticket.customer.postcode]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </span>
                </Fact>
                {ticket.customer.owner && (
                  <Fact label="Account owner">{ticket.customer.owner.name}</Fact>
                )}
              </dl>
              <Link
                href={`/customers/${ticket.customer.id}`}
                className="inline-block text-xs font-medium text-ember-dark hover:underline"
              >
                Open the full customer record →
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader eyebrow="Service level" title="Response performance" />
            <CardBody>
              <dl className="divide-y divide-stone/60">
                <Fact label="Target">{formatDuration(ticket.slaMinutes)}</Fact>
                <Fact label="Deadline">{formatDateTime(ticket.dueAt)}</Fact>
                <Fact label="First response">
                  {responseMins === null ? (
                    <Badge tone="clay" dot>
                      Not yet answered
                    </Badge>
                  ) : (
                    <span className={metSla ? 'text-moss' : 'text-clay'}>
                      {formatDuration(responseMins)} {metSla ? '· within target' : '· over target'}
                    </span>
                  )}
                </Fact>
                <Fact label="Resolved">
                  {ticket.resolvedAt ? formatDateTime(ticket.resolvedAt) : '—'}
                </Fact>
                {ticket.satisfaction && <Fact label="CSAT">{ticket.satisfaction} / 5</Fact>}
              </dl>
            </CardBody>
          </Card>

          {ticket.order && (
            <Card>
              <CardHeader
                eyebrow="Linked order"
                title={ticket.order.ref}
                action={
                  <Link href={`/orders/${ticket.order.id}`} className="text-2xs text-slate hover:text-ink">
                    Open order
                  </Link>
                }
              />
              <CardBody>
                <dl className="divide-y divide-stone/60">
                  <Fact label="Product">
                    <span className="inline-flex items-center gap-1.5">
                      <ShoppingBag className="h-3 w-3" />
                      {ticket.order.productLine}
                    </span>
                  </Fact>
                  <Fact label="Configuration">{ticket.order.extras ?? '—'}</Fact>
                  <Fact label="Status">
                    <OrderStatusChip value={ticket.order.status} />
                  </Fact>
                  <Fact label="Value">{formatMoney(ticket.order.value)}</Fact>
                  <Fact label="Delivery due">{formatDate(ticket.order.deliveryDue)}</Fact>
                </dl>
              </CardBody>
            </Card>
          )}

          {ticket.tasks.length > 0 && (
            <Card>
              <CardHeader eyebrow={`${ticket.tasks.length} linked`} title="Tasks on this case" />
              <ul className="divide-y divide-stone/60">
                {ticket.tasks.map((t) => (
                  <li key={t.id} className="px-5 py-3">
                    <TaskStatusChip value={t.status} />
                    <p className="mt-1.5 text-xs font-medium text-ink">{t.title}</p>
                    <p className="mt-0.5 text-2xs text-slate">
                      {t.assignee?.name ?? 'Unassigned'}
                      {t.dueAt ? ` · due ${relativeTime(t.dueAt)}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {(isOpen || ticket.partRequests.length > 0) && (
            <Card>
              <CardHeader
                eyebrow="Warehouse"
                title="Parts for this case"
                action={
                  <Link
                    href={`/parts-orders/new?customerId=${ticket.customerId}&ticketId=${ticket.id}${ticket.orderId ? `&orderId=${ticket.orderId}` : ''}`}
                    className="inline-flex items-center gap-1.5 rounded-brand bg-ember px-2.5 py-1.5 text-2xs font-medium text-white transition-colors hover:bg-ember-dark"
                  >
                    Order parts
                  </Link>
                }
              />
              {ticket.partRequests.length === 0 && (
                <p className="px-5 py-4 text-2xs text-slate">
                  Nothing sent yet. Parts ordered from here are linked to this case and its order.
                </p>
              )}
              <ul className="divide-y divide-stone/60">
                {ticket.partRequests.map((r) => (
                  <li key={r.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      {r.partsOrder ? (
                        <Link href={`/parts-orders/${r.partsOrder.id}`} className="font-mono text-2xs text-slate hover:text-ember-dark">
                          {r.partsOrder.ref} · {r.ref}
                        </Link>
                      ) : (
                        <span className="font-mono text-2xs text-slate">{r.ref}</span>
                      )}
                      <DispatchStatusChip value={r.status} />
                    </div>
                    <ul className="mt-1.5 space-y-0.5 text-2xs text-slate">
                      {r.lines.map((l) => (
                        <li key={l.id}>
                          {l.qty} × {l.part.name}
                        </li>
                      ))}
                    </ul>
                    {r.trackingRef && (
                      <p className="mt-1 text-2xs text-moss">
                        {r.carrier} · {r.trackingRef}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
