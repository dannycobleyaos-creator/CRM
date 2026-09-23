'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { db } from '@/lib/db';
import { canManageStock, requireUser } from '@/lib/auth';
import { echo, type ActionState } from '@/lib/action-state';
import { MANUAL_STOCK_REASONS, PART_CATEGORIES } from '@/lib/constants';
import { moveStock } from '@/lib/stock';
import { formString } from '@/lib/utils';

const NOT_ALLOWED = 'Only management and the warehouse can change the inventory.';

const money = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .min(0, `${label} cannot be negative`)
    .max(100000, `${label} looks too high — check the decimal point`);

const partSchema = z.object({
  sku: z
    .string()
    .min(3, 'Give the part a SKU')
    .max(40)
    .transform((v) => v.toUpperCase().replace(/\s+/g, '-')),
  name: z.string().min(3, 'Give the part a name an agent would recognise'),
  category: z.enum(PART_CATEGORIES),
  unitCost: money('Cost price'),
  unitPrice: money('Selling price'),
  reorderLevel: z.coerce.number().int().min(0, 'Reorder level cannot be negative'),
  reorderQty: z.coerce.number().int().min(1, 'Reorder quantity must be at least 1'),
  leadTimeDays: z.coerce.number().int().min(0).max(365),
  supplier: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

/** Creates a part, or updates one when `partId` is present. */
export async function savePart(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = echo(formData);
  if (!canManageStock(user)) return { error: NOT_ALLOWED, values };

  const partId = formString(formData, 'partId');
  const parsed = partSchema.safeParse({
    sku: formString(formData, 'sku') ?? '',
    name: formString(formData, 'name') ?? '',
    category: formString(formData, 'category') ?? 'SPARE',
    unitCost: formString(formData, 'unitCost') ?? '0',
    unitPrice: formString(formData, 'unitPrice') ?? '0',
    reorderLevel: formString(formData, 'reorderLevel') ?? '0',
    reorderQty: formString(formData, 'reorderQty') ?? '1',
    leadTimeDays: formString(formData, 'leadTimeDays') ?? '14',
    supplier: formString(formData, 'supplier'),
    location: formString(formData, 'location'),
    notes: formString(formData, 'notes'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again', values };
  }
  const data = parsed.data;

  const clash = await db.part.findUnique({ where: { sku: data.sku }, select: { id: true } });
  if (clash && clash.id !== partId) {
    return { error: `${data.sku} is already in the catalogue — open that part instead.`, values };
  }

  const fields = {
    sku: data.sku,
    name: data.name,
    category: data.category,
    unitCost: data.unitCost,
    unitPrice: data.unitPrice,
    reorderLevel: data.reorderLevel,
    reorderQty: data.reorderQty,
    leadTimeDays: data.leadTimeDays,
    supplier: data.supplier ?? null,
    location: data.location ?? null,
    notes: data.notes ?? null,
  };

  if (partId) {
    await db.part.update({ where: { id: partId }, data: fields });
    revalidatePath('/inventory');
    revalidatePath(`/inventory/${partId}`);
    return { ok: true, message: 'Saved. New orders use these prices straight away.' };
  }

  const opening = Math.max(0, Number(formString(formData, 'openingStock') ?? 0) || 0);
  const part = await db.$transaction(async (tx) => {
    const created = await tx.part.create({ data: { ...fields, stockQty: 0 } });
    if (opening > 0) {
      await moveStock(tx, {
        partId: created.id,
        change: opening,
        reason: 'STOCK_TAKE',
        note: 'Opening stock when the part was added',
        userId: user.id,
      });
    }
    return created;
  });

  revalidatePath('/inventory');
  redirect(`/inventory/${part.id}`);
}

/** Retire a part from ordering without losing its history. */
export async function setPartActive(formData: FormData) {
  const user = await requireUser();
  if (!canManageStock(user)) return;
  const partId = formString(formData, 'partId');
  if (!partId) return;
  await db.part.update({
    where: { id: partId },
    data: { isActive: formString(formData, 'active') === 'true' },
  });
  revalidatePath('/inventory');
  revalidatePath(`/inventory/${partId}`);
}

const adjustSchema = z.object({
  partId: z.string().min(1),
  reason: z.enum(MANUAL_STOCK_REASONS as [string, ...string[]]),
  quantity: z.coerce.number({ invalid_type_error: 'Enter a whole number' }).int('Enter a whole number'),
  note: z.string().optional(),
});

/**
 * Correcting stock by hand. A stock take sets the counted figure; anything else
 * is a change up or down. Either way it lands in the ledger with a reason.
 */
export async function adjustStock(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = echo(formData);
  if (!canManageStock(user)) return { error: NOT_ALLOWED, values };

  const parsed = adjustSchema.safeParse({
    partId: formString(formData, 'partId') ?? '',
    reason: formString(formData, 'reason') ?? '',
    quantity: formString(formData, 'quantity') ?? '',
    note: formString(formData, 'note'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again', values };
  }
  const { partId, reason, quantity, note } = parsed.data;

  const part = await db.part.findUnique({ where: { id: partId }, select: { stockQty: true } });
  if (!part) return { error: 'That part no longer exists', values };

  const change = reason === 'STOCK_TAKE' ? quantity - part.stockQty : quantity;
  if (reason === 'STOCK_TAKE' && quantity < 0) {
    return { error: 'A counted quantity cannot be negative', values };
  }
  if (change === 0) return { error: 'That would not change the stock level', values };
  if (part.stockQty + change < 0) {
    return { error: `Only ${part.stockQty} on the shelf — you cannot remove ${-change}.`, values };
  }
  if (reason === 'ADJUSTMENT' && !note) {
    return { error: 'Say why the stock is being adjusted — it is the audit trail', values };
  }

  await db.$transaction((tx) =>
    moveStock(tx, {
      partId,
      change,
      reason: reason as (typeof MANUAL_STOCK_REASONS)[number],
      note: note ?? null,
      userId: user.id,
    }),
  );

  revalidatePath('/inventory');
  revalidatePath(`/inventory/${partId}`);
  return { ok: true, message: `Stock ${change > 0 ? 'up' : 'down'} ${Math.abs(change)}.` };
}

/* -------------------------------------------------------------------------- */
/* Products and bills of materials                                            */
/* -------------------------------------------------------------------------- */

const productSchema = z.object({
  code: z
    .string()
    .min(3, 'Give the product a code')
    .max(40)
    .transform((v) => v.toUpperCase().replace(/\s+/g, '-')),
  name: z.string().min(3, 'Give the product a name'),
  sizeSpec: z.string().optional(),
  description: z.string().optional(),
  basePrice: money('Selling price'),
});

export async function saveProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = echo(formData);
  if (!canManageStock(user)) return { error: NOT_ALLOWED, values };

  const productId = formString(formData, 'productId');
  const parsed = productSchema.safeParse({
    code: formString(formData, 'code') ?? '',
    name: formString(formData, 'name') ?? '',
    sizeSpec: formString(formData, 'sizeSpec'),
    description: formString(formData, 'description'),
    basePrice: formString(formData, 'basePrice') ?? '0',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again', values };
  }
  const data = parsed.data;

  const clash = await db.product.findUnique({ where: { code: data.code }, select: { id: true } });
  if (clash && clash.id !== productId) {
    return { error: `${data.code} is already a product code.`, values };
  }

  const fields = {
    code: data.code,
    name: data.name,
    sizeSpec: data.sizeSpec ?? null,
    description: data.description ?? null,
    basePrice: data.basePrice,
  };

  if (productId) {
    await db.product.update({ where: { id: productId }, data: fields });
    revalidatePath('/inventory/bom');
    revalidatePath(`/inventory/bom/${productId}`);
    return { ok: true, message: 'Product saved.' };
  }

  const product = await db.product.create({ data: fields });
  revalidatePath('/inventory/bom');
  redirect(`/inventory/bom/${product.id}`);
}

const bomSchema = z.object({
  productId: z.string().min(1),
  partId: z.string().min(1, 'Choose a part to add'),
  qty: z.coerce.number().int().min(1, 'Quantity must be at least 1').max(999),
  note: z.string().optional(),
});

/** Adds a part to a bill of materials, or sets its quantity if it is already there. */
export async function addBomLine(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = echo(formData);
  if (!canManageStock(user)) return { error: NOT_ALLOWED, values };

  const parsed = bomSchema.safeParse({
    productId: formString(formData, 'productId') ?? '',
    partId: formString(formData, 'partId') ?? '',
    qty: formString(formData, 'qty') ?? '1',
    note: formString(formData, 'note'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again', values };
  }
  const { productId, partId, qty, note } = parsed.data;
  const [product, part] = await Promise.all([
    db.product.findUnique({ where: { id: productId }, select: { id: true } }),
    db.part.findUnique({ where: { id: partId }, select: { id: true } }),
  ]);
  if (!product || !part) return { error: 'That product or part no longer exists', values };

  await db.bomLine.upsert({
    where: { productId_partId: { productId, partId } },
    create: { productId, partId, qty, note: note ?? null },
    update: { qty, note: note ?? null },
  });

  revalidatePath(`/inventory/bom/${productId}`);
  revalidatePath('/inventory/bom');
  return { ok: true };
}

/** Changes a line's quantity; zero takes it off the bill. */
export async function updateBomLine(formData: FormData) {
  const user = await requireUser();
  if (!canManageStock(user)) return;

  const lineId = formString(formData, 'lineId');
  const qty = Math.floor(Number(formString(formData, 'qty') ?? ''));
  if (!lineId || !Number.isFinite(qty) || qty < 0) return;

  const line = await db.bomLine.findUnique({ where: { id: lineId }, select: { productId: true } });
  if (!line) return;

  if (qty === 0) await db.bomLine.delete({ where: { id: lineId } });
  else await db.bomLine.update({ where: { id: lineId }, data: { qty } });

  revalidatePath(`/inventory/bom/${line.productId}`);
  revalidatePath('/inventory/bom');
}
