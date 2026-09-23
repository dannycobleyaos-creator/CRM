'use client';

import { useActionState, useState } from 'react';
import { ClipboardPlus, X } from 'lucide-react';

import { createOrder } from '@/actions/orders';
import type { ActionState } from '@/lib/action-state';
import {
  ORDER_STATUSES,
  ORDER_STATUS_META,
  PERGOLA_COLOURS,
  PERGOLA_COLOUR_META,
} from '@/lib/constants';
import { FormMessage, SubmitButton } from '@/components/ui/submit-button';

type ProductOption = { id: string; name: string; sizeSpec: string | null; basePrice: number };

/**
 * A new pergola order. Choosing a catalogue product fills in the size and the
 * price and — more importantly — gives the order its bill of materials.
 */
export function NewOrderForm({
  customers,
  products,
  team,
  defaultCustomerId,
  defaultOpen = false,
}: {
  customers: { id: string; name: string; ref: string }[];
  products: ProductOption[];
  team: { id: string; name: string }[];
  defaultCustomerId?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [state, formAction] = useActionState<ActionState, FormData>(createOrder, {});
  const typed = state.values ?? {};
  const [productId, setProductId] = useState(typed.productId ?? '');
  const product = products.find((p) => p.id === productId);
  const [value, setValue] = useState(typed.value ?? '');

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-brand bg-ember px-4 text-xs font-medium text-white transition-colors hover:bg-ember-dark"
      >
        <ClipboardPlus className="h-4 w-4" />
        New order
      </button>
    );
  }

  return (
    <div className="card w-full p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="brand-eyebrow">Orders</p>
          <h2 className="mt-1 font-display text-base font-medium text-ink">New pergola order</h2>
          <p className="mt-1 text-xs text-slate">Opens the order record, where key dates, notes and parts are managed.</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-brand p-1.5 text-slate hover:bg-sand hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>

      <form action={formAction} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="order-customer">Customer</label>
          <select id="order-customer" name="customerId" required defaultValue={typed.customerId ?? defaultCustomerId ?? ''} className="field">
            <option value="">Choose a customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name} — {c.ref}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="order-product">Product</label>
          <select
            id="order-product"
            name="productId"
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              const next = products.find((p) => p.id === e.target.value);
              if (next && !value) setValue(String(next.basePrice));
            }}
            className="field"
          >
            <option value="">Something not in the catalogue…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {!productId && (
          <div className="sm:col-span-2 xl:col-span-4">
            <label className="field-label" htmlFor="order-line">What was ordered</label>
            <input id="order-line" name="productLine" defaultValue={typed.productLine ?? ''} placeholder="Bespoke 5x3.5m pergola, wall mounted" className="field" />
          </div>
        )}

        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="order-size">Size and layout</label>
          <input id="order-size" name="sizeSpec" key={productId} defaultValue={typed.sizeSpec ?? product?.sizeSpec ?? ''} className="field" />
        </div>
        <div>
          <label className="field-label" htmlFor="order-colour">Colour</label>
          <select id="order-colour" name="colour" defaultValue={typed.colour ?? 'MATT_GREY'} className="field">
            {PERGOLA_COLOURS.map((c) => (
              <option key={c} value={c}>{PERGOLA_COLOUR_META[c].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="order-value">Value inc VAT (£)</label>
          <input id="order-value" name="value" type="number" min={0} step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder={product ? String(product.basePrice) : '0'} className="field tabular-nums" />
        </div>

        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="order-extras">Extras</label>
          <input id="order-extras" name="extras" defaultValue={typed.extras ?? ''} placeholder="LED lighting + 3 windproof blinds" className="field" />
        </div>
        <div>
          <label className="field-label" htmlFor="order-status">Status</label>
          <select id="order-status" name="status" defaultValue={typed.status ?? 'QUOTE'} className="field">
            {ORDER_STATUSES.filter((s) => s !== 'CANCELLED').map((s) => (
              <option key={s} value={s}>{ORDER_STATUS_META[s].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="order-delivery">Delivery due</label>
          <input id="order-delivery" name="deliveryDue" type="date" defaultValue={typed.deliveryDue ?? ''} className="field" />
        </div>

        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="order-owner">Owner</label>
          <select id="order-owner" name="ownerId" defaultValue={typed.ownerId ?? ''} className="field">
            <option value="">The customer&apos;s account owner</option>
            {team.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2 xl:col-span-4">
          <SubmitButton pendingLabel="Creating…">
            <ClipboardPlus className="h-3.5 w-3.5" />
            Create order
          </SubmitButton>
          <FormMessage error={state.error} />
        </div>
      </form>
    </div>
  );
}
