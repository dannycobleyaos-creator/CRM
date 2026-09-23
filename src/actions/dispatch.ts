'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { db } from '@/lib/db';
import { isManagement, requireUser } from '@/lib/auth';
import { DISPATCH_STATUSES } from '@/lib/constants';
import { describeShortfalls, findShortfalls, pickLines, returnLines } from '@/lib/stock';
import { formString } from '@/lib/utils';

/** Carries back what was typed — React clears the form when the action settles. */
export type ActionState = {
  error?: string;
  ok?: boolean;
  values?: Record<string, string>;
};

const advanceSchema = z.object({
  requestId: z.string().min(1),
  status: z.enum(DISPATCH_STATUSES),
  carrier: z.string().optional(),
  trackingRef: z.string().optional(),
});

/** Once a parcel has left, the only way forward is delivered. */
const LEFT_THE_BUILDING = ['DISPATCHED', 'DELIVERED'];

/**
 * Moving a dispatch forward. Stock comes off the shelf once — the first time
 * the dispatch is picked or sent — and goes back if it is cancelled after that.
 * Dispatch details are required before anything can be marked as sent, so
 * there is no more "I think it went out last week".
 *
 * New dispatches are only ever created by placing a parts order, which is what
 * prices them; see `src/actions/parts-orders.ts`.
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
    include: { lines: true, partsOrder: true },
  });
  if (!request) return { error: 'That dispatch no longer exists' };

  if (request.status === status) return { ok: true };
  if (LEFT_THE_BUILDING.includes(request.status) && status !== 'DELIVERED') {
    return { error: 'This parcel has already gone out — it can only be marked delivered now.' };
  }
  if (request.status === 'CANCELLED') {
    return { error: 'This dispatch was cancelled. Place a new parts order if the parts are still needed.' };
  }

  if (status === 'APPROVED' && !isManagement(user.role) && user.team !== 'Warehouse') {
    return { error: 'Only a team lead, manager or the warehouse can approve a dispatch.' };
  }

  // A paid-for order is released by its payment, not by a click in the queue.
  const order = request.partsOrder;
  if (
    order?.billing === 'CHARGEABLE' &&
    order.paymentStatus === 'AWAITING' &&
    ['APPROVED', 'PICKING', 'DISPATCHED'].includes(status)
  ) {
    return {
      error: `${order.ref} is awaiting payment. Mark it paid on the parts order and it will be released to the warehouse automatically.`,
    };
  }

  if (status === 'DISPATCHED' && !(carrier && trackingRef)) {
    return { error: 'Add the carrier and tracking reference before marking it dispatched.' };
  }

  const takesStock = (status === 'PICKING' || status === 'DISPATCHED') && !request.pickedAt;
  const givesStockBack = status === 'CANCELLED' && !!request.pickedAt;

  if (takesStock) {
    const short = await findShortfalls(db, request.lines);
    if (short.length) {
      return {
        error: `Not enough on the shelf to pick: ${describeShortfalls(short)}. Mark it short on stock and raise a purchase order.`,
      };
    }
  }

  await db.$transaction(async (tx) => {
    if (takesStock) await pickLines(tx, request.lines, { ref: request.ref, userId: user.id });
    if (givesStockBack) await returnLines(tx, request.lines, { ref: request.ref, userId: user.id });

    await tx.partRequest.update({
      where: { id: requestId },
      data: {
        status,
        carrier: carrier ?? request.carrier,
        trackingRef: trackingRef ?? request.trackingRef,
        pickedAt: takesStock ? new Date() : givesStockBack ? null : request.pickedAt,
        dispatchedAt: status === 'DISPATCHED' ? request.dispatchedAt ?? new Date() : request.dispatchedAt,
        deliveredAt: status === 'DELIVERED' ? request.deliveredAt ?? new Date() : request.deliveredAt,
      },
    });

    // A dispatch the warehouse rejects takes its order with it, so the agent
    // who placed it sees the outcome on the order rather than a silent gap.
    if (status === 'CANCELLED' && order && order.status !== 'CANCELLED') {
      await tx.partsOrder.update({
        where: { id: order.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
    }

    await tx.activity.create({
      data: {
        type: 'DISPATCH',
        summary: `${request.ref} — ${status.replace(/_/g, ' ').toLowerCase()} by ${user.name}`,
        body: trackingRef
          ? `${carrier ?? 'Carrier'} tracking: ${trackingRef}`
          : givesStockBack
            ? 'Picked stock returned to the shelf.'
            : null,
        customerId: request.customerId,
        ticketId: request.ticketId,
        orderId: request.orderId,
        partRequestId: request.id,
        partsOrderId: order?.id ?? null,
        userId: user.id,
        sourceSystem: 'CRM',
      },
    });
  });

  revalidatePath('/dispatch');
  revalidatePath('/inventory');
  revalidatePath(`/customers/${request.customerId}`);
  if (request.ticketId) revalidatePath(`/cases/${request.ticketId}`);
  if (request.orderId) revalidatePath(`/orders/${request.orderId}`);
  if (order) revalidatePath(`/parts-orders/${order.id}`);
  return { ok: true };
}
