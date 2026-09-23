'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { db } from '@/lib/db';
import { canManageStock, requireUser } from '@/lib/auth';
import { echo, type ActionState } from '@/lib/action-state';
import { PURCHASE_OPEN_STATUSES } from '@/lib/constants';
import { moveStock } from '@/lib/stock';
import { addDays, formString, roundMoney } from '@/lib/utils';

const NOT_ALLOWED = 'Only management and the warehouse can raise purchase orders.';

async function nextRef() {
  const last = await db.purchaseOrder.findFirst({
    where: { ref: { startsWith: 'PUR-' } },
    orderBy: { ref: 'desc' },
    select: { ref: true },
  });
  return `PUR-${(Number(last?.ref.replace('PUR-', '')) || 1000) + 1}`;
}

const createSchema = z.object({
  supplier: z.string().min(2, 'Name the supplier'),
  notes: z.string().optional(),
  lines: z
    .array(z.object({ partId: z.string(), qty: z.number().int().min(1), unitCost: z.number().min(0) }))
    .min(1, 'Add at least one part to buy'),
});

/** A purchase order raised by hand, one supplier at a time. */
export async function createPurchaseOrder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const values = echo(formData);
  if (!canManageStock(user)) return { error: NOT_ALLOWED, values };

  const partIds = [...new Set(formData.getAll('partId').map(String).filter(Boolean))];
  const parts = await db.part.findMany({ where: { id: { in: partIds } } });
  if (parts.length !== partIds.length) {
    return { error: 'One of those parts is no longer in the catalogue', values };
  }
  const lines = partIds.map((id) => {
    const part = parts.find((p) => p.id === id);
    const qty = Math.floor(Number(formData.get(`qty_${id}`) ?? 0));
    const cost = Number(formData.get(`cost_${id}`) ?? part?.unitCost ?? 0);
    return { partId: id, qty, unitCost: Number.isFinite(cost) ? roundMoney(cost) : 0 };
  });

  const parsed = createSchema.safeParse({
    supplier: formString(formData, 'supplier') ?? '',
    notes: formString(formData, 'notes'),
    lines,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue?.path[0] === 'lines' && issue.path.length > 1
      ? 'Every line needs a quantity of at least 1'
      : issue?.message;
    return { error: message ?? 'Check the form and try again', values };
  }

  const po = await db.purchaseOrder.create({
    data: {
      ref: await nextRef(),
      supplier: parsed.data.supplier,
      notes: parsed.data.notes ?? null,
      createdById: user.id,
      total: roundMoney(parsed.data.lines.reduce((s, l) => s + l.qty * l.unitCost, 0)),
      lines: { create: parsed.data.lines },
    },
  });

  revalidatePath('/inventory/purchasing');
  redirect(`/inventory/purchasing/${po.id}`);
}

/**
 * One click from the low-stock list: a draft purchase order per supplier for
 * everything at or below its reorder level that is not already on order.
 */
export async function raiseReorders() {
  const user = await requireUser();
  if (!canManageStock(user)) return;

  const [parts, onOrder] = await Promise.all([
    db.part.findMany({ where: { isActive: true }, orderBy: { sku: 'asc' } }),
    db.purchaseOrderLine.findMany({
      where: { purchaseOrder: { status: { in: [...PURCHASE_OPEN_STATUSES] } } },
      select: { partId: true },
    }),
  ]);
  const alreadyOrdered = new Set(onOrder.map((l) => l.partId));
  const due = parts.filter((p) => p.stockQty <= p.reorderLevel && !alreadyOrdered.has(p.id));

  const bySupplier = new Map<string, typeof due>();
  for (const part of due) {
    const supplier = part.supplier ?? 'Supplier to be confirmed';
    bySupplier.set(supplier, [...(bySupplier.get(supplier) ?? []), part]);
  }

  for (const [supplier, list] of bySupplier) {
    await db.purchaseOrder.create({
      data: {
        ref: await nextRef(),
        supplier,
        notes: 'Raised from the low-stock list.',
        createdById: user.id,
        total: roundMoney(list.reduce((s, p) => s + p.reorderQty * p.unitCost, 0)),
        lines: {
          create: list.map((p) => ({ partId: p.id, qty: p.reorderQty, unitCost: p.unitCost })),
        },
      },
    });
  }

  revalidatePath('/inventory');
  revalidatePath('/inventory/purchasing');
  redirect('/inventory/purchasing?view=open');
}

const MOVES: Record<string, string[]> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['RECEIVED', 'CANCELLED'],
};

/**
 * Draft → sent → received. Receiving books every line into stock through the
 * ledger, so the shelf and the paperwork can never disagree.
 */
export async function setPurchaseStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!canManageStock(user)) return { error: NOT_ALLOWED };

  const id = formString(formData, 'purchaseOrderId');
  const status = formString(formData, 'status');
  if (!id || !status) return { error: 'Could not update that purchase order' };

  const po = await db.purchaseOrder.findUnique({
    where: { id },
    include: { lines: { include: { part: { select: { leadTimeDays: true } } } } },
  });
  if (!po) return { error: 'That purchase order no longer exists' };
  if (!(MOVES[po.status] ?? []).includes(status)) {
    return { error: `A ${po.status.toLowerCase()} purchase order cannot be marked ${status.toLowerCase()}.` };
  }

  const expected = formString(formData, 'expectedAt');
  if (expected && Number.isNaN(new Date(expected).getTime())) {
    return { error: 'That expected date is not valid' };
  }
  await db.$transaction(async (tx) => {
    if (status === 'RECEIVED') {
      for (const line of po.lines) {
        await moveStock(tx, {
          partId: line.partId,
          change: line.qty,
          reason: 'RECEIVED',
          ref: po.ref,
          userId: user.id,
        });
      }
    }
    const lead = Math.max(0, ...po.lines.map((l) => l.part.leadTimeDays));
    await tx.purchaseOrder.update({
      where: { id },
      data: {
        status,
        sentAt: status === 'SENT' ? new Date() : po.sentAt,
        expectedAt:
          status === 'SENT'
            ? expected
              ? new Date(expected)
              : addDays(new Date(), lead || 14)
            : po.expectedAt,
        receivedAt: status === 'RECEIVED' ? new Date() : po.receivedAt,
      },
    });
  });

  revalidatePath('/inventory');
  revalidatePath('/inventory/purchasing');
  revalidatePath(`/inventory/purchasing/${id}`);
  for (const line of po.lines) revalidatePath(`/inventory/${line.partId}`);
  return {
    ok: true,
    message:
      status === 'RECEIVED'
        ? `${po.lines.reduce((s, l) => s + l.qty, 0)} items booked into stock.`
        : status === 'SENT'
          ? 'Marked as sent to the supplier.'
          : 'Purchase order cancelled.',
  };
}
