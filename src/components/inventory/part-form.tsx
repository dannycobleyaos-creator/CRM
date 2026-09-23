'use client';

import { useActionState, useState } from 'react';
import { Save } from 'lucide-react';

import { savePart } from '@/actions/inventory';
import type { ActionState } from '@/lib/action-state';
import { PART_CATEGORIES, PART_CATEGORY_META } from '@/lib/constants';
import { formatPrice, percent } from '@/lib/utils';
import { FormMessage, SubmitButton } from '@/components/ui/submit-button';

export type PartFormValues = {
  id?: string;
  sku: string;
  name: string;
  category: string;
  unitCost: number;
  unitPrice: number;
  reorderLevel: number;
  reorderQty: number;
  leadTimeDays: number;
  supplier: string | null;
  location: string | null;
  notes: string | null;
};

/**
 * Adding or editing a part. The margin updates as the prices are typed, so
 * nobody saves a spare that sells for less than it costs without noticing.
 */
export function PartForm({ part, suppliers }: { part?: PartFormValues; suppliers: string[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(savePart, {});
  const typed = state.values ?? {};
  const value = (key: keyof PartFormValues, fallback = '') =>
    typed[key] ?? (part && part[key] !== null && part[key] !== undefined ? String(part[key]) : fallback);

  const [cost, setCost] = useState(value('unitCost', '0'));
  const [price, setPrice] = useState(value('unitPrice', '0'));
  const costN = Number(cost) || 0;
  const priceN = Number(price) || 0;
  const margin = priceN > 0 ? percent(priceN - costN, priceN) : null;
  const loss = priceN > 0 && priceN < costN;

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {part?.id && <input type="hidden" name="partId" value={part.id} />}

      <div>
        <label className="field-label" htmlFor="sku">SKU</label>
        <input id="sku" name="sku" required defaultValue={value('sku')} placeholder="HP-LVR-3000-GY" className="field font-mono uppercase" />
      </div>
      <div>
        <label className="field-label" htmlFor="category">Category</label>
        <select id="category" name="category" defaultValue={value('category', 'SPARE')} className="field">
          {PART_CATEGORIES.map((c) => (
            <option key={c} value={c}>{PART_CATEGORY_META[c].label}</option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-2">
        <label className="field-label" htmlFor="name">Name</label>
        <input id="name" name="name" required defaultValue={value('name')} placeholder="Roof louvre blade 3.0m — matt grey" className="field" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-4">
        <div>
          <label className="field-label" htmlFor="unitCost">Cost (ex VAT)</label>
          <input id="unitCost" name="unitCost" type="number" min={0} step="0.01" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} className="field tabular-nums" />
        </div>
        <div>
          <label className="field-label" htmlFor="unitPrice">Price (ex VAT)</label>
          <input id="unitPrice" name="unitPrice" type="number" min={0} step="0.01" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="field tabular-nums" />
        </div>
        <div className="col-span-2 flex items-end">
          <p className={`rounded-brand px-3 py-2 text-xs ${loss ? 'bg-clay-soft text-clay' : 'bg-sand/60 text-slate'}`}>
            {margin === null
              ? 'Set a selling price to see the margin.'
              : loss
                ? `Sells below cost — a loss of ${formatPrice(costN - priceN)} on every one.`
                : `Margin ${margin}% · ${formatPrice(priceN - costN)} a unit · ${formatPrice(priceN * 1.2)} inc VAT`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:col-span-2">
        <div>
          <label className="field-label" htmlFor="reorderLevel">Reorder at</label>
          <input id="reorderLevel" name="reorderLevel" type="number" min={0} defaultValue={value('reorderLevel', '5')} className="field tabular-nums" />
        </div>
        <div>
          <label className="field-label" htmlFor="reorderQty">Reorder qty</label>
          <input id="reorderQty" name="reorderQty" type="number" min={1} defaultValue={value('reorderQty', '10')} className="field tabular-nums" />
        </div>
        <div>
          <label className="field-label" htmlFor="leadTimeDays">Lead time (days)</label>
          <input id="leadTimeDays" name="leadTimeDays" type="number" min={0} defaultValue={value('leadTimeDays', '14')} className="field tabular-nums" />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="supplier">Supplier</label>
        <input id="supplier" name="supplier" list="supplier-list" defaultValue={value('supplier')} className="field" />
        <datalist id="supplier-list">
          {suppliers.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="field-label" htmlFor="location">Warehouse bay</label>
        <input id="location" name="location" defaultValue={value('location')} placeholder="A1-04" className="field font-mono" />
      </div>

      {!part?.id && (
        <div>
          <label className="field-label" htmlFor="openingStock">Opening stock</label>
          <input id="openingStock" name="openingStock" type="number" min={0} defaultValue={typed.openingStock ?? '0'} className="field tabular-nums" />
        </div>
      )}

      <div className={part?.id ? 'sm:col-span-2' : ''}>
        <label className="field-label" htmlFor="notes">
          Notes <span className="normal-case tracking-normal text-slate/60">(optional)</span>
        </label>
        <input id="notes" name="notes" defaultValue={value('notes')} placeholder="Fits pergolas made after March 2024" className="field" />
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <SubmitButton pendingLabel="Saving…">
          <Save className="h-3.5 w-3.5" />
          {part?.id ? 'Save changes' : 'Add to catalogue'}
        </SubmitButton>
        <FormMessage error={state.error} ok={state.ok && state.message} />
      </div>
    </form>
  );
}
