import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';

import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  TASK_BOARD_COLUMNS,
  TASK_STATUS_META,
  type TaskStatus,
} from '@/lib/constants';
import { endOfDay, startOfDay } from '@/lib/utils';

import { PageHeader } from '@/components/ui/page-header';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { SearchField } from '@/components/ui/search-field';
import { BoardCard } from '@/components/work/board-card';
import { NewTaskForm } from '@/components/work/new-task-form';
import { taskItemSelect } from '@/components/work/task-item';
import { TONE_DOTS } from '@/components/ui/badge';

export const metadata: Metadata = { title: 'Work board' };
export const dynamic = 'force-dynamic';

type Search = { who?: string; due?: string; q?: string; new?: string };

export default async function BoardPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const { who = 'mine', due = 'all', q, new: newParam } = await searchParams;

  const now = new Date();
  const where: Prisma.TaskWhereInput = {};

  if (who === 'mine') where.assigneeId = user.id;
  else if (who === 'team') where.assignee = { team: user.team };

  if (due === 'overdue') where.dueAt = { lt: startOfDay(now) };
  else if (due === 'today') where.dueAt = { gte: startOfDay(now), lte: endOfDay(now) };
  else if (due === 'week') where.dueAt = { lte: endOfDay(new Date(now.getTime() + 7 * 864e5)) };

  if (q) {
    where.OR = [
      { title: { contains: q } },
      { details: { contains: q } },
      { customer: { name: { contains: q } } },
    ];
  }

  // The "Actioned" column is capped to the last seven days on purpose. A board
  // that keeps every card ever finished is exactly the clutter we are replacing.
  const doneSince = new Date(now.getTime() - 7 * 864e5);

  const [tasks, team, customers, counts] = await Promise.all([
    db.task.findMany({
      where: {
        ...where,
        AND: [{ OR: [{ status: { not: 'DONE' } }, { completedAt: { gte: doneSince } }] }],
      },
      select: taskItemSelect,
      orderBy: [{ priority: 'asc' }, { dueAt: 'asc' }],
      take: 300,
    }),
    db.user.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, team: true },
    }),
    db.customer.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, ref: true },
      take: 300,
    }),
    Promise.all([
      db.task.count({ where: { assigneeId: user.id, status: { not: 'DONE' } } }),
      db.task.count({ where: { assignee: { team: user.team }, status: { not: 'DONE' } } }),
      db.task.count({ where: { status: { not: 'DONE' } } }),
    ]),
  ]);

  const [mineCount, teamCount, allCount] = counts;
  const byStatus = (status: TaskStatus) => tasks.filter((t) => t.status === status);

  return (
    <>
      <PageHeader
        eyebrow="Replaces the Trello boards"
        title="Work board"
        description="Five columns, one meaning each. A card is always somebody's, and you can see at a glance what has been actioned and what has not."
        actions={
          <SearchField
            action="/board"
            defaultValue={q}
            hidden={{ who, due }}
            placeholder="Search tasks"
          />
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <FilterTabs
            basePath="/board"
            paramKey="who"
            active={who}
            params={{ due, q }}
            options={[
              { value: 'mine', label: 'Mine', count: mineCount },
              { value: 'team', label: user.team, count: teamCount },
              { value: 'all', label: 'Everyone', count: allCount },
            ]}
          />
          <span className="hidden h-5 w-px bg-stone sm:block" />
          <FilterTabs
            basePath="/board"
            paramKey="due"
            active={due}
            params={{ who, q }}
            options={[
              { value: 'all', label: 'Any date' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'today', label: 'Due today' },
              { value: 'week', label: 'Next 7 days' },
            ]}
          />
        </div>

        <NewTaskForm
          team={team}
          customers={customers}
          defaultAssigneeId={user.id}
          defaultOpen={newParam === '1'}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {TASK_BOARD_COLUMNS.map((status) => {
          const meta = TASK_STATUS_META[status];
          const column = byStatus(status);

          return (
            <section
              key={status}
              className="flex min-w-0 flex-col rounded-brand border border-stone/70 bg-sand/35"
            >
              <header className="flex items-center justify-between gap-2 border-b border-stone/70 px-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOTS[meta.tone]}`} />
                  <span className="truncate text-xs font-semibold text-ink">{meta.label}</span>
                </span>
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-2xs font-semibold tabular-nums text-slate">
                  {column.length}
                </span>
              </header>

              <p className="px-3 pt-2 text-2xs leading-snug text-slate/80">{meta.hint}</p>

              <ul className="flex-1 space-y-2 p-3">
                {column.length ? (
                  column.map((task) => <BoardCard key={task.id} task={task} />)
                ) : (
                  <li className="rounded-brand border border-dashed border-stone px-3 py-6 text-center text-2xs text-slate/70">
                    {status === 'DONE' ? 'Nothing actioned in the last 7 days' : 'Empty'}
                  </li>
                )}
              </ul>

              {status === 'DONE' && column.length > 0 && (
                <p className="border-t border-stone/70 px-3 py-2 text-2xs text-slate/70">
                  Showing the last 7 days only.
                </p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
