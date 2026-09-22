import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchX } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatMoney, relativeTime } from '@/lib/utils';

import { Card, CardHeader, EmptyState } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { GlobalSearch } from '@/components/nav/global-search';
import {
  CustomerStageChip,
  DispatchStatusChip,
  OrderStatusChip,
  TicketStatusChip,
} from '@/components/status-chips';

export const metadata: Metadata = { title: 'Search' };
export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();
  const { q } = await searchParams;
  const term = q?.trim() ?? '';

  // One box, four record types — the point being that an agent never has to
  // know which system a reference belongs to.
  const [customers, tickets, orders, dispatches] = term
    ? await Promise.all([
        db.customer.findMany({
          where: {
            OR: [
              { name: { contains: term } },
              { ref: { contains: term } },
              { email: { contains: term } },
              { phone: { contains: term } },
              { postcode: { contains: term } },
            ],
          },
          take: 12,
          include: { owner: { select: { name: true } } },
        }),
        db.ticket.findMany({
          where: { OR: [{ ref: { contains: term } }, { subject: { contains: term } }] },
          take: 12,
          include: { customer: { select: { name: true } } },
          orderBy: { openedAt: 'desc' },
        }),
        db.order.findMany({
          where: { OR: [{ ref: { contains: term } }, { productLine: { contains: term } }] },
          take: 12,
          include: { customer: { select: { id: true, name: true } } },
        }),
        db.partRequest.findMany({
          where: { OR: [{ ref: { contains: term } }, { trackingRef: { contains: term } }] },
          take: 12,
          include: { customer: { select: { id: true, name: true } } },
        }),
      ])
    : [[], [], [], []];

  const total = customers.length + tickets.length + orders.length + dispatches.length;

  return (
    <>
      <PageHeader
        eyebrow="Find anything"
        title={term ? `Results for “${term}”` : 'Search'}
        description="Customers, cases, orders and dispatches — one box for all of them."
        actions={<GlobalSearch defaultValue={term} />}
      />

      {!term ? (
        <Card>
          <EmptyState
            icon={<SearchX className="h-5 w-5" />}
            title="Type something to search"
            description="A name, a postcode, a case reference like CASE-4231, an order number or a courier tracking reference."
          />
        </Card>
      ) : total === 0 ? (
        <Card>
          <EmptyState
            icon={<SearchX className="h-5 w-5" />}
            title={`Nothing matches “${term}”`}
            description="Check the spelling, or try just the surname or postcode."
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {customers.length > 0 && (
            <Card>
              <CardHeader eyebrow={`${customers.length} found`} title="Customers" />
              <ul className="divide-y divide-stone/60">
                {customers.map((c) => (
                  <li key={c.id}>
                    <Link href={`/customers/${c.id}`} className="block px-5 py-3 hover:bg-sand/40">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium text-ink">{c.name}</span>
                        <CustomerStageChip value={c.stage} />
                      </div>
                      <p className="mt-0.5 text-2xs text-slate">
                        <span className="font-mono">{c.ref}</span>
                        {c.postcode ? ` · ${c.postcode}` : ''}
                        {c.owner ? ` · ${c.owner.name}` : ''}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {tickets.length > 0 && (
            <Card>
              <CardHeader eyebrow={`${tickets.length} found`} title="Cases" />
              <ul className="divide-y divide-stone/60">
                {tickets.map((t) => (
                  <li key={t.id}>
                    <Link href={`/cases/${t.id}`} className="block px-5 py-3 hover:bg-sand/40">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium text-ink">{t.subject}</span>
                        <TicketStatusChip value={t.status} />
                      </div>
                      <p className="mt-0.5 text-2xs text-slate">
                        <span className="font-mono">{t.ref}</span> · {t.customer.name} · opened{' '}
                        {relativeTime(t.openedAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {orders.length > 0 && (
            <Card>
              <CardHeader eyebrow={`${orders.length} found`} title="Orders" />
              <ul className="divide-y divide-stone/60">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/customers/${o.customer.id}`}
                      className="block px-5 py-3 hover:bg-sand/40"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium text-ink">
                          {o.productLine}
                        </span>
                        <OrderStatusChip value={o.status} />
                      </div>
                      <p className="mt-0.5 text-2xs text-slate">
                        <span className="font-mono">{o.ref}</span> · {o.customer.name} ·{' '}
                        {formatMoney(o.value)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {dispatches.length > 0 && (
            <Card>
              <CardHeader eyebrow={`${dispatches.length} found`} title="Dispatches" />
              <ul className="divide-y divide-stone/60">
                {dispatches.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/customers/${d.customer.id}`}
                      className="block px-5 py-3 hover:bg-sand/40"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium text-ink">
                          {d.customer.name}
                        </span>
                        <DispatchStatusChip value={d.status} />
                      </div>
                      <p className="mt-0.5 text-2xs text-slate">
                        <span className="font-mono">{d.ref}</span>
                        {d.trackingRef ? ` · ${d.carrier} ${d.trackingRef}` : ''}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
