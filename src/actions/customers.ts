'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { CUSTOMER_STAGES } from '@/lib/constants';
import { formString } from '@/lib/utils';

/** Carries back what was typed — React clears the form when the action settles. */
export type ActionState = {
  error?: string;
  ok?: boolean;
  values?: Record<string, string>;
};

export async function setCustomerStage(formData: FormData) {
  const user = await requireUser();
  const customerId = formString(formData, 'customerId');
  const stage = z.enum(CUSTOMER_STAGES).safeParse(formString(formData, 'stage'));
  if (!customerId || !stage.success) return;

  await db.customer.update({ where: { id: customerId }, data: { stage: stage.data } });
  await db.activity.create({
    data: {
      type: 'STATUS_CHANGE',
      summary: `Stage moved to ${stage.data.replace(/_/g, ' ').toLowerCase()} by ${user.name}`,
      customerId,
      userId: user.id,
      sourceSystem: 'CRM',
    },
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath('/customers');
}

const noteSchema = z.object({
  customerId: z.string().min(1),
  orderId: z.string().optional(),
  type: z.enum(['NOTE', 'CALL', 'EMAIL', 'SMS', 'CHAT']),
  summary: z.string().min(2, 'Say what happened'),
  body: z.string().optional(),
});

/**
 * Anything logged here is what the next agent will read before they call.
 * Logged from an order, it lands on the order's history as well as the
 * customer's, so neither view is ever missing part of the story.
 */
export async function logCustomerActivity(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const submitted = {
    type: formString(formData, 'type') ?? 'NOTE',
    summary: formString(formData, 'summary') ?? '',
    body: formString(formData, 'body') ?? '',
  };

  const parsed = noteSchema.safeParse({
    customerId: formString(formData, 'customerId') ?? '',
    orderId: formString(formData, 'orderId'),
    ...submitted,
    body: formString(formData, 'body'),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Check the form and try again',
      values: submitted,
    };
  }

  const { orderId } = parsed.data;
  if (orderId) {
    const order = await db.order.findFirst({
      where: { id: orderId, customerId: parsed.data.customerId },
      select: { id: true },
    });
    if (!order) return { error: 'That order belongs to a different customer', values: submitted };
  }

  await db.activity.create({
    data: {
      type: parsed.data.type,
      direction: parsed.data.type === 'NOTE' ? null : 'OUTBOUND',
      summary: parsed.data.summary,
      body: parsed.data.body ?? null,
      customerId: parsed.data.customerId,
      orderId: orderId ?? null,
      userId: user.id,
      sourceSystem: 'CRM',
    },
  });

  revalidatePath(`/customers/${parsed.data.customerId}`);
  if (orderId) revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}
