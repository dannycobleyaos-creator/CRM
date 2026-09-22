'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import {
  PRIORITIES,
  SLA_MINUTES,
  TICKET_CATEGORIES,
  TICKET_CHANNELS,
  TICKET_STATUSES,
  type Priority,
} from '@/lib/constants';
import { addMinutes, formString } from '@/lib/utils';

/** Carries back what was typed — React clears the form when the action settles. */
export type ActionState = {
  error?: string;
  ok?: boolean;
  values?: Record<string, string>;
};

/** Claiming a case is one click — the commonest action in the portal. */
export async function claimCase(formData: FormData) {
  const user = await requireUser();
  const ticketId = formString(formData, 'ticketId');
  if (!ticketId) return;

  const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return;

  await db.ticket.update({
    where: { id: ticketId },
    data: {
      assigneeId: user.id,
      status: ticket.status === 'NEW' ? 'OPEN' : ticket.status,
    },
  });

  await db.activity.create({
    data: {
      type: 'STATUS_CHANGE',
      summary: `${user.name} picked up this case`,
      customerId: ticket.customerId,
      ticketId: ticket.id,
      userId: user.id,
      sourceSystem: 'CRM',
    },
  });

  revalidatePath('/cases');
  revalidatePath(`/cases/${ticketId}`);
  revalidatePath('/');
}

export async function setCaseStatus(formData: FormData) {
  const user = await requireUser();
  const ticketId = formString(formData, 'ticketId');
  const status = formString(formData, 'status');
  const parsed = z.enum(TICKET_STATUSES).safeParse(status);
  if (!ticketId || !parsed.success) return;

  const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return;

  const nowResolved = ['RESOLVED', 'CLOSED'].includes(parsed.data);

  await db.ticket.update({
    where: { id: ticketId },
    data: {
      status: parsed.data,
      resolvedAt: nowResolved ? ticket.resolvedAt ?? new Date() : null,
      // Re-opening a resolved case is tracked, not hidden.
      reopenCount:
        !nowResolved && ticket.resolvedAt ? ticket.reopenCount + 1 : ticket.reopenCount,
    },
  });

  await db.activity.create({
    data: {
      type: 'STATUS_CHANGE',
      summary: `Case set to ${parsed.data.replace(/_/g, ' ').toLowerCase()} by ${user.name}`,
      customerId: ticket.customerId,
      ticketId: ticket.id,
      userId: user.id,
      sourceSystem: 'CRM',
    },
  });

  revalidatePath('/cases');
  revalidatePath(`/cases/${ticketId}`);
  revalidatePath('/');
}

export async function assignCase(formData: FormData) {
  const user = await requireUser();
  const ticketId = formString(formData, 'ticketId');
  const assigneeId = formString(formData, 'assigneeId');
  if (!ticketId) return;

  const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return;

  const assignee = assigneeId ? await db.user.findUnique({ where: { id: assigneeId } }) : null;

  await db.ticket.update({
    where: { id: ticketId },
    data: { assigneeId: assignee?.id ?? null },
  });

  await db.activity.create({
    data: {
      type: 'STATUS_CHANGE',
      summary: assignee
        ? `Case assigned to ${assignee.name} by ${user.name}`
        : `Case returned to the unassigned queue by ${user.name}`,
      customerId: ticket.customerId,
      ticketId: ticket.id,
      userId: user.id,
      sourceSystem: 'CRM',
    },
  });

  revalidatePath('/cases');
  revalidatePath(`/cases/${ticketId}`);
}

const replySchema = z.object({
  ticketId: z.string().min(1),
  type: z.enum(['NOTE', 'CALL', 'EMAIL', 'SMS', 'CHAT']),
  summary: z.string().min(2, 'Say what happened'),
  body: z.string().optional(),
});

/**
 * Logging an interaction also stamps first response when it is the first one —
 * which is how the SLA figures stay honest without anyone maintaining them.
 */
export async function logInteraction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const submitted = {
    type: formString(formData, 'type') ?? 'NOTE',
    summary: formString(formData, 'summary') ?? '',
    body: formString(formData, 'body') ?? '',
  };

  const parsed = replySchema.safeParse({
    ticketId: formString(formData, 'ticketId') ?? '',
    ...submitted,
    body: formString(formData, 'body'),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Check the form and try again',
      values: submitted,
    };
  }

  const { ticketId, type, summary, body } = parsed.data;
  const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { error: 'That case no longer exists', values: submitted };

  await db.activity.create({
    data: {
      type,
      direction: type === 'NOTE' ? null : 'OUTBOUND',
      summary,
      body: body ?? null,
      customerId: ticket.customerId,
      ticketId: ticket.id,
      userId: user.id,
      sourceSystem: 'CRM',
    },
  });

  const isCustomerFacing = type !== 'NOTE';
  if (isCustomerFacing && !ticket.firstResponseAt) {
    await db.ticket.update({
      where: { id: ticketId },
      data: {
        firstResponseAt: new Date(),
        status: ticket.status === 'NEW' ? 'OPEN' : ticket.status,
        assigneeId: ticket.assigneeId ?? user.id,
      },
    });
  }

  revalidatePath(`/cases/${ticketId}`);
  revalidatePath(`/customers/${ticket.customerId}`);
  revalidatePath('/cases');
  return { ok: true };
}

const newCaseSchema = z.object({
  customerId: z.string().min(1, 'Pick the customer this is about'),
  subject: z.string().min(3, 'Give the case a subject'),
  body: z.string().optional(),
  channel: z.enum(TICKET_CHANNELS).default('PHONE'),
  category: z.enum(TICKET_CATEGORIES).default('OTHER'),
  priority: z.enum(PRIORITIES).default('NORMAL'),
  assignToMe: z.boolean().default(true),
});

export async function createCase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();

  const parsed = newCaseSchema.safeParse({
    customerId: formString(formData, 'customerId') ?? '',
    subject: formString(formData, 'subject') ?? '',
    body: formString(formData, 'body'),
    channel: formString(formData, 'channel') ?? 'PHONE',
    category: formString(formData, 'category') ?? 'OTHER',
    priority: formString(formData, 'priority') ?? 'NORMAL',
    assignToMe: formData.get('assignToMe') !== null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again' };
  }

  const data = parsed.data;
  const slaMinutes = SLA_MINUTES[data.priority as Priority];
  const openedAt = new Date();

  // Human-readable references beat cuids when you are reading one out on a call.
  const lastRef = await db.ticket.findFirst({
    orderBy: { ref: 'desc' },
    where: { ref: { startsWith: 'CASE-' } },
    select: { ref: true },
  });
  const nextNumber = (Number(lastRef?.ref.replace('CASE-', '')) || 4000) + 1;

  const ticket = await db.ticket.create({
    data: {
      ref: `CASE-${nextNumber}`,
      subject: data.subject,
      body: data.body ?? null,
      customerId: data.customerId,
      channel: data.channel,
      category: data.category,
      priority: data.priority,
      status: data.assignToMe ? 'OPEN' : 'NEW',
      assigneeId: data.assignToMe ? user.id : null,
      openedAt,
      dueAt: addMinutes(openedAt, slaMinutes),
      slaMinutes,
    },
  });

  await db.activity.create({
    data: {
      type: data.channel === 'PHONE' ? 'CALL' : data.channel === 'CHAT' ? 'CHAT' : 'EMAIL',
      direction: 'INBOUND',
      summary: `Case opened by ${user.name} — ${data.subject}`,
      body: data.body ?? null,
      customerId: data.customerId,
      ticketId: ticket.id,
      userId: user.id,
      sourceSystem: 'CRM',
    },
  });

  revalidatePath('/cases');
  revalidatePath(`/customers/${data.customerId}`);
  return { ok: true };
}
