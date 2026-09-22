'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { PRIORITIES, TASK_CATEGORIES, TASK_STATUSES } from '@/lib/constants';
import { formString } from '@/lib/utils';

/**
 * React resets an uncontrolled form once its action settles, so a rejected
 * submission has to hand back what was typed or the person retypes it.
 */
export type ActionState = {
  error?: string;
  ok?: boolean;
  values?: Record<string, string>;
};

const createSchema = z.object({
  title: z.string().min(3, 'Give the task a title somebody else would understand'),
  details: z.string().optional(),
  priority: z.enum(PRIORITIES).default('NORMAL'),
  category: z.enum(TASK_CATEGORIES).default('OTHER'),
  assigneeId: z.string().min(1, 'Every task needs an owner'),
  customerId: z.string().optional(),
  ticketId: z.string().optional(),
  dueAt: z.string().optional(),
});

/**
 * Tasks always have an owner and a due date. That single rule is what stops the
 * board turning back into a wall of cards nobody has picked up.
 */
export async function createTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();

  const submitted = {
    title: formString(formData, 'title') ?? '',
    details: formString(formData, 'details') ?? '',
    priority: formString(formData, 'priority') ?? 'NORMAL',
    category: formString(formData, 'category') ?? 'OTHER',
    assigneeId: formString(formData, 'assigneeId') ?? '',
    customerId: formString(formData, 'customerId') ?? '',
    dueAt: formString(formData, 'dueAt') ?? '',
  };

  const parsed = createSchema.safeParse({
    ...submitted,
    details: formString(formData, 'details'),
    customerId: formString(formData, 'customerId'),
    ticketId: formString(formData, 'ticketId'),
    dueAt: formString(formData, 'dueAt'),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Check the form and try again',
      values: submitted,
    };
  }

  const data = parsed.data;
  const task = await db.task.create({
    data: {
      title: data.title,
      details: data.details ?? null,
      priority: data.priority,
      category: data.category,
      status: 'TODO',
      assigneeId: data.assigneeId,
      createdById: user.id,
      customerId: data.customerId ?? null,
      ticketId: data.ticketId ?? null,
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
    },
    include: { assignee: true },
  });

  if (task.customerId || task.ticketId) {
    await db.activity.create({
      data: {
        type: 'TASK',
        summary: `Task raised: ${task.title}`,
        body: `Assigned to ${task.assignee?.name ?? 'unassigned'} by ${user.name}.`,
        customerId: task.customerId,
        ticketId: task.ticketId,
        userId: user.id,
        sourceSystem: 'CRM',
      },
    });
  }

  revalidatePath('/board');
  revalidatePath('/');
  return { ok: true };
}

const statusSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(TASK_STATUSES),
  blockedNote: z.string().optional(),
});

export async function setTaskStatus(formData: FormData) {
  const user = await requireUser();
  const parsed = statusSchema.safeParse({
    taskId: formString(formData, 'taskId') ?? '',
    status: formString(formData, 'status') ?? '',
    blockedNote: formString(formData, 'blockedNote'),
  });
  if (!parsed.success) return;

  const { taskId, status, blockedNote } = parsed.data;
  const existing = await db.task.findUnique({ where: { id: taskId } });
  if (!existing) return;

  await db.task.update({
    where: { id: taskId },
    data: {
      status,
      blockedNote: status === 'BLOCKED' ? blockedNote ?? existing.blockedNote : null,
      startedAt: status !== 'TODO' && !existing.startedAt ? new Date() : existing.startedAt,
      completedAt: status === 'DONE' ? new Date() : null,
    },
  });

  if (existing.customerId || existing.ticketId) {
    await db.activity.create({
      data: {
        type: status === 'DONE' ? 'TASK' : 'STATUS_CHANGE',
        summary:
          status === 'DONE'
            ? `Task actioned: ${existing.title}`
            : `Task moved to ${status.replace(/_/g, ' ').toLowerCase()}: ${existing.title}`,
        body: blockedNote ?? null,
        customerId: existing.customerId,
        ticketId: existing.ticketId,
        userId: user.id,
        sourceSystem: 'CRM',
      },
    });
  }

  revalidatePath('/board');
  revalidatePath('/');
  if (existing.ticketId) revalidatePath(`/cases/${existing.ticketId}`);
  if (existing.customerId) revalidatePath(`/customers/${existing.customerId}`);
}

export async function reassignTask(formData: FormData) {
  await requireUser();
  const taskId = formString(formData, 'taskId');
  const assigneeId = formString(formData, 'assigneeId');
  if (!taskId || !assigneeId) return;

  await db.task.update({ where: { id: taskId }, data: { assigneeId } });
  revalidatePath('/board');
  revalidatePath('/');
}
