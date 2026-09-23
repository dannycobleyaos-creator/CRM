import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { AlertTriangle, Boxes, ClipboardCheck, PackageCheck, PackagePlus, Truck } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { DISPATCH_BOARD_COLUMNS, DISPATCH_STATUS_META, type DispatchStatus } from '@/lib/constants';
import { formatDate, relativeTime, startOfDay } from '@/lib/utils';

import { Card, CardHeader, EmptyState } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Stat } from '@/components/ui/stat';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { SearchField } from '@/components/ui/search-field';
import { Badge, TONE_DOTS } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { ButtonLink } from '@/components/ui/button';
import {
  BillingChip,
  DispatchStatusChip,
  PaymentChip,
  PriorityChip,
} from '@/components/status-chips';
import { DispatchActions } from '@/components/dispatch/dispatch-actions';

export const metadata: Metadata = { title: 'Parts dispatch' };
export const dynamic = 'force-dynamic';

type Search = { view?: string; q?: string };

export default async function DispatchPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireUser();
  const { view = 'open', q } = await searchParams;

  const where: Prisma.PartRequestWhereInput = {};
  if (view === 'open') {
    where.status = { in: ['REQUESTED', 'APPROVED', 'PICKING', 'AWAITING_STOCK'] };
  } else if (view === 'intransit') {
    where.status = 'DISPATCHED';
  } else if (view === 'done') {
    where.status = { in: ['DELIVERED', 'CANCELLED'] };
  }

  if (q) {
    where.OR = [
      { ref: { contains: q } },
      { customer: { name: { contains: q } } },
      { trackingRef: { contains: q } },
      { partsOrder: { ref: { contains: q } } },
    ];
  }

  const today = startOfDay(new Date());

  const [requests, lowStock, stats] = await Promise.all([
    db.partRequest.findMany({
      where,
      orderBy: [{ dueAt: 'asc' }, { requestedAt: 'asc' }],
      take: 150,
      include: {
        customer: { select: { id: true, name: true, ref: true, city: true, postcode: true } },
        ticket: { select: { id: true, ref: true } },
        requestedBy: { select: { name: true, avatarTone: true } },
        lines: { include: { part: true } },
        partsOrder: {
          select: { id: true, ref: true, billing: true, paymentStatus: true, status: true },
        },
      },
    }),
    db.part.findMany({ where: { isActive: true }, orderBy: { stockQty: 'asc' }, take: 40 }),
    Promise.all([
      db.partRequest.count({ where: { status: 'REQUESTED' } }),
      db.partRequest.count({ where: { status: { in: ['APPROVED', 'PICKING'] } } }),
      db.partRequest.count({ where: { status: 'AWAITING_STOCK' } }),
      db.partRequest.count({ where: { dispatchedAt: { gte: today } } }),
      db.partRequest.count({
        where: {
          status: { in: ['REQUESTED', 'APPROVED', 'PICKING', 'AWAITING_STOCK'] },
          dueAt: { lt: new Date() },
        },
      }),
    ]),
  ]);

  const [awaitingApproval, toPick, awaitingStock, dispatchedToday, overdueDispatch] = stats;
  const belowReorder = lowStock.filter((p) => p.stockQty <= p.reorderLevel);

  return (
    <>
      <PageHeader
        eyebrow="Warehouse"
        title="Parts dispatch"
        description="Every part we owe a customer, from the moment an agent raises it to the tracking number landing on the case."
        actions={
          <SearchField
            action="/dispatch"
            defaultValue={q}
            hidden={{ view }}
            placeholder="DSP or SP number, customer, tracking…"
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat
          label="Awaiting approval"
          value={awaitingApproval}
          sub="Raised by agents, not yet cleared"
          tone={awaitingApproval ? 'clay' : 'moss'}
          icon={<ClipboardCheck className="h-4 w-4" />}
        />
        <Stat
          label="To pick and pack"
          value={toPick}
          sub="Approved and in the warehouse"
          tone={toPick ? 'ember' : 'moss'}
          icon={<PackageCheck className="h-4 w-4" />}
        />
        <Stat
          label="Awaiting stock"
          value={awaitingStock}
          sub="Short — on order from the supplier"
          tone={awaitingStock ? 'sky' : 'moss'}
          icon={<Boxes className="h-4 w-4" />}
        />
        <Stat
          label="Dispatched today"
          value={dispatchedToday}
          sub="Out of the door"
          tone="moss"
          icon={<Truck className="h-4 w-4" />}
        />
        <Stat
          label="Past the promised date"
          value={overdueDispatch}
          sub="Customer is waiting longer than we said"
          tone={overdueDispatch ? 'clay' : 'moss'}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterTabs
          basePath="/dispatch"
          paramKey="view"
          active={view}
          params={{ q }}
          options={[
            { value: 'open', label: 'Needs action' },
            { value: 'intransit', label: 'In transit' },
            { value: 'done', label: 'Completed' },
            { value: 'all', label: 'Everything' },
          ]}
        />
        <ButtonLink href="/parts-orders/new" size="sm">
          <PackagePlus className="h-4 w-4" />
          Send parts out
        </ButtonLink>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            eyebrow={`${requests.length} ${requests.length === 1 ? 'dispatch' : 'dispatches'}`}
            title="Dispatch queue"
            description="Soonest promised date first. Each one moves forward with a single click."
          />
          {requests.length ? (
            <ul className="divide-y divide-stone/60">
              {requests.map((r) => {
                const overdue =
                  r.dueAt &&
                  r.dueAt < new Date() &&
                  ['REQUESTED', 'APPROVED', 'PICKING', 'AWAITING_STOCK'].includes(r.status);

                return (
                  <li key={r.id} className="px-5 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-2xs text-slate">{r.ref}</span>
                          <DispatchStatusChip value={r.status} />
                          <PriorityChip value={r.priority} dot={false} />
                          {overdue && (
                            <Badge tone="clay" dot>
                              Overdue
                            </Badge>
                          )}
                          {r.partsOrder && (
                            <>
                              <BillingChip value={r.partsOrder.billing} dot={false} />
                              {r.partsOrder.paymentStatus === 'AWAITING' && (
                                <PaymentChip value="AWAITING" />
                              )}
                            </>
                          )}
                        </div>

                        <Link
                          href={`/customers/${r.customer.id}`}
                          className="mt-1.5 block text-sm font-medium text-ink hover:text-ember-dark"
                        >
                          {r.customer.name}
                          <span className="ml-2 font-normal text-2xs text-slate">
                            {[r.customer.city, r.customer.postcode].filter(Boolean).join(' · ')}
                          </span>
                        </Link>

                        {r.reason && <p className="mt-1 text-xs text-slate">{r.reason}</p>}

                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {r.lines.map((l) => (
                            <li
                              key={l.id}
                              className="rounded-full border border-stone bg-sand/50 px-2.5 py-1 text-2xs text-ink"
                            >
                              <span className="font-semibold tabular-nums">{l.qty}×</span>{' '}
                              {l.part.name}
                              {l.part.stockQty <= 0 && (
                                <span className="ml-1 text-clay">· out of stock</span>
                              )}
                            </li>
                          ))}
                        </ul>

                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-slate">
                          <span className="inline-flex items-center gap-1.5">
                            <Avatar
                              name={r.requestedBy.name}
                              tone={r.requestedBy.avatarTone}
                              size="xs"
                            />
                            Raised by {r.requestedBy.name} {relativeTime(r.requestedAt)}
                          </span>
                          {r.partsOrder && (
                            <Link
                              href={`/parts-orders/${r.partsOrder.id}`}
                              className="font-mono hover:text-ember-dark"
                            >
                              {r.partsOrder.ref}
                            </Link>
                          )}
                          {r.ticket && (
                            <Link href={`/cases/${r.ticket.id}`} className="hover:text-ember-dark">
                              {r.ticket.ref}
                            </Link>
                          )}
                          {r.dueAt && <span>Promised {formatDate(r.dueAt)}</span>}
                          {r.trackingRef && (
                            <span className="inline-flex items-center gap-1 font-medium text-moss">
                              <Truck className="h-3 w-3" />
                              {r.carrier} · {r.trackingRef}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="w-full shrink-0 lg:w-72">
                        <DispatchActions
                          requestId={r.id}
                          status={r.status}
                          carrier={r.carrier}
                          trackingRef={r.trackingRef}
                          awaitingPaymentOn={
                            r.partsOrder?.paymentStatus === 'AWAITING' ? r.partsOrder.ref : undefined
                          }
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={<PackageCheck className="h-5 w-5" />}
              title="Nothing in this queue"
              description="No parts requests match that view."
            />
          )}
        </Card>

        <div className="space-y-6">
          <Card className={belowReorder.length ? 'border-clay/30' : undefined}>
            <CardHeader
              eyebrow="Stock control"
              title="At or below reorder level"
              description="Check here before you promise a customer a date."
            />
            {belowReorder.length ? (
              <ul className="divide-y divide-stone/60">
                {belowReorder.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <Link href={`/inventory/${p.id}`} className="min-w-0 hover:text-ember-dark">
                      <p className="truncate text-xs font-medium text-ink">{p.name}</p>
                      <p className="font-mono text-2xs text-slate">
                        {p.sku}
                        {p.location ? ` · bay ${p.location}` : ''}
                      </p>
                    </Link>
                    <Badge tone={p.stockQty <= 0 ? 'clay' : 'amber'} dot>
                      {p.stockQty} / {p.reorderLevel}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Stock is healthy" description="Nothing below its reorder level." />
            )}
          </Card>

          <Card>
            <CardHeader eyebrow="Pipeline" title="Where everything is" />
            <ul className="divide-y divide-stone/60">
              {DISPATCH_BOARD_COLUMNS.map((status) => {
                const meta = DISPATCH_STATUS_META[status as DispatchStatus];
                const count = requests.filter((r) => r.status === status).length;
                return (
                  <li key={status} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${TONE_DOTS[meta.tone]}`} />
                      <span className="text-xs text-ink">{meta.label}</span>
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-slate">{count}</span>
                  </li>
                );
              })}
            </ul>
            <p className="border-t border-stone/60 px-5 py-2.5 text-2xs text-slate">
              Counts reflect the current view.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
