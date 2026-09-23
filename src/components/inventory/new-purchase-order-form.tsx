'use client';

import { useActionState, useMemo, useState } from 'react';
import { ClipboardList, X } from 'lucide-react';

import { createPurchaseOrder } from '@/actions/purchasing';
import type { ActionState } from '@/lib/action-state';
import { cn, formatPrice } from '@/lib/utils';
import { FormMessage, SubmitButton } from '@/components/ui/submit-button';

type PartOption = {
  id: string;
  sku: string;
  name: string;
  supplier: string | null;
  unitCost: number;
  stockQty: number;
  reorderLevel: number;
  reorderQty: number;
};

/**
 * Raising a purchase order by hand. Choosing the supplier narrows the list to
 * what they make, and low-stock lines float to the top with the usual reorder
 * quantity already filled in.
 */
export function NewPurchaseOrderForm({ parts, suppliers }: { parts: PartOption[]; suppliers: string[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(createPurchaseOrder, {});
  const typed = state.values ?? {};
  const [supplier, setSupplier] = useState(typed.supplier ?? suppliers[0] ?? '');
  const [selected, setSelected] = useState<Record<string, { qty: number; cost: number }>>({});

  const options = useMemo(
    () =>
      parts
        .filter((p) => !supplier || p.supplier === supplier)
        .sort((a, b) => Number(b.stockQty <= b.reorderLevel) - Number(a.stockQty <= a.reorderLevel)),
    [parts, supplier],
  );
  const total = Object.values(selected).reduce((s, l) => s + l.qty * l.cost, 0);

  const toggle = (p: PartOption) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[p.id]) delete next[p.id];
      else next[p.id] = { qty: p.reorderQty, cost: p.unitCost };
      return next;
    });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-brand border border-stone bg-white px-4 text-xs font-medium text-ink transition-colors hover:bg-sand"
      >
        <ClipboardList className="h-4 w-4" />
        Raise a purchase order
      </button>
    );
  }

  return (
    <div className="card w-full p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="brand-eyebrow">Purchasing</p>
          <h2 className="mt-1 font-display text-base font-medium text-ink">New purchase order</h2>
          <p className="mt-1 text-xs text-slate">Saved as a draft. Nothing reaches the supplier until you mark it sent.</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-brand p-1.5 text-slate hover:bg-sand hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>

      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="po-supplier">Supplier</label>
            <input
              id="po-supplier"
              name="supplier"
              list="po-suppliers"
              required
              value={supplier}
              onChange={(e) => {
                setSupplier(e.target.value);
                setSelected({});
              }}
              className="field"
            />
            <datalist id="po-suppliers">
              {suppliers.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="field-label" htmlFor="po-notes">
              Notes <span className="normal-case tracking-normal text-slate/60">(optional)</span>
            </label>
            <input id="po-notes" name="notes" defaultValue={typed.notes ?? ''} placeholder="Deliver to goods-in door 2" className="field" />
          </div>
        </div>

        <fieldset>
          <legend className="field-label">Parts to buy</legend>
          <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-brand border border-stone bg-sand/30 p-2">
            {options.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-slate">No parts from this supplier in the catalogue.</p>
            )}
            {options.map((p) => {
              const line = selected[p.id];
              const low = p.stockQty <= p.reorderLevel;
              return (
                <div
                  key={p.id}
                  className={cn(
                    'flex flex-wrap items-center gap-3 rounded-[0.4rem] border bg-white px-3 py-2',
                    line ? 'border-ember/40' : 'border-stone/70',
                  )}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                    <input type="checkbox" name="partId" value={p.id} checked={!!line} onChange={() => toggle(p)} className="h-3.5 w-3.5 accent-[#B9763C]" />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-ink">{p.name}</span>
                      <span className="block font-mono text-2xs text-slate">
                        {p.sku} ·{' '}
                        <span className={low ? 'text-amber' : undefined}>
                          {p.stockQty} in stock{low ? ', reorder' : ''}
                        </span>
                      </span>
                    </span>
                  </label>
                  {line && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        name={`qty_${p.id}`}
                        min={1}
                        value={line.qty}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [p.id]: { ...line, qty: Math.max(0, Number(e.target.value) || 0) } }))}
                        aria-label={`Quantity of ${p.name}`}
                        className="field h-8 w-20 text-xs tabular-nums"
                      />
                      <span className="text-2xs text-slate">@</span>
                      <input
                        type="number"
                        name={`cost_${p.id}`}
                        min={0}
                        step="0.01"
                        value={line.cost}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [p.id]: { ...line, cost: Math.max(0, Number(e.target.value) || 0) } }))}
                        aria-label={`Unit cost of ${p.name}`}
                        className="field h-8 w-24 text-xs tabular-nums"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <FormMessage error={state.error} />
          <div className="ml-auto flex items-center gap-4">
            <span className="text-xs text-slate">
              Total <span className="ml-1 text-sm font-semibold tabular-nums text-ink">{formatPrice(total)}</span>
              <span className="ml-1">ex VAT</span>
            </span>
            <SubmitButton pendingLabel="Saving…">Save draft</SubmitButton>
          </div>
        </div>
      </form>
    </div>
  );
}
