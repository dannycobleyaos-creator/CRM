'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { db } from '@/lib/db';
import { isManagement, requireUser } from '@/lib/auth';
import { echo, type ActionState } from '@/lib/action-state';
import { BILLING_META, BILLING_TYPES, PRIORITIES } from '@/lib/constants';
import { lineTotal, priceOrder } from '@/lib/pricing';
import { returnLines } from '@/lib/stock';
import { formString, formatPrice } from '@/lib/utils';

async function nextRef(prefix: 'SP-' | 'DSP-', floor: number) {
  const last =
    prefix === 'SP-'
      ? await db.partsOrder.findFirst({ where: { ref: { startsWith: prefix } }, orderBy: { ref: 'desc' }, select: { ref: true } })
      : await db.partRequest.findFirst({ where: { ref: { startsWith: prefix } }, orderBy: { ref: 'desc' }, select: { ref: true } });
  return `${prefix}${(Number(last?.ref.replace(prefix, '')) || floor) + 1}`;
}

const moneyInput = z.coerce.number().min(0, 'Amounts cannot be negative').max(100000);

const createSchema = z.object({
  customerId: z.string().min(1, 'Choose the customer the parts are for'),
  orderId: z.string().optional(),
  ticketId: z.string().optional(),
  billing: z.enum(BILLING_TYPES, { errorMap: () => ({ message: 'Choose how the parts are being paid for' }) }),
  priority: z.enum(PRIORITIES).default('NORMAL'),
  neededBy: z.string().optional(),
  deliveryCharge: moneyInput.default(0),
  discount: moneyInput.default(0),
  reason: z.string().min(5, 'Say why the parts are going out — it is the audit trail'),
  customerNote: z.string().optional(),
  paidNow: z.boolean(),
  paymentRef: z.string().optional(),
  lines: z
    .array(z.object({ partId: z.string(), qty: z.number().int().min(1, 'Every line needs a quantity of at least 1').max(500) }))
    .min(1, 'Add at least one part to the order'),
});

/**
 * Placing a parts order. One submission creates two records: the priced order
 * the customer gets a confirmation for, and the dispatch the warehouse works
 * from. Prices always come from the catalogue, never from the browser.
 *
 * Free-of-charge orders wait for approval like any dispatch (unless placed by
 * somebody who could approve it anyway); paid-for orders wait for payment and
 * are released to the warehouse the moment it is taken.
 */
export async function createPartsOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = echo(formData);

  const partIds = [...new Set(formData.getAll('partId').map(String).filter(Boolean))];
  const parsed = createSchema.safeParse({
    customerId: formString(formData, 'customerId') ?? '',
    orderId: formString(formData, 'orderId'),
    ticketId: formString(formData, 'ticketId'),
    billing: formString(formData, 'billing') ?? '',
    priority: formString(formData, 'priority') ?? 'NORMAL',
    neededBy: formString(formData, 'neededBy'),
    deliveryCharge: formString(formData, 'deliveryCharge') ?? '0',
    discount: formString(formData, 'discount') ?? '0',
    reason: formString(formData, 'reason') ?? '',
    customerNote: formString(formData, 'customerNote'),
    paidNow: formData.get('paidNow') === 'on',
    paymentRef: formString(formData, 'paymentRef'),
    lines: partIds.map((partId) => ({ partId, qty: Math.floor(Number(formData.get(`qty_${partId}`) ?? 0)) })),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the order and try again', values };
  }
  const data = parsed.data;
  const chargeable = data.billing === 'CHARGEABLE';
  const neededBy = data.neededBy ? new Date(data.neededBy) : null;
  if (neededBy && Number.isNaN(neededBy.getTime())) {
    return { error: 'That "needed by" date is not valid', values };
  }

  if (chargeable && data.paidNow && !data.paymentRef) {
    return { error: 'Add the payment reference — the last four digits of the card, or the bank reference.', values };
  }

  const [customer, parts] = await Promise.all([
    db.customer.findUnique({ where: { id: data.customerId } }),
    db.part.findMany({ where: { id: { in: data.lines.map((l) => l.partId) } } }),
  ]);
  if (!customer) return { error: 'That customer no longer exists', values };

  const inactive = parts.filter((p) => !p.isActive);
  if (parts.length !== data.lines.length || inactive.length) {
    return {
      error: inactive.length
        ? `${inactive.map((p) => p.name).join(', ')} has been retired and cannot be ordered.`
        : 'One of those parts is no longer in the catalogue.',
      values,
    };
  }

  // The order and case must belong to this customer — no cross-wiring records.
  const [order, ticket] = await Promise.all([
    data.orderId ? db.order.findFirst({ where: { id: data.orderId, customerId: customer.id } }) : null,
    data.ticketId ? db.ticket.findFirst({ where: { id: data.ticketId, customerId: customer.id } }) : null,
  ]);
  if (data.orderId && !order) return { error: 'That pergola order belongs to a different customer.', values };
  if (data.ticketId && !ticket) return { error: 'That case belongs to a different customer.', values };

  const lines = data.lines.map((l) => {
    const part = parts.find((p) => p.id === l.partId)!;
    return { part, qty: l.qty };
  });
  const totals = priceOrder({
    lines: lines.map((l) => ({ qty: l.qty, unitPrice: l.part.unitPrice })),
    billing: data.billing,
    deliveryCharge: data.deliveryCharge,
    discount: data.discount,
  });

  const paid = chargeable && data.paidNow;
  const canApprove = isManagement(user.role) || user.team === 'Warehouse';
  const released = paid || (!chargeable && canApprove);

  const [spRef, dspRef] = await Promise.all([nextRef('SP-', 5000), nextRef('DSP-', 3000)]);

  const created = await db.$transaction(async (tx) => {
    const dispatch = await tx.partRequest.create({
      data: {
        ref: dspRef,
        customerId: customer.id,
        orderId: order?.id ?? null,
        ticketId: ticket?.id ?? null,
        requestedById: user.id,
        status: released ? 'APPROVED' : 'REQUESTED',
        priority: data.priority,
        reason: data.reason,
        dueAt: neededBy,
        // Ship to the address already on the customer record — no re-keying.
        shipToName: customer.name,
        shipToLine1: customer.addressL1,
        shipToCity: customer.city,
        shipToPost: customer.postcode,
        lines: { create: lines.map((l) => ({ partId: l.part.id, qty: l.qty })) },
      },
    });

    const partsOrder = await tx.partsOrder.create({
      data: {
        ref: spRef,
        customerId: customer.id,
        orderId: order?.id ?? null,
        ticketId: ticket?.id ?? null,
        createdById: user.id,
        billing: data.billing,
        paymentStatus: chargeable ? (paid ? 'PAID' : 'AWAITING') : 'NOT_REQUIRED',
        paymentRef: paid ? data.paymentRef! : null,
        paidAt: paid ? new Date() : null,
        ...totals,
        shipToName: customer.name,
        shipToLine1: customer.addressL1,
        shipToLine2: customer.addressL2,
        shipToCity: customer.city,
        shipToPost: customer.postcode,
        customerNote:
          data.customerNote ??
          (chargeable ? null : `Supplied free of charge — ${BILLING_META[data.billing].label.toLowerCase()}.`),
        internalNote: data.reason,
        dispatchId: dispatch.id,
        lines: {
          create: lines.map((l) => ({
            partId: l.part.id,
            sku: l.part.sku,
            description: l.part.name,
            qty: l.qty,
            unitPrice: l.part.unitPrice,
            lineTotal: lineTotal({ qty: l.qty, unitPrice: l.part.unitPrice }),
          })),
        },
      },
    });

    await tx.activity.create({
      data: {
        type: 'DISPATCH',
        summary: `Parts order ${spRef} placed by ${user.name} — ${
          chargeable ? formatPrice(totals.total) : `no charge (${data.billing.toLowerCase()})`
        }`,
        body: [
          lines.map((l) => `${l.qty} × ${l.part.name}`).join(', '),
          data.reason,
          released
            ? 'Released to the warehouse straight away.'
            : chargeable
              ? 'Held for payment.'
              : 'Waiting for approval.',
        ].join('\n'),
        customerId: customer.id,
        orderId: order?.id ?? null,
        ticketId: ticket?.id ?? null,
        partRequestId: dispatch.id,
        partsOrderId: partsOrder.id,
        userId: user.id,
        sourceSystem: 'CRM',
      },
    });

    return partsOrder;
  });

  revalidatePath('/parts-orders');
  revalidatePath('/dispatch');
  revalidatePath(`/customers/${customer.id}`);
  if (order) revalidatePath(`/orders/${order.id}`);
  if (ticket) revalidatePath(`/cases/${ticket.id}`);
  redirect(`/parts-orders/${created.id}?placed=1`);
}

/**
 * Taking payment releases the order to the warehouse. This is the hand-off
 * that used to be an email to the warehouse saying "they've paid, send it".
 */
export async function markPartsOrderPaid(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = echo(formData);
  const id = formString(formData, 'partsOrderId');
  const paymentRef = formString(formData, 'paymentRef');
  if (!id) return { error: 'Could not find that order', values };
  if (!paymentRef) {
    return { error: 'Add the payment reference — the last four digits of the card, or the bank reference.', values };
  }

  const order = await db.partsOrder.findUnique({ where: { id }, include: { dispatch: true } });
  if (!order) return { error: 'That order no longer exists', values };
  if (order.status === 'CANCELLED') return { error: 'This order was cancelled.', values };
  if (order.paymentStatus !== 'AWAITING') return { error: 'This order is not waiting for payment.', values };

  await db.$transaction(async (tx) => {
    await tx.partsOrder.update({
      where: { id },
      data: { paymentStatus: 'PAID', paymentRef, paidAt: new Date() },
    });
    if (order.dispatch?.status === 'REQUESTED') {
      await tx.partRequest.update({ where: { id: order.dispatch.id }, data: { status: 'APPROVED' } });
    }
    await tx.activity.create({
      data: {
        type: 'DISPATCH',
        summary: `${order.ref} paid — ${formatPrice(order.total)} taken by ${user.name}`,
        body: `Payment reference: ${paymentRef}. Released to the warehouse.`,
        customerId: order.customerId,
        orderId: order.orderId,
        ticketId: order.ticketId,
        partRequestId: order.dispatchId,
        partsOrderId: order.id,
        userId: user.id,
        sourceSystem: 'CRM',
      },
    });
  });

  revalidatePath('/parts-orders');
  revalidatePath(`/parts-orders/${id}`);
  revalidatePath('/dispatch');
  revalidatePath(`/customers/${order.customerId}`);
  return { ok: true, message: 'Payment recorded — the warehouse can pick it now.' };
}

/**
 * Cancelling takes the dispatch down with it and puts any picked stock back on
 * the shelf. Once the parcel has left, it is a return, not a cancellation.
 */
export async function cancelPartsOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = echo(formData);
  const id = formString(formData, 'partsOrderId');
  const reason = formString(formData, 'reason');
  if (!id) return { error: 'Could not find that order', values };
  if (!reason || reason.length < 4) return { error: 'Say why the order is being cancelled', values };

  const order = await db.partsOrder.findUnique({
    where: { id },
    include: { dispatch: { include: { lines: true } } },
  });
  if (!order) return { error: 'That order no longer exists', values };
  if (order.status === 'CANCELLED') return { error: 'This order is already cancelled.', values };
  if (order.dispatch && ['DISPATCHED', 'DELIVERED'].includes(order.dispatch.status)) {
    return { error: 'These parts have already been sent. Arrange a return instead of cancelling.', values };
  }

  const refundDue = order.paymentStatus === 'PAID' && order.total > 0;
  await db.$transaction(async (tx) => {
    const dispatch = order.dispatch;
    if (dispatch && dispatch.status !== 'CANCELLED') {
      if (dispatch.pickedAt) {
        await returnLines(tx, dispatch.lines, { ref: dispatch.ref, userId: user.id, note: `${order.ref} cancelled` });
      }
      await tx.partRequest.update({
        where: { id: dispatch.id },
        data: { status: 'CANCELLED', pickedAt: null },
      });
    }
    await tx.partsOrder.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await tx.activity.create({
      data: {
        type: 'DISPATCH',
        summary: `${order.ref} cancelled by ${user.name}`,
        body: `${reason}${refundDue ? `\nRefund due: ${formatPrice(order.total)}.` : ''}`,
        customerId: order.customerId,
        orderId: order.orderId,
        ticketId: order.ticketId,
        partRequestId: order.dispatchId,
        partsOrderId: order.id,
        userId: user.id,
        sourceSystem: 'CRM',
      },
    });
  });

  revalidatePath('/parts-orders');
  revalidatePath(`/parts-orders/${id}`);
  revalidatePath('/dispatch');
  revalidatePath('/inventory');
  revalidatePath(`/customers/${order.customerId}`);
  return {
    ok: true,
    message: refundDue
      ? `Cancelled. ${formatPrice(order.total)} was paid — arrange the refund.`
      : 'Cancelled. The warehouse will no longer see it.',
  };
}
