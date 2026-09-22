import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { Inbox } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { TICKET_ACTIVE_STATUSES, TICKET_ON_US_STATUSES } from '@/lib/constants';

import { Card, CardHeader, EmptyState } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { SearchField } from '@/components/ui/search-field';
import { CaseTable, caseRowSelect } from '@/components/work/case-row';

export const metadata: Metadata = { title: 'Cases' };
export const dynamic = 'force-dynamic';

type Search = { filter?: string; q?: string; status?: string };

/** Turns the URL into a query. Each view answers one question an agent asks. */
function buildWhere(filter: string, userId: string, q?: string, status?: string) {
  const where: Prisma.TicketWhereInput = {};

  switch (filter) {
    case 'mine':
      where.assigneeId = userId;
      where.status = { in: [...TICKET_ACTIVE_STATUSES] };
      break;
    case 'unassigned':
      where.assigneeId = null;
      where.status = { in: [...TICKET_ACTIVE_STATUSES] };
      break;
    case 'breached':
      where.status = { in: [...TICKET_ON_US_STATUSES] };
      where.dueAt = { lt: new Date() };
      break;
    case 'resolved':
      where.status = { in: ['RESOLVED', 'CLOSED'] };
      break;
    default:
      where.status = { in: [...TICKET_ACTIVE_STATUSES] };
  }

  if (status) where.status = status as Prisma.TicketWhereInput['status'];

  if (q) {
    where.OR = [
      { ref: { contains: q } },
      { subject: { contains: q } },
      { customer: { name: { contains: q } } },
      { customer: { ref: { contains: q } } },
    ];
  }

  return where;
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await requireUser();
  const { filter = 'open', q, status } = await searchParams;

  const now = new Date();
  const [cases, counts] = await Promise.all([
    db.ticket.findMany({
      where: buildWhere(filter, user.id, q, status),
      select: caseRowSelect,
      orderBy: [{ dueAt: 'asc' }, { openedAt: 'desc' }],
      take: 100,
    }),
    Promise.all([
      db.ticket.count({ where: { status: { in: [...TICKET_ACTIVE_STATUSES] } } }),
      db.ticket.count({
        where: { assigneeId: user.id, status: { in: [...TICKET_ACTIVE_STATUSES] } },
      }),
      db.ticket.count({
        where: { assigneeId: null, status: { in: [...TICKET_ACTIVE_STATUSES] } },
      }),
      db.ticket.count({
        where: { status: { in: [...TICKET_ON_US_STATUSES] }, dueAt: { lt: now } },
      }),
    ]),
  ]);

  const [openCount, mineCount, unassignedCount, breachedCount] = counts;

  return (
    <>
      <PageHeader
        eyebrow="One inbox"
        title="Cases"
        description="Every phone call, live chat and email as a single queue — with an owner and a deadline on each one."
        actions={<SearchField action="/cases" defaultValue={q} hidden={{ filter }} placeholder="Search cases or customers" />}
      />

      <FilterTabs
        basePath="/cases"
        paramKey="filter"
        active={filter}
        params={{ q }}
        options={[
          { value: 'open', label: 'All open', count: openCount },
          { value: 'mine', label: 'With me', count: mineCount },
          { value: 'unassigned', label: 'Unassigned', count: unassignedCount },
          { value: 'breached', label: 'Past deadline', count: breachedCount },
          { value: 'resolved', label: 'Resolved' },
        ]}
      />

      <Card>
        <CardHeader
          eyebrow={`${cases.length} ${cases.length === 1 ? 'case' : 'cases'}`}
          title={
            filter === 'mine' ? 'Assigned to you'
            : filter === 'unassigned' ? 'Nobody has picked these up'
            : filter === 'breached' ? 'Past the promised response time'
            : filter === 'resolved' ? 'Resolved and closed'
            : 'Open cases'
          }
          description={
            filter === 'unassigned'
              ? 'Oldest first. Claiming one puts it in your name and starts the clock on you.'
              : 'Sorted by deadline — the most urgent is always at the top.'
          }
        />
        {cases.length ? (
          <CaseTable cases={cases} allowClaim={filter === 'unassigned'} />
        ) : (
          <EmptyState
            icon={<Inbox className="h-5 w-5" />}
            title="Nothing here"
            description={
              q
                ? `No cases match “${q}”. Try a case reference, a customer name or a postcode.`
                : 'That queue is empty. Nice work.'
            }
          />
        )}
      </Card>
    </>
  );
}
