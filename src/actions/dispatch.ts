'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { db } from '@/lib/db';
import { isManagement, requireUser } from '@/lib/auth';
import { DISPATCH_STATUSES, PRIORITIES } from '@/lib/constants';
import { formString } from '@/lib/utils';

/** Carries back what was typed — React clears the form when the action settles. */
export type ActionState = {
  error?: string;
  ok?: boolean;
  values?: Record<string, string>;
};

const createSchema = z.object({
  customerId: z.string().min(1, 'Pick the customer these parts are going to'),
  ticketId: z.string().optional(),
  priority: z.enum(PRIORITIES).default('NORMAL'),
  reason: z.string().min(5, 'Say why the parts are going out — this is the audit trail'),
  dueAt: z.string().optional(),
  notes: z.string().optional(),
  partIds: z.array(z.string()).min(1, 'Add at least one part'),
  quantities: z.array(z.number().int().min(1)),
});

export async function createPartRequest(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const partIds = formData.getAll('partId').map(String).filter(Boolean);
  const quantities = partIds.map((id) => Number(formData.get(`qty_${id}`) ?? 1) || 1);

  const submitted = {
    customerId: formString(formData, 'customerId') ?? '',
    priority: formString(formData, 'priority') ?? 'NORMAL',
    reason: formString(formData, 'reason') ?? '',
    dueAt: formString(formData, 'dueAt') ?? '',
    notes: formString(formData, 'notes') ?? '',
  };

  const parsed = createSchema.safeParse({
    ...submitted,
    ticketId: formString(formData, 'ticketId'),
    dueAt: formString(formData, 'dueAt'),
    notes: formString(formData, 'notes'),
    partIds,
    quantities,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Check the form and try again',
      values: submitted,
    };
  }

  const data = parsed.data;
  const customer = await db.customer.findUnique({ where: { id: data.customerId } });
  if (!customer) return { error: 'That customer no longer exists', values: submitted };

  const lastRef = await db.partRequest.findFirst({
    orderBy: { ref: 'desc' },
    where: { ref: { startsWith: 'DSP-' } },
    select: { ref: true },
  });
  const nextNumber = (Number(lastRef?.ref.replace('DSP-', '')) || 3000) + 1;

  const request = await db.partRequest.create({
    data: {
      ref: `DSP-${nextNumber}`,
      customerId: customer.id,
      ticketId: data.ticketId ?? null,
      requestedById: user.id,
      status: 'REQUESTED',
      priority: data.priority,
      reason: data.reason,
      notes: data.notes ?? null,
      dueAt: data.dueAt ? new Date(data.dueAt) : null,
      // Ship to the address already on the customer record — no re-keying.
      shipToName: customer.name,
      shipToLine1: customer.addressL1,
      shipToCity: customer.city,
      shipToPost: customer.postcode,
      lines: {
        create: data.partIds.map((partId, i) => ({
          partId,
          qty: data.quantities[i] ?? 1,
        })),
      },
    },
  });

  await db.activity.create({
    data: {
      type: 'DISPATCH',
      summary: `Parts requested (${request.ref}) by ${user.name}`,
      body: data.reason,
      customerId: customer.id,
      ticketId: data.ticketId ?? null,
      partRequestId: request.id,
      userId: user.id,
      sourceSystem: 'CRM',
    },
  });

  revalidatePath('/dispatch');
  revalidatePath(`/customers/${customer.id}`);
  return { ok: true };
}

const advanceSchema = z.object({
  requestId: z.string().min(1),
  status: z.enum(DISPATCH_STATUSES),
  carrier: z.string().optional(),
  trackingRef: z.string().optional(),
});

/**
 * Moving a dispatch forward. Stock comes off the shelf at the moment it is
 * picked, and dispatch details are required before anything can be marked as
 * sent — no more "I think it went out last week".
 */
export async function advanceDispatch(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = advanceSchema.safeParse({
    requestId: formString(formData, 'requestId') ?? '',
    status: formString(formData, 'status') ?? '',
    carrier: formString(formData, 'carrier'),
    trackingRef: formString(formData, 'trackingRef'),
  });
  if (!parsed.success) return { error: 'Could not update that dispatch' };

  const { requestId, status, carrier, trackingRef } = parsed.data;
  const request = await db.partRequest.findUnique({
    where: { id: requestId },
    include: { lines: true },
  });
  if (!request) return { error: 'That dispatch no longer exists' };

  if (status === 'APPROVED' && !isManagement(user.role) && user.team !== 'Warehouse') {
    return { error: 'Only a team lead, manager or the warehouse can approve a dispatch.' };
  }

  if (status === 'DISPATCHED' && !(carrier && trackingRef)) {
    return { error: 'Add the carrier and tracking reference before marking it dispatched.' };
  }

  // Stock leaves the shelf once, when picking starts.
  if (status === 'PICKING' && request.status !== 'PICKING') {
    for (const line of request.lines) {
      await db.part.update({
        where: { id: line.partId },
        data: { stockQty: { decrement: line.qty } },
      });
    }
  }

  await db.partRequest.update({
    where: { id: requestId },
    data: {
      status,
      carrier: carrier ?? request.carrier,
      trackingRef: trackingRef ?? request.trackingRef,
      dispatchedAt: status === 'DISPATCHED' ? request.dispatchedAt ?? new Date() : request.dispatchedAt,
      deliveredAt: status === 'DELIVERED' ? request.deliveredAt ?? new Date() : request.deliveredAt,
    },
  });

  await db.activity.create({
    data: {
      type: 'DISPATCH',
      summary: `${request.ref} — ${status.replace(/_/g, ' ').toLowerCase()} by ${user.name}`,
      body: trackingRef ? `${carrier ?? 'Carrier'} tracking: ${trackingRef}` : null,
      customerId: request.customerId,
      ticketId: request.ticketId,
      partRequestId: request.id,
      userId: user.id,
      sourceSystem: 'CRM',
    },
  });

  revalidatePath('/dispatch');
  revalidatePath(`/customers/${request.customerId}`);
  if (request.ticketId) revalidatePath(`/cases/${request.ticketId}`);
  return { ok: true };
}
