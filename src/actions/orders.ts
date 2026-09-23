'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { echo, type ActionState } from '@/lib/action-state';
import {
  ORDER_DATE_KINDS,
  ORDER_DATE_META,
  ORDER_STATUSES,
  ORDER_STATUS_META,
  PERGOLA_COLOURS,
} from '@/lib/constants';
import { formatDate, formString } from '@/lib/utils';

function revalidateOrder(orderId: string, customerId: string) {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/orders');
  revalidatePath(`/customers/${customerId}`);
  revalidatePath('/');
}

/** Whether an id belongs to an active member of the team. */
async function isTeamMember(userId: string) {
  return !!(await db.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true } }));
}

/** "2026-10-14" + "09:30" → a Date in the server's local time. */
function parseWhen(date?: string, time?: string) {
  if (!date) return null;
  const when = new Date(`${date}T${time || '09:00'}`);
  return Number.isNaN(when.getTime()) ? null : when;
}

/* -------------------------------------------------------------------------- */
/* Creating an order                                                          */
/* -------------------------------------------------------------------------- */

const createSchema = z.object({
  customerId: z.string().min(1, 'Choose the customer'),
  productId: z.string().optional(),
  productLine: z.string().optional(),
  sizeSpec: z.string().optional(),
  colour: z.enum(PERGOLA_COLOURS),
  extras: z.string().optional(),
  value: z.coerce.number().min(0, 'The value cannot be negative').max(1_000_000),
  status: z.enum(ORDER_STATUSES),
  deliveryDue: z.string().optional(),
  ownerId: z.string().optional(),
});

export async function createOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = echo(formData);

  const parsed = createSchema.safeParse({
    customerId: formString(formData, 'customerId') ?? '',
    productId: formString(formData, 'productId'),
    productLine: formString(formData, 'productLine'),
    sizeSpec: formString(formData, 'sizeSpec'),
    colour: formString(formData, 'colour') ?? 'MATT_GREY',
    extras: formString(formData, 'extras'),
    value: formString(formData, 'value') ?? '0',
    status: formString(formData, 'status') ?? 'QUOTE',
    deliveryDue: formString(formData, 'deliveryDue'),
    ownerId: formString(formData, 'ownerId'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again', values };
  }
  const data = parsed.data;

  const [customer, product] = await Promise.all([
    db.customer.findUnique({ where: { id: data.customerId } }),
    data.productId ? db.product.findUnique({ where: { id: data.productId } }) : null,
  ]);
  if (!customer) return { error: 'That customer no longer exists', values };
  if (data.productId && !product) return { error: 'That product is no longer in the catalogue', values };
  if (data.ownerId && !(await isTeamMember(data.ownerId))) {
    return { error: 'Choose an owner from the team', values };
  }
  if (data.deliveryDue && !parseWhen(data.deliveryDue)) return { error: 'That delivery date is not valid', values };
  const productLine = data.productLine ?? product?.name;
  if (!productLine) return { error: 'Choose a product, or describe what was ordered', values };

  const last = await db.order.findFirst({
    where: { ref: { startsWith: 'HP-ORD-' } },
    orderBy: { ref: 'desc' },
    select: { ref: true },
  });
  const ref = `HP-ORD-${(Number(last?.ref.replace('HP-ORD-', '')) || 2000) + 1}`;
  const deliveryDue = parseWhen(data.deliveryDue);
  const ownerId = data.ownerId ?? customer.ownerId ?? user.id;

  const order = await db.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        ref,
        customerId: customer.id,
        productId: product?.id ?? null,
        productLine,
        sizeSpec: data.sizeSpec ?? product?.sizeSpec ?? null,
        colour: data.colour,
        extras: data.extras ?? null,
        value: data.value || product?.basePrice || 0,
        status: data.status,
        ownerId,
        deliveryDue,
      },
    });
    if (deliveryDue) {
      await tx.orderDate.create({
        data: {
          orderId: created.id,
          kind: 'DELIVERY',
          label: 'Delivery',
          dueAt: deliveryDue,
          ownerId,
          createdById: user.id,
        },
      });
    }
    await tx.activity.create({
      data: {
        type: 'STATUS_CHANGE',
        summary: `Order ${ref} created by ${user.name} — ${productLine}`,
        customerId: customer.id,
        orderId: created.id,
        userId: user.id,
        sourceSystem: 'CRM',
      },
    });
    return created;
  });

  revalidatePath('/orders');
  revalidatePath(`/customers/${customer.id}`);
  redirect(`/orders/${order.id}`);
}

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

/** Which key date a status change completes — delivered means the delivery happened. */
const COMPLETES: Partial<Record<string, string>> = {
  DELIVERED: 'DELIVERY',
  INSTALLED: 'INSTALL',
};

export async function setOrderStatus(formData: FormData) {
  const user = await requireUser();
  const orderId = formString(formData, 'orderId');
  const status = z.enum(ORDER_STATUSES).safeParse(formString(formData, 'status'));
  if (!orderId || !status.success) return;

  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.status === status.data) return;

  const now = new Date();
  const kind = COMPLETES[status.data];
  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: status.data,
        installedAt: status.data === 'INSTALLED' ? order.installedAt ?? now : order.installedAt,
      },
    });
    if (kind) {
      await tx.orderDate.updateMany({
        where: { orderId, kind, doneAt: null, dueAt: { lte: new Date(now.getTime() + 864e5) } },
        data: { doneAt: now },
      });
    }
    await tx.activity.create({
      data: {
        type: 'STATUS_CHANGE',
        summary: `Order moved to “${ORDER_STATUS_META[status.data].label}” by ${user.name}`,
        body: `Was “${ORDER_STATUS_META[order.status as keyof typeof ORDER_STATUS_META]?.label ?? order.status}”.`,
        customerId: order.customerId,
        orderId,
        userId: user.id,
        sourceSystem: 'CRM',
      },
    });
  });

  revalidateOrder(orderId, order.customerId);
}

/* -------------------------------------------------------------------------- */
/* Key dates                                                                  */
/* -------------------------------------------------------------------------- */

const dateSchema = z.object({
  orderId: z.string().min(1),
  kind: z.enum(ORDER_DATE_KINDS),
  label: z.string().optional(),
  date: z.string().min(1, 'Pick a date'),
  time: z.string().optional(),
  ownerId: z.string().min(1, 'Every date needs somebody responsible for it'),
  note: z.string().optional(),
});

/**
 * Adds a key date to an order. A delivery date also becomes the order's
 * delivery-due date, so the two can never disagree.
 */
export async function addOrderDate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = echo(formData);

  const parsed = dateSchema.safeParse({
    orderId: formString(formData, 'orderId') ?? '',
    kind: formString(formData, 'kind') ?? 'OTHER',
    label: formString(formData, 'label'),
    date: formString(formData, 'date') ?? '',
    time: formString(formData, 'time'),
    ownerId: formString(formData, 'ownerId') ?? '',
    note: formString(formData, 'note'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again', values };
  }
  const data = parsed.data;
  const dueAt = parseWhen(data.date, data.time);
  if (!dueAt) return { error: 'That date is not valid', values };

  const order = await db.order.findUnique({ where: { id: data.orderId } });
  if (!order) return { error: 'That order no longer exists', values };
  if (!(await isTeamMember(data.ownerId))) return { error: 'Choose somebody from the team', values };

  const label = data.label ?? ORDER_DATE_META[data.kind].label;
  await db.$transaction(async (tx) => {
    await tx.orderDate.create({
      data: {
        orderId: order.id,
        kind: data.kind,
        label,
        note: data.note ?? null,
        dueAt,
        ownerId: data.ownerId,
        createdById: user.id,
      },
    });
    if (data.kind === 'DELIVERY') {
      await tx.order.update({ where: { id: order.id }, data: { deliveryDue: dueAt } });
    }
    await tx.activity.create({
      data: {
        type: 'NOTE',
        summary: `${label} booked for ${formatDate(dueAt)} by ${user.name}`,
        body: data.note ?? null,
        customerId: order.customerId,
        orderId: order.id,
        userId: user.id,
        sourceSystem: 'CRM',
      },
    });
  });

  revalidateOrder(order.id, order.customerId);
  return { ok: true };
}

/** Ticks a key date off, or un-ticks it if it was marked done by mistake. */
export async function toggleOrderDate(formData: FormData) {
  const user = await requireUser();
  const id = formString(formData, 'dateId');
  if (!id) return;

  const date = await db.orderDate.findUnique({ where: { id }, include: { order: true } });
  if (!date) return;

  const done = !date.doneAt;
  await db.$transaction([
    db.orderDate.update({ where: { id }, data: { doneAt: done ? new Date() : null } }),
    db.activity.create({
      data: {
        type: 'NOTE',
        summary: done
          ? `${date.label} marked done by ${user.name}`
          : `${date.label} reopened by ${user.name}`,
        customerId: date.order.customerId,
        orderId: date.orderId,
        userId: user.id,
        sourceSystem: 'CRM',
      },
    }),
  ]);
  revalidateOrder(date.orderId, date.order.customerId);
}

const moveSchema = z.object({
  dateId: z.string().min(1),
  date: z.string().min(1, 'Pick the new date'),
  time: z.string().optional(),
  ownerId: z.string().optional(),
  reason: z.string().optional(),
});

/** Moving a date keeps the old one in the history — "when did it change, and why?" */
export async function rescheduleOrderDate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = echo(formData);

  const parsed = moveSchema.safeParse({
    dateId: formString(formData, 'dateId') ?? '',
    date: formString(formData, 'date') ?? '',
    time: formString(formData, 'time'),
    ownerId: formString(formData, 'ownerId'),
    reason: formString(formData, 'reason'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again', values };
  }
  const data = parsed.data;
  const dueAt = parseWhen(data.date, data.time);
  if (!dueAt) return { error: 'That date is not valid', values };

  const date = await db.orderDate.findUnique({ where: { id: data.dateId }, include: { order: true } });
  if (!date) return { error: 'That date no longer exists', values };
  if (data.ownerId && !(await isTeamMember(data.ownerId))) {
    return { error: 'Choose somebody from the team', values };
  }

  await db.$transaction(async (tx) => {
    await tx.orderDate.update({
      where: { id: date.id },
      data: { dueAt, ownerId: data.ownerId ?? date.ownerId, doneAt: null },
    });
    if (date.kind === 'DELIVERY') {
      await tx.order.update({ where: { id: date.orderId }, data: { deliveryDue: dueAt } });
    }
    await tx.activity.create({
      data: {
        type: 'NOTE',
        summary: `${date.label} moved from ${formatDate(date.dueAt)} to ${formatDate(dueAt)} by ${user.name}`,
        body: data.reason ?? null,
        customerId: date.order.customerId,
        orderId: date.orderId,
        userId: user.id,
        sourceSystem: 'CRM',
      },
    });
  });

  revalidateOrder(date.orderId, date.order.customerId);
  return { ok: true };
}

export async function removeOrderDate(formData: FormData) {
  const user = await requireUser();
  const id = formString(formData, 'dateId');
  if (!id) return;
  const date = await db.orderDate.findUnique({ where: { id }, include: { order: true } });
  if (!date) return;

  await db.$transaction([
    db.orderDate.delete({ where: { id } }),
    db.activity.create({
      data: {
        type: 'NOTE',
        summary: `${date.label} (${formatDate(date.dueAt)}) removed by ${user.name}`,
        customerId: date.order.customerId,
        orderId: date.orderId,
        userId: user.id,
        sourceSystem: 'CRM',
      },
    }),
  ]);
  revalidateOrder(date.orderId, date.order.customerId);
}
