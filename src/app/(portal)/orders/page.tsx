import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { CalendarClock, ClipboardList, Hammer, PoundSterling, Truck } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { ORDER_ACTIVE_STATUSES, PERGOLA_COLOUR_META, type PergolaColour } from '@/lib/constants';
import { addDays, cn, endOfDay, formatDate, formatMoney, formatTime, isToday, relativeTime, startOfDay } from '@/lib/utils';

import { Card, CardHeader, EmptyState } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Stat } from '@/components/ui/stat';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { SearchField } from '@/components/ui/search-field';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { OrderDateChip, OrderStatusChip } from '@/components/status-chips';
import { NewOrderForm } from '@/components/orders/new-order-form';

export const metadata: Metadata = { title: 'Orders' };
export const dynamic = 'force-dynamic';

type Search = { view?: string; who?: string; q?: string; new?: string; customerId?: string };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const { view = 'active', who = '', q, new: openNew, customerId } = await searchParams;
  const now = new Date();

  const where: Prisma.OrderWhereInput = {};
  if (view === 'active') where.status = { in: [...ORDER_ACTIVE_STATUSES] };
  else if (view === 'quotes') where.status = 'QUOTE';
  else if (view === 'installed') where.status = 'INSTALLED';
  else if (view === 'cancelled') where.status = 'CANCELLED';
  if (who === 'mine') where.ownerId = user.id;
  if (q) {
    where.OR = [
      { ref: { contains: q } },
      { productLine: { contains: q } },
      { customer: { name: { contains: q } } },
      { customer: { postcode: { contains: q } } },
    ];
  }

  const agendaEnd = endOfDay(addDays(now, 14));
  const weekEnd = endOfDay(addDays(now, 7));

  const [orders, agenda, pipeline, deliveriesThisWeek, installsThisWeek, overdueDates, customers, products, team] =
    await Promise.all([
      db.order.findMany({
        where,
        orderBy: { orderedAt: 'desc' },
        take: 200,
        include: {
          customer: { select: { id: true, name: true, city: true } },
          owner: { select: { name: true, avatarTone: true } },
          keyDates: {
            where: { doneAt: null },
            orderBy: { dueAt: 'asc' },
            take: 1,
            select: { label: true, kind: true, dueAt: true },
          },
        },
      }),
      // The diary: everything overdue, then the next fortnight, across every order.
      db.orderDate.findMany({
        where: {
          doneAt: null,
          dueAt: { lte: agendaEnd },
          order: { status: { not: 'CANCELLED' } },
          ...(who === 'mine' ? { ownerId: user.id } : {}),
        },
        orderBy: { dueAt: 'asc' },
        take: 40,
        include: {
          owner: { select: { name: true, avatarTone: true } },
          order: { select: { id: true, ref: true, customer: { select: { name: true, city: true } } } },
        },
      }),
      db.order.aggregate({
        where: { status: { in: [...ORDER_ACTIVE_STATUSES] } },
        _count: { _all: true },
        _sum: { value: true },
      }),
      db.orderDate.count({ where: { kind: 'DELIVERY', doneAt: null, dueAt: { gte: startOfDay(now), lte: weekEnd } } }),
      db.orderDate.count({ where: { kind: 'INSTALL', doneAt: null, dueAt: { gte: startOfDay(now), lte: weekEnd } } }),
      db.orderDate.count({ where: { doneAt: null, dueAt: { lt: now }, order: { status: { not: 'CANCELLED' } } } }),
      db.customer.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, ref: true }, take: 500 }),
      db.product.findMany({ where: { isActive: true }, orderBy: { basePrice: 'asc' }, select: { id: true, name: true, sizeSpec: true, basePrice: true } }),
      db.user.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    ]);

  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title="Orders"
        description="Every pergola order, where it has got to and the next date that matters on it."
        actions={
          <SearchField action="/orders" defaultValue={q} hidden={{ view, who }} placeholder="Order, customer, postcode…" />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Orders in progress"
          value={pipeline._count._all}
          sub={`${formatMoney(pipeline._sum.value ?? 0)} between deposit and install`}
          tone="ember"
          icon={<PoundSterling className="h-4 w-4" />}
          href="/orders?view=active"
        />
        <Stat
          label="Deliveries this week"
          value={deliveriesThisWeek}
          sub="Pallets due in the next 7 days"
          tone="sky"
          icon={<Truck className="h-4 w-4" />}
        />
        <Stat
          label="Installs this week"
          value={installsThisWeek}
          sub="Booked in the next 7 days"
          tone="moss"
          icon={<Hammer className="h-4 w-4" />}
        />
        <Stat
          label="Dates missed"
          value={overdueDates}
          sub="Key dates past due and not ticked off"
          tone={overdueDates ? 'clay' : 'moss'}
          icon={<CalendarClock className="h-4 w-4" />}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <FilterTabs
            basePath="/orders"
            paramKey="view"
            active={view}
            params={{ who, q }}
            options={[
              { value: 'active', label: 'In progress' },
              { value: 'quotes', label: 'Quotes' },
              { value: 'installed', label: 'Installed' },
              { value: 'cancelled', label: 'Cancelled' },
              { value: 'all', label: 'Everything' },
            ]}
          />
          <span className="hidden h-5 w-px bg-stone sm:block" />
          <FilterTabs
            basePath="/orders"
            paramKey="who"
            active={who}
            params={{ view, q }}
            options={[
              { value: '', label: 'Everyone' },
              { value: 'mine', label: 'Mine' },
            ]}
          />
        </div>
        <NewOrderForm
          customers={customers}
          products={products}
          team={team}
          defaultCustomerId={customerId}
          defaultOpen={openNew === '1'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            eyebrow={`${orders.length} ${orders.length === 1 ? 'order' : 'orders'}`}
            title="Orders"
            description="Newest first. The next date column is the first key date not yet ticked off."
          />
          {orders.length ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Status</th>
                    <th className="hidden md:table-cell">Next date</th>
                    <th className="hidden lg:table-cell text-right">Value</th>
                    <th className="hidden sm:table-cell">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => {
                    const next = o.keyDates[0];
                    const late = next && next.dueAt < now;
                    const colour = PERGOLA_COLOUR_META[o.colour as PergolaColour];
                    return (
                      <tr key={o.id}>
                        <td>
                          <Link href={`/orders/${o.id}`} className="group block min-w-[13rem]">
                            <span className="block text-sm font-medium text-ink group-hover:text-ember-dark">{o.customer.name}</span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-2xs text-slate">
                              <span className="font-mono">{o.ref}</span>
                              <span aria-hidden>·</span>
                              {colour && (
                                <span className="h-2.5 w-2.5 rounded-full ring-1 ring-stone" style={{ background: colour.swatch }} title={colour.label} />
                              )}
                              <span className="truncate">{o.productLine.replace('Hygge™ ', '')}</span>
                            </span>
                          </Link>
                        </td>
                        <td><OrderStatusChip value={o.status} /></td>
                        <td className="hidden md:table-cell">
                          {next ? (
                            <span className="text-xs">
                              <span className={late ? 'font-medium text-clay' : 'text-ink'}>{next.label}</span>
                              <span className={cn('block text-2xs', late ? 'text-clay' : 'text-slate')}>
                                {formatDate(next.dueAt)} · {relativeTime(next.dueAt, now)}
                              </span>
                            </span>
                          ) : (
                            <span className="text-2xs text-slate">—</span>
                          )}
                        </td>
                        <td className="hidden lg:table-cell text-right text-sm tabular-nums text-ink">{formatMoney(o.value)}</td>
                        <td className="hidden sm:table-cell">
                          {o.owner ? (
                            <span className="inline-flex items-center gap-1.5 text-2xs text-slate">
                              <Avatar name={o.owner.name} tone={o.owner.avatarTone} size="xs" />
                              {o.owner.name.split(' ')[0]}
                            </span>
                          ) : (
                            <span className="text-2xs text-slate">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="No orders here" description="Nothing matches this view." />
          )}
        </Card>

        <Card className="self-start">
          <CardHeader
            eyebrow={who === 'mine' ? 'Your diary' : 'Team diary'}
            title="Coming up"
            description="Overdue first, then the next two weeks — deliveries, installs, payments and calls."
          />
          {agenda.length ? (
            <ul className="divide-y divide-stone/60">
              {agenda.map((d) => {
                const overdue = d.dueAt < now;
                const today = !overdue && isToday(d.dueAt);
                return (
                  <li key={d.id}>
                    <Link href={`/orders/${d.order.id}`} className="flex gap-3 px-5 py-3 hover:bg-sand/40">
                      <div className={cn('w-12 shrink-0 text-center', overdue ? 'text-clay' : today ? 'text-amber' : 'text-ink')}>
                        <p className="text-2xs font-semibold uppercase tracking-brand">
                          {d.dueAt.toLocaleDateString('en-GB', { month: 'short' })}
                        </p>
                        <p className="font-display text-xl font-light leading-none">{d.dueAt.getDate()}</p>
                        <p className="mt-0.5 text-2xs text-slate">{formatTime(d.dueAt)}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <OrderDateChip value={d.kind} dot={false} />
                          {overdue && <Badge tone="clay" dot>Overdue</Badge>}
                          {today && <Badge tone="amber" dot>Today</Badge>}
                        </div>
                        <p className="mt-1 truncate text-xs font-medium text-ink">{d.order.customer.name}</p>
                        <p className="truncate text-2xs text-slate">
                          {d.label} · {d.order.ref}
                          {d.order.customer.city ? ` · ${d.order.customer.city}` : ''}
                        </p>
                      </div>
                      {d.owner && <Avatar name={d.owner.name} tone={d.owner.avatarTone} size="xs" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={<CalendarClock className="h-5 w-5" />} title="Nothing due" description="No open key dates in the next two weeks." />
          )}
        </Card>
      </div>
    </>
  );
}
