import 'server-only';

import { db } from './db';
import {
  DISPATCH_OPEN_STATUSES,
  TICKET_ACTIVE_STATUSES,
  TICKET_ON_US_STATUSES,
} from './constants';
import { endOfDay, percent, startOfDay } from './utils';

/* -------------------------------------------------------------------------- */
/* An agent's day                                                             */
/* -------------------------------------------------------------------------- */

export type DaySummary = {
  tasksDueToday: number;
  tasksOverdue: number;
  tasksDone: number;
  dailyTarget: number;
  casesWithMe: number;
  casesBreaching: number;
  dispatchesOpen: number;
  unreadAnnouncements: number;
};

/** The six numbers an agent needs before they do anything else. */
export async function getDaySummary(userId: string, dailyTarget: number): Promise<DaySummary> {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  const [
    tasksDueToday,
    tasksOverdue,
    tasksDone,
    casesWithMe,
    casesBreaching,
    dispatchesOpen,
    announcementTotal,
    readCount,
  ] = await Promise.all([
    db.task.count({
      where: { assigneeId: userId, status: { not: 'DONE' }, dueAt: { gte: dayStart, lte: dayEnd } },
    }),
    db.task.count({
      where: { assigneeId: userId, status: { not: 'DONE' }, dueAt: { lt: dayStart } },
    }),
    db.task.count({
      where: { assigneeId: userId, status: 'DONE', completedAt: { gte: dayStart, lte: dayEnd } },
    }),
    db.ticket.count({
      where: { assigneeId: userId, status: { in: [...TICKET_ON_US_STATUSES] } },
    }),
    // Only counted while the clock is genuinely on us — a case parked with the
    // customer or a supplier is not an agent's SLA failure.
    db.ticket.count({
      where: {
        assigneeId: userId,
        status: { in: [...TICKET_ON_US_STATUSES] },
        dueAt: { lt: now },
      },
    }),
    db.partRequest.count({
      where: { status: { in: [...DISPATCH_OPEN_STATUSES] }, requestedById: userId },
    }),
    db.announcement.count(),
    db.announcementRead.count({ where: { userId } }),
  ]);

  return {
    tasksDueToday,
    tasksOverdue,
    tasksDone,
    dailyTarget,
    casesWithMe,
    casesBreaching,
    dispatchesOpen,
    unreadAnnouncements: Math.max(0, announcementTotal - readCount),
  };
}

/* -------------------------------------------------------------------------- */
/* Performance                                                                */
/* -------------------------------------------------------------------------- */

export type AgentMetrics = {
  userId: string;
  name: string;
  role: string;
  team: string;
  avatarTone: string;
  dailyTarget: number;
  casesResolved: number;
  casesOpen: number;
  avgFirstResponseMins: number | null;
  slaHitRate: number | null;
  tasksCompleted: number;
  tasksOpen: number;
  tasksOverdue: number;
  csat: number | null;
  loggedCallMinutes: number;
  touchpoints: number;
};

/**
 * Per-agent output over a rolling window. Deliberately built from things that
 * already happen — resolved cases, completed tasks, logged calls — so nobody
 * has to fill in a timesheet for management to see the picture.
 */
export async function getAgentMetrics(days = 30): Promise<AgentMetrics[]> {
  const since = new Date(Date.now() - days * 864e5);
  const now = new Date();

  const users = await db.user.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      role: true,
      team: true,
      avatarTone: true,
      dailyTarget: true,
    },
  });

  const [resolvedTickets, openTickets, doneTasks, openTasks, activities] = await Promise.all([
    db.ticket.findMany({
      where: { assigneeId: { not: null }, resolvedAt: { gte: since } },
      select: {
        assigneeId: true,
        openedAt: true,
        firstResponseAt: true,
        dueAt: true,
        satisfaction: true,
      },
    }),
    db.ticket.findMany({
      where: { assigneeId: { not: null }, status: { in: [...TICKET_ACTIVE_STATUSES] } },
      select: { assigneeId: true },
    }),
    db.task.findMany({
      where: { assigneeId: { not: null }, status: 'DONE', completedAt: { gte: since } },
      select: { assigneeId: true },
    }),
    db.task.findMany({
      where: { assigneeId: { not: null }, status: { not: 'DONE' } },
      select: { assigneeId: true, dueAt: true },
    }),
    db.activity.findMany({
      where: { userId: { not: null }, occurredAt: { gte: since } },
      select: { userId: true, durationSec: true },
    }),
  ]);

  const tally = <T>(rows: T[], key: (row: T) => string | null) => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const id = key(row);
      if (!id) continue;
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  };

  const openByUser = tally(openTickets, (t) => t.assigneeId);
  const doneTaskByUser = tally(doneTasks, (t) => t.assigneeId);
  const openTaskByUser = tally(openTasks, (t) => t.assigneeId);
  const overdueTaskByUser = tally(
    openTasks.filter((t) => t.dueAt && t.dueAt < now),
    (t) => t.assigneeId,
  );
  const touchByUser = tally(activities, (a) => a.userId);

  const callMinsByUser = new Map<string, number>();
  for (const a of activities) {
    if (!a.userId || !a.durationSec) continue;
    callMinsByUser.set(a.userId, (callMinsByUser.get(a.userId) ?? 0) + a.durationSec / 60);
  }

  return users.map((user) => {
    const mine = resolvedTickets.filter((t) => t.assigneeId === user.id);
    const responded = mine.filter((t) => t.firstResponseAt);

    const avgFirstResponseMins = responded.length
      ? Math.round(
          responded.reduce(
            (sum, t) => sum + (t.firstResponseAt!.getTime() - t.openedAt.getTime()) / 60000,
            0,
          ) / responded.length,
        )
      : null;

    const withDeadline = responded.filter((t) => t.dueAt);
    const withinSla = withDeadline.filter((t) => t.firstResponseAt! <= t.dueAt!);
    const slaHitRate = withDeadline.length
      ? percent(withinSla.length, withDeadline.length)
      : null;

    const scored = mine.filter((t) => typeof t.satisfaction === 'number');
    const csat = scored.length
      ? Number(
          (scored.reduce((sum, t) => sum + (t.satisfaction ?? 0), 0) / scored.length).toFixed(1),
        )
      : null;

    return {
      userId: user.id,
      name: user.name,
      role: user.role,
      team: user.team,
      avatarTone: user.avatarTone,
      dailyTarget: user.dailyTarget,
      casesResolved: mine.length,
      casesOpen: openByUser.get(user.id) ?? 0,
      avgFirstResponseMins,
      slaHitRate,
      tasksCompleted: doneTaskByUser.get(user.id) ?? 0,
      tasksOpen: openTaskByUser.get(user.id) ?? 0,
      tasksOverdue: overdueTaskByUser.get(user.id) ?? 0,
      csat,
      loggedCallMinutes: Math.round(callMinsByUser.get(user.id) ?? 0),
      touchpoints: touchByUser.get(user.id) ?? 0,
    };
  });
}

export type TeamTotals = {
  casesOpened: number;
  casesResolved: number;
  avgFirstResponseMins: number | null;
  slaHitRate: number | null;
  csat: number | null;
  tasksCompleted: number;
  openBacklog: number;
  breachedNow: number;
};

export async function getTeamTotals(days = 30): Promise<TeamTotals> {
  const since = new Date(Date.now() - days * 864e5);
  const now = new Date();

  const [opened, resolved, tasksCompleted, openBacklog, breachedNow] = await Promise.all([
    db.ticket.count({ where: { openedAt: { gte: since } } }),
    db.ticket.findMany({
      where: { resolvedAt: { gte: since } },
      select: { openedAt: true, firstResponseAt: true, dueAt: true, satisfaction: true },
    }),
    db.task.count({ where: { status: 'DONE', completedAt: { gte: since } } }),
    db.ticket.count({ where: { status: { in: [...TICKET_ACTIVE_STATUSES] } } }),
    db.ticket.count({
      where: { status: { in: [...TICKET_ACTIVE_STATUSES] }, dueAt: { lt: now } },
    }),
  ]);

  const responded = resolved.filter((t) => t.firstResponseAt);
  const avgFirstResponseMins = responded.length
    ? Math.round(
        responded.reduce(
          (sum, t) => sum + (t.firstResponseAt!.getTime() - t.openedAt.getTime()) / 60000,
          0,
        ) / responded.length,
      )
    : null;

  const withDeadline = responded.filter((t) => t.dueAt);
  const slaHitRate = withDeadline.length
    ? percent(withDeadline.filter((t) => t.firstResponseAt! <= t.dueAt!).length, withDeadline.length)
    : null;

  const scored = resolved.filter((t) => typeof t.satisfaction === 'number');
  const csat = scored.length
    ? Number((scored.reduce((s, t) => s + (t.satisfaction ?? 0), 0) / scored.length).toFixed(1))
    : null;

  return {
    casesOpened: opened,
    casesResolved: resolved.length,
    avgFirstResponseMins,
    slaHitRate,
    csat,
    tasksCompleted,
    openBacklog,
    breachedNow,
  };
}

export type DayPoint = { date: string; label: string; opened: number; resolved: number };

/**
 * Opened against resolved. Buckets by day over a short window and by week over
 * a long one, so a 90-day view stays readable instead of turning into 90 ticks.
 */
export async function getDailyFlow(days = 14): Promise<DayPoint[]> {
  const weekly = days > 30;
  const bucketDays = weekly ? 7 : 1;
  const buckets = Math.ceil(days / bucketDays);
  const since = startOfDay(new Date(Date.now() - (days - 1) * 864e5));

  const [opened, resolved] = await Promise.all([
    db.ticket.findMany({ where: { openedAt: { gte: since } }, select: { openedAt: true } }),
    db.ticket.findMany({ where: { resolvedAt: { gte: since } }, select: { resolvedAt: true } }),
  ]);

  const indexOf = (d: Date) =>
    Math.min(
      buckets - 1,
      Math.max(0, Math.floor((startOfDay(d).getTime() - since.getTime()) / (bucketDays * 864e5))),
    );

  const openedBy = new Array<number>(buckets).fill(0);
  const resolvedBy = new Array<number>(buckets).fill(0);
  for (const t of opened) openedBy[indexOf(t.openedAt)] += 1;
  for (const t of resolved) {
    if (t.resolvedAt) resolvedBy[indexOf(t.resolvedAt)] += 1;
  }

  return Array.from({ length: buckets }, (_, i) => {
    const start = new Date(since.getTime() + i * bucketDays * 864e5);
    return {
      date: start.toISOString().slice(0, 10),
      label: start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      opened: openedBy[i] ?? 0,
      resolved: resolvedBy[i] ?? 0,
    };
  });
}

export type Slice = { label: string; value: number; key: string };

export async function getCaseMix(days = 30): Promise<{ byCategory: Slice[]; byChannel: Slice[] }> {
  const since = new Date(Date.now() - days * 864e5);
  const [byCategory, byChannel] = await Promise.all([
    db.ticket.groupBy({
      by: ['category'],
      where: { openedAt: { gte: since } },
      _count: { _all: true },
    }),
    db.ticket.groupBy({
      by: ['channel'],
      where: { openedAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);

  return {
    byCategory: byCategory
      .map((row) => ({ key: row.category, label: row.category, value: row._count._all }))
      .sort((a, b) => b.value - a.value),
    byChannel: byChannel
      .map((row) => ({ key: row.channel, label: row.channel, value: row._count._all }))
      .sort((a, b) => b.value - a.value),
  };
}
