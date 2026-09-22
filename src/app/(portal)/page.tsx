import Link from 'next/link';
import {
  AlarmClock,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Inbox,
  Megaphone,
  PackageCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';

import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { getDaySummary } from '@/lib/metrics';
import {
  DISPATCH_OPEN_STATUSES,
  PRIORITY_WEIGHT,
  TICKET_ON_US_STATUSES,
  type Priority,
} from '@/lib/constants';
import { endOfDay, percent, relativeTime } from '@/lib/utils';

import { Card, CardBody, CardHeader, EmptyState } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Stat } from '@/components/ui/stat';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { TaskItem, taskItemSelect } from '@/components/work/task-item';
import { CaseTable, caseRowSelect } from '@/components/work/case-row';
import {
  AnnouncementCategoryChip,
  DispatchStatusChip,
  PriorityChip,
} from '@/components/status-chips';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireUser();
  const now = new Date();
  const summary = await getDaySummary(user.id, user.dailyTarget);

  const [myTasks, myCases, unassignedCases, announcements, reads, myDispatches] =
    await Promise.all([
      db.task.findMany({
        where: {
          assigneeId: user.id,
          status: { not: 'DONE' },
          OR: [{ dueAt: { lte: endOfDay(now) } }, { priority: { in: ['URGENT', 'HIGH'] } }],
        },
        select: taskItemSelect,
        orderBy: [{ dueAt: 'asc' }],
        take: 40,
      }),
      db.ticket.findMany({
        where: { assigneeId: user.id, status: { in: [...TICKET_ON_US_STATUSES] } },
        select: caseRowSelect,
        orderBy: [{ dueAt: 'asc' }],
        take: 8,
      }),
      db.ticket.findMany({
        where: { assigneeId: null, status: 'NEW' },
        select: caseRowSelect,
        orderBy: [{ openedAt: 'asc' }],
        take: 5,
      }),
      db.announcement.findMany({
        orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
        take: 4,
        include: { author: { select: { name: true, avatarTone: true } } },
      }),
      db.announcementRead.findMany({
        where: { userId: user.id },
        select: { announcementId: true },
      }),
      db.partRequest.findMany({
        where: {
          status: { in: [...DISPATCH_OPEN_STATUSES] },
          OR: [{ requestedById: user.id }, ...(user.team === 'Warehouse' ? [{}] : [])],
        },
        orderBy: [{ dueAt: 'asc' }],
        take: 5,
        include: {
          customer: { select: { id: true, name: true } },
          lines: { select: { qty: true } },
        },
      }),
    ]);

  // "Clear the red first" has to be literally true, so the deadline outranks
  // the priority flag: overdue, then due today, then everything else by urgency.
  const bucket = (dueAt: Date | null) => {
    if (dueAt && dueAt < now) return 0; // overdue
    if (dueAt && dueAt <= endOfDay(now)) return 1; // due today
    return 2;
  };

  const nextUp = [...myTasks].sort((a, b) => {
    const ba = bucket(a.dueAt);
    const bb = bucket(b.dueAt);
    if (ba !== bb) return ba - bb;

    const pa = PRIORITY_WEIGHT[a.priority as Priority] ?? 9;
    const pb = PRIORITY_WEIGHT[b.priority as Priority] ?? 9;
    if (pa !== pb) return pa - pb;

    return (a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
      (b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER);
  });

  const readIds = new Set(reads.map((r) => r.announcementId));
  const targetPct = Math.min(100, percent(summary.tasksDone, Math.max(1, summary.dailyTarget)));

  return (
    <>
      <PageHeader
        eyebrow={now.toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
        title="My day"
        description="Everything waiting on you, in the order it needs doing. Clear the red first."
        actions={
          <>
            <ButtonLink href="/board" variant="secondary" size="sm">
              Full work board
            </ButtonLink>
            <ButtonLink href="/cases?filter=unassigned" size="sm">
              <Inbox className="h-4 w-4" />
              Unassigned queue
            </ButtonLink>
          </>
        }
      />

      {/* Progress against today's target */}
      <Card className="border-l-4 border-l-ember">
        <CardBody className="flex flex-wrap items-center justify-between gap-5">
          <div className="min-w-0">
            <p className="brand-eyebrow">Today&apos;s progress</p>
            <p className="mt-1.5 font-display text-xl font-light text-ink">
              {summary.tasksDone} of {summary.dailyTarget} actioned
              {summary.tasksDone >= summary.dailyTarget && (
                <span className="ml-2 inline-flex items-center gap-1 align-middle text-sm text-moss">
                  <Sparkles className="h-4 w-4" /> target met
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-slate">
              {summary.tasksOverdue > 0
                ? `${summary.tasksOverdue} overdue ${summary.tasksOverdue === 1 ? 'task is' : 'tasks are'} holding you up.`
                : 'Nothing overdue — keep it that way.'}
            </p>
          </div>

          <div className="w-full max-w-sm">
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-sand"
              role="progressbar"
              aria-valuenow={targetPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progress towards today's target"
            >
              <div
                className="h-full rounded-full bg-ember transition-[width] duration-500"
                style={{ width: `${targetPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-right text-2xs text-slate">{targetPct}% of daily target</p>
          </div>
        </CardBody>
      </Card>

      {/* The six numbers */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Stat
          label="Overdue"
          value={summary.tasksOverdue}
          sub="Tasks past their due date"
          tone={summary.tasksOverdue ? 'clay' : 'moss'}
          icon={<TriangleAlert className="h-4 w-4" />}
          href="/board?due=overdue"
        />
        <Stat
          label="Due today"
          value={summary.tasksDueToday}
          sub="Land these before you leave"
          tone={summary.tasksDueToday ? 'amber' : 'moss'}
          icon={<CalendarDays className="h-4 w-4" />}
          href="/board?due=today"
        />
        <Stat
          label="Cases with me"
          value={summary.casesWithMe}
          sub="Waiting on your reply"
          tone={summary.casesWithMe ? 'ember' : 'moss'}
          icon={<Inbox className="h-4 w-4" />}
          href="/cases?filter=mine"
        />
        <Stat
          label="SLA breaching"
          value={summary.casesBreaching}
          sub="Past the promised response"
          tone={summary.casesBreaching ? 'clay' : 'moss'}
          icon={<AlarmClock className="h-4 w-4" />}
          href="/cases?filter=breached"
        />
        <Stat
          label="Parts to send"
          value={summary.dispatchesOpen}
          sub="Open dispatch requests"
          tone={summary.dispatchesOpen ? 'sky' : 'moss'}
          icon={<PackageCheck className="h-4 w-4" />}
          href="/dispatch"
        />
        <Stat
          label="Unread notices"
          value={summary.unreadAnnouncements}
          sub="From the announcement board"
          tone={summary.unreadAnnouncements ? 'amber' : 'moss'}
          icon={<Megaphone className="h-4 w-4" />}
          href="/announcements"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Main column */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              eyebrow="Work queue"
              title="Do this next"
              description="Your urgent and due-today tasks, highest priority at the top."
              action={
                <ButtonLink href="/board" variant="ghost" size="sm">
                  Open board <ArrowUpRight className="h-3.5 w-3.5" />
                </ButtonLink>
              }
            />
            {nextUp.length ? (
              <ul className="divide-y divide-stone/60">
                {nextUp.slice(0, 8).map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<CheckCircle2 className="h-5 w-5 text-moss" />}
                title="Nothing outstanding"
                description="No urgent or due-today tasks are assigned to you. Pick something up from the board or the unassigned queue."
                action={
                  <ButtonLink href="/cases?filter=unassigned" size="sm" variant="secondary">
                    See unassigned cases
                  </ButtonLink>
                }
              />
            )}
          </Card>

          <Card>
            <CardHeader
              eyebrow="Cases"
              title="Open with you"
              description="Conversations where the customer is waiting on us."
              action={
                <ButtonLink href="/cases?filter=mine" variant="ghost" size="sm">
                  All my cases <ArrowUpRight className="h-3.5 w-3.5" />
                </ButtonLink>
              }
            />
            {myCases.length ? (
              <CaseTable cases={myCases} showAssignee={false} />
            ) : (
              <EmptyState
                icon={<Inbox className="h-5 w-5" />}
                title="No cases with you"
                description="Everything assigned to you is resolved or waiting on someone else."
              />
            )}
          </Card>

          {unassignedCases.length > 0 && (
            <Card className="border-clay/30">
              <CardHeader
                eyebrow="Needs an owner"
                title="Nobody has picked these up"
                description="The oldest unclaimed cases. One click puts it in your name."
              />
              <CaseTable cases={unassignedCases} allowClaim />
            </Card>
          )}
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              eyebrow="Noticeboard"
              title="Announcements"
              action={
                <ButtonLink href="/announcements" variant="ghost" size="sm">
                  All
                </ButtonLink>
              }
            />
            <ul className="divide-y divide-stone/60">
              {announcements.map((a) => {
                const unread = !readIds.has(a.id);
                return (
                  <li key={a.id} className="px-5 py-3.5">
                    <Link href="/announcements" className="group block">
                      <div className="flex items-center gap-2">
                        <AnnouncementCategoryChip value={a.category} dot={false} />
                        {a.pinned && (
                          <Badge tone="anthracite" dot={false}>
                            Pinned
                          </Badge>
                        )}
                        {unread && <span className="h-1.5 w-1.5 rounded-full bg-ember" />}
                      </div>
                      <p className="mt-1.5 text-sm font-medium text-ink transition-colors group-hover:text-ember-dark">
                        {a.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-2xs leading-relaxed text-slate">
                        {a.body}
                      </p>
                      <p className="mt-1.5 flex items-center gap-1.5 text-2xs text-slate/70">
                        <Avatar name={a.author.name} tone={a.author.avatarTone} size="xs" />
                        {a.author.name} · {relativeTime(a.publishedAt)}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader
              eyebrow="Warehouse"
              title="Parts going out"
              action={
                <ButtonLink href="/dispatch" variant="ghost" size="sm">
                  All
                </ButtonLink>
              }
            />
            {myDispatches.length ? (
              <ul className="divide-y divide-stone/60">
                {myDispatches.map((d) => (
                  <li key={d.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-2xs text-slate">{d.ref}</span>
                      <DispatchStatusChip value={d.status} />
                    </div>
                    <Link
                      href={`/customers/${d.customer.id}`}
                      className="mt-1 block truncate text-sm font-medium text-ink hover:text-ember-dark"
                    >
                      {d.customer.name}
                    </Link>
                    <div className="mt-1 flex items-center gap-2 text-2xs text-slate">
                      <PriorityChip value={d.priority} dot={false} />
                      <span>
                        {d.lines.reduce((sum, l) => sum + l.qty, 0)} items
                        {d.dueAt ? ` · due ${relativeTime(d.dueAt)}` : ''}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<PackageCheck className="h-5 w-5" />}
                title="No parts outstanding"
                description="Nothing you raised is waiting on the warehouse."
              />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
