import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { CreditCard, PackageCheck, PoundSterling, ShieldCheck, ShoppingCart } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { BILLING_META, BILLING_TYPES, DISPATCH_OPEN_STATUSES } from '@/lib/constants';
import { formatMoney, formatPrice, relativeTime } from '@/lib/utils';

import { Card, CardHeader, EmptyState } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Stat } from '@/components/ui/stat';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { SearchField } from '@/components/ui/search-field';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BillingChip, DispatchStatusChip, PaymentChip } from '@/components/status-chips';

export const metadata: Metadata = { title: 'Parts orders' };
export const dynamic = 'force-dynamic';

type Search = { view?: string; billing?: string; q?: string };

export default async function PartsOrdersPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireUser();
  const { view = 'open', billing = '', q } = await searchParams;

  const where: Prisma.PartsOrderWhereInput = {};
  if (view === 'open') {
    where.status = 'PLACED';
    where.dispatch = { status: { in: [...DISPATCH_OPEN_STATUSES, 'DISPATCHED'] } };
  } else if (view === 'payment') {
    where.status = 'PLACED';
    where.paymentStatus = 'AWAITING';
  } else if (view === 'done') {
    where.status = 'PLACED';
    where.dispatch = { status: 'DELIVERED' };
  } else if (view === 'cancelled') {
    where.status = 'CANCELLED';
  }
  if (billing) where.billing = billing;
  if (q) {
    where.OR = [
      { ref: { contains: q } },
      { customer: { name: { contains: q } } },
      { customer: { ref: { contains: q } } },
      { order: { ref: { contains: q } } },
      { lines: { some: { OR: [{ sku: { contains: q } }, { description: { contains: q } }] } } },
    ];
  }

  const since = new Date(Date.now() - 30 * 864e5);
  const [orders, awaiting, inFulfilment, freeOfCharge, paidRevenue] = await Promise.all([
    db.partsOrder.findMany({
      where,
      orderBy: { placedAt: 'desc' },
      take: 150,
      include: {
        customer: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        dispatch: { select: { status: true, trackingRef: true, carrier: true } },
        lines: { select: { qty: true, description: true } },
      },
    }),
    db.partsOrder.aggregate({
      where: { status: 'PLACED', paymentStatus: 'AWAITING' },
      _count: { _all: true },
      _sum: { total: true },
    }),
    db.partsOrder.count({
      where: { status: 'PLACED', dispatch: { status: { in: [...DISPATCH_OPEN_STATUSES] } } },
    }),
    db.partsOrder.aggregate({
      where: { status: 'PLACED', billing: { in: ['WARRANTY', 'GOODWILL'] }, placedAt: { gte: since } },
      _count: { _all: true },
      _sum: { listValue: true },
    }),
    db.partsOrder.aggregate({
      where: { status: 'PLACED', paymentStatus: 'PAID', paidAt: { gte: since } },
      _sum: { total: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title="Parts orders"
        description="Every spare part going out to a customer, priced — paid for, under warranty or as goodwill. Each order creates its warehouse dispatch."
        actions={
          <>
            <SearchField action="/parts-orders" defaultValue={q} hidden={{ view, billing }} placeholder="Order, customer, part…" />
            <ButtonLink href="/parts-orders/new" size="sm">
              <ShoppingCart className="h-4 w-4" />
              New parts order
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Awaiting payment"
          value={awaiting._count._all}
          sub={awaiting._count._all ? `${formatPrice(awaiting._sum.total ?? 0)} to collect` : 'Nothing to chase'}
          tone={awaiting._count._all ? 'amber' : 'moss'}
          icon={<CreditCard className="h-4 w-4" />}
          href="/parts-orders?view=payment"
        />
        <Stat
          label="With the warehouse"
          value={inFulfilment}
          sub="Placed, not yet sent"
          tone={inFulfilment ? 'ember' : 'moss'}
          icon={<PackageCheck className="h-4 w-4" />}
          href="/dispatch"
        />
        <Stat
          label="Spares revenue"
          value={formatMoney(paidRevenue._sum.total ?? 0)}
          sub="Paid in the last 30 days, inc VAT"
          tone="moss"
          icon={<PoundSterling className="h-4 w-4" />}
        />
        <Stat
          label="Warranty and goodwill"
          value={formatMoney(freeOfCharge._sum.listValue ?? 0)}
          sub={`${freeOfCharge._count._all} orders sent free in 30 days, at list price`}
          tone="sky"
          icon={<ShieldCheck className="h-4 w-4" />}
          href="/parts-orders?view=all&billing=WARRANTY"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs
          basePath="/parts-orders"
          paramKey="view"
          active={view}
          params={{ billing, q }}
          options={[
            { value: 'open', label: 'In progress' },
            { value: 'payment', label: 'Awaiting payment', count: awaiting._count._all },
            { value: 'done', label: 'Delivered' },
            { value: 'cancelled', label: 'Cancelled' },
            { value: 'all', label: 'Everything' },
          ]}
        />
        <span className="hidden h-5 w-px bg-stone sm:block" />
        <FilterTabs
          basePath="/parts-orders"
          paramKey="billing"
          active={billing}
          params={{ view, q }}
          options={[
            { value: '', label: 'Any billing' },
            ...BILLING_TYPES.map((b) => ({ value: b, label: BILLING_META[b].label })),
          ]}
        />
      </div>

      <Card>
        <CardHeader eyebrow={`${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`} title="Orders" description="Newest first." />
        {orders.length ? (
          <ul className="divide-y divide-stone/60">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/parts-orders/${o.id}`} className="block px-5 py-4 transition-colors hover:bg-sand/40">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-2xs text-slate">{o.ref}</span>
                        <BillingChip value={o.billing} dot={false} />
                        {o.status === 'CANCELLED' ? (
                          <Badge tone="clay" dot>Cancelled</Badge>
                        ) : (
                          <>
                            {o.paymentStatus !== 'NOT_REQUIRED' && <PaymentChip value={o.paymentStatus} />}
                            {o.dispatch && <DispatchStatusChip value={o.dispatch.status} />}
                          </>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm font-medium text-ink">{o.customer.name}</p>
                      <p className="mt-0.5 truncate text-2xs text-slate">
                        {o.lines.map((l) => `${l.qty} × ${l.description}`).join(' · ')}
                      </p>
                      <p className="mt-1 text-2xs text-slate/80">
                        {o.createdBy.name} · {relativeTime(o.placedAt)}
                        {o.dispatch?.trackingRef ? ` · ${o.dispatch.carrier} ${o.dispatch.trackingRef}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-ink">
                        {o.billing === 'CHARGEABLE' ? formatPrice(o.total) : 'No charge'}
                      </p>
                      {o.billing !== 'CHARGEABLE' && (
                        <p className="text-2xs tabular-nums text-slate">{formatPrice(o.listValue)} at list</p>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<ShoppingCart className="h-5 w-5" />}
            title="No parts orders here"
            description="Nothing matches this view. Orders appear here the moment they are placed."
            action={
              <ButtonLink href="/parts-orders/new" size="sm" variant="secondary">
                Place a parts order
              </ButtonLink>
            }
          />
        )}
      </Card>
    </>
  );
}
