import 'server-only';

import { db } from './db';
import {
  DISPATCH_OPEN_STATUSES,
  TICKET_ACTIVE_STATUSES,
  TICKET_ON_US_STATUSES,
} from './constants';
import { addDays, endOfDay, percent, startOfDay } from './utils';

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
    // "Due today" is what is still ahead of you today; anything whose time has
    // already passed counts as overdue, even if it was only due this morning.
    // The two never overlap, so the tiles cannot contradict the list below them.
    db.task.count({
      where: { assigneeId: userId, status: { not: 'DONE' }, dueAt: { gte: now, lte: dayEnd } },
    }),
    db.task.count({
      where: { assigneeId: userId, status: { not: 'DONE' }, dueAt: { lt: now } },
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
      select: { userId: true, type: true, durationSec: true },
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
    // Call time means calls — a long live chat is not time on the phone.
    if (!a.userId || !a.durationSec || a.type !== 'CALL') continue;
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

/* -------------------------------------------------------------------------- */
/* Calls, chats and emails                                                    */
/* -------------------------------------------------------------------------- */

const UNANSWERED = new Set(['MISSED', 'VOICEMAIL']);
const REPLY_TARGET_SEC = 4 * 3600;
/** The hours the contact centre is open — anything outside is folded into the edges. */
export const OPEN_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17] as const;

const avg = (values: number[]) =>
  values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : null;

/** Monday to Friday between two dates, inclusive — at least one. */
export function workingDaysBetween(from: Date, to: Date) {
  let days = 0;
  for (let d = startOfDay(from); d <= to; d = addDays(d, 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) days += 1;
  }
  return Math.max(1, days);
}

export type ContactTotals = {
  inboundCalls: number;
  answeredCalls: number;
  missedCalls: number;
  answerRate: number | null;
  outboundCalls: number;
  connectedOutbound: number;
  talkSec: number;
  avgHandleSec: number | null;
  avgAnswerSec: number | null;
  chats: number;
  missedChats: number;
  chatAnswerRate: number | null;
  avgChatSec: number | null;
  avgChatWaitSec: number | null;
  emailsIn: number;
  emailsOut: number;
  avgReplyMins: number | null;
  replyWithinTarget: number | null;
  handled: number;
  workingDays: number;
};

export type ContactPoint = { label: string; CALL: number; CHAT: number; EMAIL: number };
export type HourPoint = { key: string; label: string; value: number; total: number; missed: number };

export type PersonContacts = {
  userId: string;
  name: string;
  role: string;
  team: string;
  avatarTone: string;
  callsIn: number;
  callsOut: number;
  talkSec: number;
  avgHandleSec: number | null;
  chats: number;
  avgChatSec: number | null;
  emails: number;
  avgReplyMins: number | null;
  replyWithinTarget: number | null;
  total: number;
  perDay: number;
};

export type ContactReport = {
  totals: ContactTotals;
  /** Handled per bucket. Weekly points are averages per working day, so a short week never dips. */
  series: ContactPoint[];
  bucket: 'hour' | 'day' | 'week';
  hours: HourPoint[];
  people: PersonContacts[];
  /** The window the report covers: [since, until). */
  since: Date;
  until: Date;
};

/**
 * The contact centre report: every call, live chat and email the team handled,
 * how quickly customers got a person, and who did the work. Built from the
 * activity feed that Aircall, tawk.to and the inbox land in, so nobody fills in
 * a tally sheet.
 *
 * Missed calls and chats carry no person — nobody picked them up — so they
 * count towards the company's answer rate and never against an individual.
 *
 * `days: 1` is today so far, hour by hour. Anything longer covers complete days
 * up to the end of yesterday, so a half-finished today never drags the trend
 * line down at the end.
 */
export async function getContactMetrics(days: number): Promise<ContactReport> {
  const now = new Date();
  const today = startOfDay(now);
  const live = days <= 1;
  const since = live ? today : addDays(today, -days);
  const until = live ? now : today;
  const workingDays = live ? 1 : workingDaysBetween(since, addDays(until, -1));

  const [users, rows] = await Promise.all([
    db.user.findMany({
      select: { id: true, name: true, role: true, team: true, avatarTone: true },
    }),
    db.activity.findMany({
      where: { occurredAt: { gte: since, lt: until }, type: { in: ['CALL', 'CHAT', 'EMAIL'] } },
      select: {
        type: true,
        direction: true,
        outcome: true,
        userId: true,
        durationSec: true,
        waitSec: true,
        occurredAt: true,
      },
    }),
  ]);

  type Row = (typeof rows)[number];
  const isAnsweredCall = (r: Row) =>
    r.type === 'CALL' && r.direction === 'INBOUND' && !UNANSWERED.has(r.outcome ?? '');
  const isMissedCall = (r: Row) =>
    r.type === 'CALL' && r.direction === 'INBOUND' && UNANSWERED.has(r.outcome ?? '');
  const isOutboundCall = (r: Row) => r.type === 'CALL' && r.direction === 'OUTBOUND';
  const isChat = (r: Row) => r.type === 'CHAT' && !UNANSWERED.has(r.outcome ?? '');
  const isMissedChat = (r: Row) => r.type === 'CHAT' && UNANSWERED.has(r.outcome ?? '');
  const isEmailOut = (r: Row) => r.type === 'EMAIL' && r.direction === 'OUTBOUND';
  const isEmailIn = (r: Row) => r.type === 'EMAIL' && r.direction === 'INBOUND';

  const answered = rows.filter(isAnsweredCall);
  const missedCalls = rows.filter(isMissedCall).length;
  const outbound = rows.filter(isOutboundCall);
  const chats = rows.filter(isChat);
  const missedChats = rows.filter(isMissedChat).length;
  const emailsOut = rows.filter(isEmailOut);
  const replies = emailsOut.filter((r) => r.waitSec !== null).map((r) => r.waitSec!);
  const numbers = (list: Row[], key: 'durationSec' | 'waitSec') =>
    list.map((r) => r[key]).filter((v): v is number => v !== null);

  const totals: ContactTotals = {
    inboundCalls: answered.length + missedCalls,
    answeredCalls: answered.length,
    missedCalls,
    answerRate: answered.length + missedCalls ? percent(answered.length, answered.length + missedCalls) : null,
    outboundCalls: outbound.length,
    connectedOutbound: outbound.filter((r) => r.outcome !== 'VOICEMAIL').length,
    talkSec: [...answered, ...outbound].reduce((s, r) => s + (r.durationSec ?? 0), 0),
    avgHandleSec: avg(numbers(answered, 'durationSec')),
    avgAnswerSec: avg(numbers(answered, 'waitSec')),
    chats: chats.length,
    missedChats,
    chatAnswerRate: chats.length + missedChats ? percent(chats.length, chats.length + missedChats) : null,
    avgChatSec: avg(numbers(chats, 'durationSec')),
    avgChatWaitSec: avg(numbers(chats, 'waitSec')),
    emailsIn: rows.filter(isEmailIn).length,
    emailsOut: emailsOut.length,
    avgReplyMins: replies.length ? Math.round(avg(replies)! / 60) : null,
    replyWithinTarget: replies.length
      ? percent(replies.filter((s) => s <= REPLY_TARGET_SEC).length, replies.length)
      : null,
    handled: answered.length + outbound.length + chats.length + emailsOut.length,
    workingDays,
  };

  // ---- Handled per bucket, by channel -------------------------------------
  const bucket: ContactReport['bucket'] = live ? 'hour' : days <= 31 ? 'day' : 'week';
  const handledRows = rows.filter(
    (r) => isAnsweredCall(r) || isOutboundCall(r) || isChat(r) || isEmailOut(r),
  );
  type Channel = 'CALL' | 'CHAT' | 'EMAIL';
  let series: ContactPoint[];
  if (bucket === 'hour') {
    // Only the hours that have started — the afternoon has not happened yet.
    const hoursSoFar = OPEN_HOURS.filter((h) => h <= now.getHours());
    series = hoursSoFar.map((h) => ({ label: hourLabel(h), CALL: 0, CHAT: 0, EMAIL: 0 }));
    for (const r of handledRows) {
      const point = series[clampHour(r.occurredAt.getHours()) - OPEN_HOURS[0]];
      if (point) point[r.type as Channel] += 1;
    }
  } else if (bucket === 'day') {
    const points = Array.from({ length: days }, (_, i) => {
      const start = addDays(since, i);
      return {
        start,
        label: start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        CALL: 0,
        CHAT: 0,
        EMAIL: 0,
      };
    });
    for (const r of handledRows) {
      const i = Math.floor((startOfDay(r.occurredAt).getTime() - since.getTime()) / 864e5);
      if (points[i]) points[i]![r.type as Channel] += 1;
    }
    // A closed weekend is not a bad day — leave empty Saturdays and Sundays out
    // rather than drawing the line down to zero twice a week.
    series = points
      .filter((p) => {
        const day = p.start.getDay();
        return !((day === 0 || day === 6) && p.CALL + p.CHAT + p.EMAIL === 0);
      })
      .map(({ label, CALL, CHAT, EMAIL }) => ({ label, CALL, CHAT, EMAIL }));
  } else {
    // Whole weeks counted back from the end of yesterday. Each point is the
    // average per working day, so the shorter week at the start reads true.
    const weeks = Math.ceil(days / 7);
    const points = Array.from({ length: weeks }, (_, k) => {
      const end = addDays(until, -7 * (weeks - 1 - k));
      const start = k === 0 ? since : addDays(end, -7);
      return { start, end, sums: { CALL: 0, CHAT: 0, EMAIL: 0 } };
    });
    for (const r of handledRows) {
      const point = points.find((p) => r.occurredAt >= p.start && r.occurredAt < p.end);
      if (point) point.sums[r.type as Channel] += 1;
    }
    series = points.map((p) => {
      const working = workingDaysBetween(p.start, addDays(p.end, -1));
      const rate = (n: number) => Math.round((n / working) * 10) / 10;
      return {
        label: p.start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        CALL: rate(p.sums.CALL),
        CHAT: rate(p.sums.CHAT),
        EMAIL: rate(p.sums.EMAIL),
      };
    });
  }

  // ---- When customers try to reach a person: calls and chats, answered or not
  const hours: HourPoint[] = OPEN_HOURS.map((h) => ({
    key: String(h),
    label: hourLabel(h),
    value: 0,
    total: 0,
    missed: 0,
  }));
  for (const r of rows) {
    const live = (r.type === 'CALL' && r.direction === 'INBOUND') || r.type === 'CHAT';
    if (!live) continue;
    const slot = hours[clampHour(r.occurredAt.getHours()) - OPEN_HOURS[0]]!;
    slot.total += 1;
    if (UNANSWERED.has(r.outcome ?? '')) slot.missed += 1;
  }
  for (const slot of hours) slot.value = Math.round((slot.total / workingDays) * 10) / 10;

  // ---- People ---------------------------------------------------------------
  const byUser = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.userId) continue;
    const list = byUser.get(r.userId);
    if (list) list.push(r);
    else byUser.set(r.userId, [r]);
  }
  const people: PersonContacts[] = users
    .filter((u) => byUser.has(u.id))
    .map((u) => {
      const mine = byUser.get(u.id)!;
      const callsIn = mine.filter(isAnsweredCall);
      const callsOut = mine.filter(isOutboundCall);
      const myChats = mine.filter(isChat);
      const myEmails = mine.filter(isEmailOut);
      const myReplies = numbers(myEmails, 'waitSec');
      const total = callsIn.length + callsOut.length + myChats.length + myEmails.length;
      return {
        userId: u.id,
        name: u.name,
        role: u.role,
        team: u.team,
        avatarTone: u.avatarTone,
        callsIn: callsIn.length,
        callsOut: callsOut.length,
        talkSec: [...callsIn, ...callsOut].reduce((s, r) => s + (r.durationSec ?? 0), 0),
        avgHandleSec: avg(numbers(callsIn, 'durationSec')),
        chats: myChats.length,
        avgChatSec: avg(numbers(myChats, 'durationSec')),
        emails: myEmails.length,
        avgReplyMins: myReplies.length ? Math.round(avg(myReplies)! / 60) : null,
        replyWithinTarget: myReplies.length
          ? percent(myReplies.filter((s) => s <= REPLY_TARGET_SEC).length, myReplies.length)
          : null,
        total,
        perDay: Math.round((total / workingDays) * 10) / 10,
      };
    })
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total);

  return { totals, series, bucket, hours, people, since, until };
}

function clampHour(hour: number) {
  return Math.min(OPEN_HOURS[OPEN_HOURS.length - 1]!, Math.max(OPEN_HOURS[0], hour));
}

function hourLabel(hour: number) {
  if (hour === 12) return '12pm';
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}
