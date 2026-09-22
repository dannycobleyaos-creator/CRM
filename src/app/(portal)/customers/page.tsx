import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { Building2 } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { CUSTOMER_STAGES, CUSTOMER_STAGE_META } from '@/lib/constants';
import { formatMoney, parseTags } from '@/lib/utils';

import { Card, CardHeader, EmptyState } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { SearchField } from '@/components/ui/search-field';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { CustomerStageChip, SourceChip } from '@/components/status-chips';

export const metadata: Metadata = { title: 'Customers' };
export const dynamic = 'force-dynamic';

type Search = { stage?: string; q?: string; owner?: string };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await requireUser();
  const { stage = '', q, owner } = await searchParams;

  const where: Prisma.CustomerWhereInput = {};
  if (stage) where.stage = stage;
  if (owner === 'mine') where.ownerId = user.id;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { ref: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
      { postcode: { contains: q } },
      { city: { contains: q } },
    ];
  }

  const [customers, stageCounts, mineCount] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 120,
      include: {
        owner: { select: { name: true, avatarTone: true } },
        orders: { select: { value: true, status: true } },
        _count: { select: { tickets: true, orders: true } },
      },
    }),
    db.customer.groupBy({ by: ['stage'], _count: { _all: true } }),
    db.customer.count({ where: { ownerId: user.id } }),
  ]);

  const countFor = (s: string) =>
    stageCounts.find((row) => row.stage === s)?._count._all ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="One record each"
        title="Customers"
        description="Contact details, orders, cases and every conversation — so nobody has to ask around before they pick up the phone."
        actions={
          <SearchField
            action="/customers"
            defaultValue={q}
            hidden={{ stage, owner }}
            placeholder="Name, reference, postcode…"
          />
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs
          basePath="/customers"
          paramKey="stage"
          active={stage}
          params={{ q, owner }}
          options={[
            { value: '', label: 'All stages' },
            ...CUSTOMER_STAGES.map((s) => ({
              value: s,
              label: CUSTOMER_STAGE_META[s].label,
              count: countFor(s),
            })),
          ]}
        />
        <span className="hidden h-5 w-px bg-stone sm:block" />
        <FilterTabs
          basePath="/customers"
          paramKey="owner"
          active={owner ?? ''}
          params={{ q, stage }}
          options={[
            { value: '', label: 'Everyone' },
            { value: 'mine', label: 'My accounts', count: mineCount },
          ]}
        />
      </div>

      <Card>
        <CardHeader
          eyebrow={`${customers.length} shown`}
          title="Customer list"
          description="Most recently touched first."
        />
        {customers.length ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-[30%]">Customer</th>
                  <th>Stage</th>
                  <th className="hidden lg:table-cell">Source</th>
                  <th className="hidden md:table-cell">Orders</th>
                  <th className="hidden md:table-cell">Value</th>
                  <th className="hidden xl:table-cell">Cases</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => {
                  const value = c.orders
                    .filter((o) => o.status !== 'CANCELLED')
                    .reduce((sum, o) => sum + o.value, 0);

                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/customers/${c.id}`} className="group block min-w-0">
                          <span className="block truncate text-sm font-medium text-ink transition-colors group-hover:text-ember-dark">
                            {c.name}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2xs text-slate">
                            <span className="font-mono">{c.ref}</span>
                            {c.city && <span>· {c.city}</span>}
                            {parseTags(c.tags).map((tag) => (
                              <Badge key={tag} tone="ember" dot={false}>
                                {tag}
                              </Badge>
                            ))}
                          </span>
                        </Link>
                      </td>
                      <td>
                        <CustomerStageChip value={c.stage} />
                      </td>
                      <td className="hidden lg:table-cell">
                        <SourceChip value={c.source} dot={false} />
                      </td>
                      <td className="hidden md:table-cell text-sm tabular-nums text-slate">
                        {c._count.orders}
                      </td>
                      <td className="hidden md:table-cell text-sm tabular-nums text-ink">
                        {value ? formatMoney(value) : '—'}
                      </td>
                      <td className="hidden xl:table-cell text-sm tabular-nums text-slate">
                        {c._count.tickets}
                      </td>
                      <td>
                        {c.owner ? (
                          <span className="flex items-center gap-2">
                            <Avatar name={c.owner.name} tone={c.owner.avatarTone} size="xs" />
                            <span className="hidden text-xs text-slate sm:inline">
                              {c.owner.name.split(' ')[0]}
                            </span>
                          </span>
                        ) : (
                          <span className="text-2xs text-clay">Unowned</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Building2 className="h-5 w-5" />}
            title="No customers match"
            description={q ? `Nothing found for “${q}”.` : 'Try a different stage filter.'}
          />
        )}
      </Card>
    </>
  );
}
