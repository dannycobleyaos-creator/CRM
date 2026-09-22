import type { Metadata } from 'next';
import { Mail, Phone } from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { TEAMS, TICKET_ACTIVE_STATUSES } from '@/lib/constants';
import { relativeTime } from '@/lib/utils';

import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { RoleChip } from '@/components/status-chips';

export const metadata: Metadata = { title: 'Team directory' };
export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  await requireUser();

  const users = await db.user.findMany({
    where: { isActive: true },
    orderBy: [{ team: 'asc' }, { name: 'asc' }],
    include: {
      _count: { select: { assignedTasks: true, assignedTickets: true } },
    },
  });

  const [openTaskRows, openCaseRows] = await Promise.all([
    db.task.groupBy({
      by: ['assigneeId'],
      where: { status: { not: 'DONE' } },
      _count: { _all: true },
    }),
    db.ticket.groupBy({
      by: ['assigneeId'],
      where: { status: { in: [...TICKET_ACTIVE_STATUSES] } },
      _count: { _all: true },
    }),
  ]);

  const openTasks = new Map(openTaskRows.map((r) => [r.assigneeId, r._count._all]));
  const openCases = new Map(openCaseRows.map((r) => [r.assigneeId, r._count._all]));

  return (
    <>
      <PageHeader
        eyebrow="Who does what"
        title="Team directory"
        description="Extensions, roles and live workload — so you know who to hand something to before you ask."
      />

      {TEAMS.map((team) => {
        const members = users.filter((u) => u.team === team);
        if (!members.length) return null;

        return (
          <Card key={team}>
            <CardHeader
              eyebrow={`${members.length} ${members.length === 1 ? 'person' : 'people'}`}
              title={team}
            />
            <div className="grid gap-px bg-stone/60 sm:grid-cols-2 xl:grid-cols-3">
              {members.map((u) => (
                <div key={u.id} className="bg-white p-5">
                  <div className="flex items-start gap-3">
                    <Avatar name={u.name} tone={u.avatarTone} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm font-medium text-ink">{u.name}</p>
                      <p className="truncate text-2xs text-slate">{u.jobTitle}</p>
                      <div className="mt-1.5">
                        <RoleChip value={u.role} dot={false} />
                      </div>
                    </div>
                  </div>

                  <dl className="mt-4 space-y-1.5 text-2xs">
                    {u.phoneExt && (
                      <div className="flex items-center gap-2 text-slate">
                        <Phone className="h-3 w-3" />
                        <span>
                          Ext. <span className="font-medium text-ink">{u.phoneExt}</span>
                          {u.aircallId && <span className="text-slate/60"> · Aircall {u.aircallId}</span>}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-slate">
                      <Mail className="h-3 w-3 shrink-0" />
                      <a href={`mailto:${u.email}`} className="truncate hover:text-ember-dark">
                        {u.email}
                      </a>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-stone/60 pt-3">
                    <Badge tone={(openTasks.get(u.id) ?? 0) > 12 ? 'clay' : 'slate'} dot={false}>
                      {openTasks.get(u.id) ?? 0} open tasks
                    </Badge>
                    <Badge tone={(openCases.get(u.id) ?? 0) > 8 ? 'clay' : 'slate'} dot={false}>
                      {openCases.get(u.id) ?? 0} open cases
                    </Badge>
                  </div>

                  <p className="mt-2 text-2xs text-slate/70">
                    Last signed in {relativeTime(u.lastLoginAt)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </>
  );
}
