'use client';

import { useActionState } from 'react';
import { Save } from 'lucide-react';

import { saveProduct } from '@/actions/inventory';
import type { ActionState } from '@/lib/action-state';
import { FormMessage, SubmitButton } from '@/components/ui/submit-button';

export type ProductFormValues = {
  id?: string;
  code: string;
  name: string;
  sizeSpec: string | null;
  description: string | null;
  basePrice: number;
};

export function ProductForm({ product }: { product?: ProductFormValues }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveProduct, {});
  const typed = state.values ?? {};
  const value = (key: keyof ProductFormValues, fallback = '') =>
    typed[key] ?? (product && product[key] !== null && product[key] !== undefined ? String(product[key]) : fallback);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {product?.id && <input type="hidden" name="productId" value={product.id} />}
      <div>
        <label className="field-label" htmlFor="code">Product code</label>
        <input id="code" name="code" required defaultValue={value('code')} placeholder="HP-PG-4X3" className="field font-mono uppercase" />
      </div>
      <div>
        <label className="field-label" htmlFor="basePrice">Selling price (inc VAT)</label>
        <input id="basePrice" name="basePrice" type="number" min={0} step="0.01" required defaultValue={value('basePrice', '0')} className="field tabular-nums" />
      </div>
      <div className="sm:col-span-2">
        <label className="field-label" htmlFor="name">Name</label>
        <input id="name" name="name" required defaultValue={value('name')} placeholder="Hygge™ Aluminium Pergola 4x3m" className="field" />
      </div>
      <div className="sm:col-span-2">
        <label className="field-label" htmlFor="sizeSpec">Size and layout</label>
        <input id="sizeSpec" name="sizeSpec" defaultValue={value('sizeSpec')} placeholder="4m x 3m, freestanding, 4 posts" className="field" />
      </div>
      <div className="sm:col-span-2">
        <label className="field-label" htmlFor="description">
          Description <span className="normal-case tracking-normal text-slate/60">(optional)</span>
        </label>
        <textarea id="description" name="description" rows={2} defaultValue={value('description')} className="field resize-y" />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <SubmitButton pendingLabel="Saving…">
          <Save className="h-3.5 w-3.5" />
          {product?.id ? 'Save product' : 'Create product'}
        </SubmitButton>
        <FormMessage error={state.error} ok={state.ok && state.message} />
      </div>
    </form>
  );
}
