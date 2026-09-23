import 'server-only';

import type { Prisma } from '@prisma/client';

import type { StockMoveReason } from './constants';

type Tx = Prisma.TransactionClient;

/**
 * The only way stock changes. Every move writes a ledger row with the balance
 * it left behind, so the number on the shelf can always be explained: who took
 * it, when, and for which dispatch or delivery.
 */
export async function moveStock(
  tx: Tx,
  move: {
    partId: string;
    change: number;
    reason: StockMoveReason;
    ref?: string | null;
    note?: string | null;
    userId?: string | null;
  },
) {
  const part = await tx.part.update({
    where: { id: move.partId },
    data: { stockQty: { increment: move.change } },
    select: { stockQty: true },
  });
  await tx.stockMove.create({
    data: {
      partId: move.partId,
      change: move.change,
      balance: part.stockQty,
      reason: move.reason,
      ref: move.ref ?? null,
      note: move.note ?? null,
      userId: move.userId ?? null,
    },
  });
  return part.stockQty;
}

export type Shortfall = { name: string; sku: string; have: number; need: number };

/** What cannot be picked from the shelf right now, line by line. */
export async function findShortfalls(
  tx: Tx,
  lines: { partId: string; qty: number }[],
): Promise<Shortfall[]> {
  const need = new Map<string, number>();
  for (const l of lines) need.set(l.partId, (need.get(l.partId) ?? 0) + l.qty);

  const parts = await tx.part.findMany({
    where: { id: { in: [...need.keys()] } },
    select: { id: true, name: true, sku: true, stockQty: true },
  });
  return parts
    .filter((p) => p.stockQty < (need.get(p.id) ?? 0))
    .map((p) => ({ name: p.name, sku: p.sku, have: p.stockQty, need: need.get(p.id) ?? 0 }));
}

export const describeShortfalls = (short: Shortfall[]) =>
  short.map((s) => `${s.need} × ${s.name} (${s.have} on the shelf)`).join(', ');

/** Takes a dispatch's lines off the shelf, once, inside the caller's transaction. */
export async function pickLines(
  tx: Tx,
  lines: { partId: string; qty: number }[],
  meta: { ref: string; userId: string },
) {
  for (const line of lines) {
    await moveStock(tx, {
      partId: line.partId,
      change: -line.qty,
      reason: 'PICKED',
      ref: meta.ref,
      userId: meta.userId,
    });
  }
}

/** Puts picked stock back — a cancelled dispatch should never lose parts. */
export async function returnLines(
  tx: Tx,
  lines: { partId: string; qty: number }[],
  meta: { ref: string; userId: string; note?: string },
) {
  for (const line of lines) {
    await moveStock(tx, {
      partId: line.partId,
      change: line.qty,
      reason: 'RETURNED',
      ref: meta.ref,
      note: meta.note ?? 'Dispatch cancelled after picking — back on the shelf',
      userId: meta.userId,
    });
  }
}
