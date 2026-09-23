'use client';

import { useActionState, useMemo, useState } from 'react';
import { Layers, Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';

import { createPartsOrder } from '@/actions/parts-orders';
import type { ActionState } from '@/lib/action-state';
import {
  BILLING_META,
  BILLING_TYPES,
  DEFAULT_PARTS_DELIVERY,
  PART_CATEGORY_META,
  PRIORITIES,
  PRIORITY_META,
  VAT_RATE,
  byCatalogueOrder,
  type BillingType,
  type PartCategory,
} from '@/lib/constants';
import { lineTotal, priceOrder } from '@/lib/pricing';
import { cn, formatPrice } from '@/lib/utils';
import { FormMessage, SubmitButton } from '@/components/ui/submit-button';

export type OrderablePart = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unitPrice: number;
  stockQty: number;
};

export type CustomerOrderOption = {
  id: string;
  ref: string;
  productLine: string;
  colour: string;
  productId: string | null;
};

type BasketLine = { partId: string; qty: number };

/**
 * The order form. The basket lives in React state, so a rejected submission
 * never loses the parts that were picked; prices are shown from the catalogue
 * and re-read on the server, which is the only place they are trusted.
 */
export function PartsOrderForm({
  customerId,
  orders,
  tickets,
  boms,
  parts,
  defaultOrderId,
  defaultTicketId,
  releasedOnPlacing,
}: {
  customerId: string;
  orders: CustomerOrderOption[];
  tickets: { id: string; ref: string; subject: string }[];
  boms: Record<string, { partId: string; qty: number }[]>;
  parts: OrderablePart[];
  defaultOrderId?: string;
  defaultTicketId?: string;
  /** Whether the person placing it can approve free-of-charge orders themselves. */
  releasedOnPlacing: boolean;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(createPartsOrder, {});
  const typed = state.values ?? {};

  const [orderId, setOrderId] = useState(typed.orderId ?? defaultOrderId ?? orders[0]?.id ?? '');
  const [billing, setBilling] = useState<BillingType>((typed.billing as BillingType) ?? 'WARRANTY');
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const [query, setQuery] = useState('');
  const [delivery, setDelivery] = useState(typed.deliveryCharge ?? String(DEFAULT_PARTS_DELIVERY));
  const [discount, setDiscount] = useState(typed.discount ?? '0');
  const [paidNow, setPaidNow] = useState(typed.paidNow === 'on');

  const byId = useMemo(() => new Map(parts.map((p) => [p.id, p])), [parts]);
  const bySku = useMemo(() => new Map(parts.map((p) => [p.sku, p])), [parts]);
  const chargeable = billing === 'CHARGEABLE';

  const order = orders.find((o) => o.id === orderId);
  const white = order?.colour === 'MATT_WHITE';

  // The bill of materials for the chosen pergola. Colour-specific parts are
  // listed in grey; a white pergola gets the white equivalent where one exists.
  const bom = useMemo(() => {
    const lines = order?.productId ? boms[order.productId] ?? [] : [];
    return lines
      .map((l) => {
        const part = byId.get(l.partId);
        if (!part) return null;
        const whiteTwin = white && part.sku.endsWith('-GY') ? bySku.get(part.sku.replace(/-GY$/, '-WH')) : undefined;
        return { part: whiteTwin ?? part, perPergola: l.qty, swapped: !!whiteTwin };
      })
      .filter((l): l is { part: OrderablePart; perPergola: number; swapped: boolean } => !!l)
      .sort((a, b) => byCatalogueOrder(a.part, b.part));
  }, [order, boms, byId, bySku, white]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return parts
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 8);
  }, [parts, query]);

  const add = (partId: string) =>
    setBasket((prev) =>
      prev.some((l) => l.partId === partId)
        ? prev.map((l) => (l.partId === partId ? { ...l, qty: l.qty + 1 } : l))
        : [...prev, { partId, qty: 1 }],
    );
  const setQty = (partId: string, qty: number) =>
    setBasket((prev) => prev.map((l) => (l.partId === partId ? { ...l, qty: Math.max(1, qty) } : l)));
  const remove = (partId: string) => setBasket((prev) => prev.filter((l) => l.partId !== partId));

  const priced = basket
    .map((l) => ({ ...l, part: byId.get(l.partId) }))
    .filter((l): l is BasketLine & { part: OrderablePart } => !!l.part);
  const totals = priceOrder({
    lines: priced.map((l) => ({ qty: l.qty, unitPrice: l.part.unitPrice })),
    billing,
    deliveryCharge: Number(delivery) || 0,
    discount: Number(discount) || 0,
  });

  return (
    <form action={formAction} className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <input type="hidden" name="customerId" value={customerId} />
      {priced.map((l) => (
        <span key={l.partId} hidden>
          <input type="hidden" name="partId" value={l.partId} />
          <input type="hidden" name={`qty_${l.partId}`} value={l.qty} />
        </span>
      ))}

      {/* Left: what and why */}
      <div className="space-y-6">
        <section className="card space-y-4 p-5">
          <h2 className="font-display text-base font-medium text-ink">What is it for?</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="orderId">Pergola order</label>
              <select id="orderId" name="orderId" value={orderId} onChange={(e) => setOrderId(e.target.value)} className="field">
                <option value="">Not linked to an order</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.ref} — {o.productLine}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="ticketId">Related case</label>
              <select id="ticketId" name="ticketId" defaultValue={typed.ticketId ?? defaultTicketId ?? ''} className="field">
                <option value="">No case</option>
                {tickets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.ref} — {t.subject}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset>
            <legend className="field-label">Who is paying?</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {BILLING_TYPES.map((b) => (
                <label
                  key={b}
                  className={cn(
                    'cursor-pointer rounded-brand border px-3 py-2.5 transition-colors',
                    billing === b ? 'border-charcoal bg-charcoal text-white' : 'border-stone bg-white hover:border-slate/50',
                  )}
                >
                  <input type="radio" name="billing" value={b} checked={billing === b} onChange={() => setBilling(b)} className="sr-only" />
                  <span className="block text-sm font-medium">{BILLING_META[b].label}</span>
                  <span className={cn('block text-2xs', billing === b ? 'text-white/75' : 'text-slate')}>{BILLING_META[b].hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label className="field-label" htmlFor="reason">Why are these going out?</label>
            <input
              id="reason"
              name="reason"
              required
              defaultValue={typed.reason ?? ''}
              placeholder={chargeable ? 'Customer buying a spare remote handset' : 'Two louvre blades short against the packing list'}
              className="field"
            />
            <p className="mt-1 text-2xs text-slate">For the team and the audit trail — not printed on the confirmation.</p>
          </div>
        </section>

        {/* Parts picker */}
        <section className="card overflow-hidden">
          <div className="border-b border-stone/70 px-5 py-4">
            <h2 className="font-display text-base font-medium text-ink">Add parts</h2>
            <p className="mt-1 text-xs text-slate">Pick from the pergola&apos;s bill of materials, or search the whole catalogue.</p>
          </div>

          {bom.length > 0 && (
            <div className="border-b border-stone/70 px-5 py-4">
              <p className="brand-eyebrow mb-2 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                In {order?.productLine}
                {white ? ' · matt white parts selected where they exist' : ''}
              </p>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {bom.map(({ part, perPergola, swapped }) => {
                  const inBasket = basket.find((l) => l.partId === part.id);
                  return (
                    <li key={part.id}>
                      <button
                        type="button"
                        onClick={() => add(part.id)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-[0.4rem] border bg-white px-3 py-2 text-left transition-colors hover:border-ember/50',
                          inBasket ? 'border-ember/50 bg-ember-soft/40' : 'border-stone/70',
                        )}
                      >
                        <Plus className="h-3.5 w-3.5 shrink-0 text-ember" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-ink">{part.name}</span>
                          <span className="block text-2xs text-slate">
                            {perPergola} per pergola · {formatPrice(part.unitPrice)}
                            {swapped ? ' · white' : ''}
                            {part.stockQty <= 0 ? ' · out of stock' : ''}
                          </span>
                        </span>
                        {inBasket && <span className="text-2xs font-semibold tabular-nums text-ember-dark">×{inBasket.qty}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="px-5 py-4">
            <label className="field-label" htmlFor="part-search">Search the catalogue</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate/60" />
              <input
                id="part-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Enter adds the top match rather than submitting the order.
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (matches[0]) {
                      add(matches[0].id);
                      setQuery('');
                    }
                  }
                }}
                placeholder="Remote, louvre, HP-LED…"
                className="field pl-9"
                autoComplete="off"
              />
            </div>
            {matches.length > 0 && (
              <ul className="mt-2 divide-y divide-stone/60 overflow-hidden rounded-brand border border-stone">
                {matches.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        add(p.id);
                        setQuery('');
                      }}
                      className="flex w-full items-center gap-3 bg-white px-3 py-2 text-left hover:bg-sand/50"
                    >
                      <Plus className="h-3.5 w-3.5 shrink-0 text-ember" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-ink">{p.name}</span>
                        <span className="block text-2xs text-slate">
                          <span className="font-mono">{p.sku}</span> ·{' '}
                          {PART_CATEGORY_META[p.category as PartCategory]?.label ?? p.category} ·{' '}
                          <span className={p.stockQty <= 0 ? 'text-clay' : undefined}>{p.stockQty} in stock</span>
                        </span>
                      </span>
                      <span className="text-xs tabular-nums text-ink">{formatPrice(p.unitPrice)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query.trim() && matches.length === 0 && (
              <p className="mt-2 text-xs text-slate">No parts match “{query}”.</p>
            )}
          </div>
        </section>
      </div>

      {/* Right: the basket and the money */}
      <div className="space-y-6">
        <section className="card overflow-hidden xl:sticky xl:top-24">
          <div className="flex items-center justify-between border-b border-stone/70 px-5 py-4">
            <h2 className="font-display text-base font-medium text-ink">Order</h2>
            <span className="text-2xs text-slate">{priced.reduce((s, l) => s + l.qty, 0)} items</span>
          </div>

          {priced.length ? (
            <ul className="divide-y divide-stone/60">
              {priced.map((l) => {
                const short = l.qty > l.part.stockQty;
                return (
                  <li key={l.partId} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-ink">{l.part.name}</p>
                        <p className="font-mono text-2xs text-slate">{l.part.sku}</p>
                        {short && (
                          <p className="mt-0.5 text-2xs text-amber">
                            Only {Math.max(0, l.part.stockQty)} in stock — the warehouse will wait for more
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(l.partId)}
                        aria-label={`Remove ${l.part.name}`}
                        className="rounded-brand p-1 text-slate/70 hover:bg-clay-soft hover:text-clay"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="inline-flex items-center rounded-brand border border-stone">
                        <button type="button" onClick={() => setQty(l.partId, l.qty - 1)} aria-label="One fewer" className="p-1.5 text-slate hover:text-ink">
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={l.qty}
                          onChange={(e) => setQty(l.partId, Math.floor(Number(e.target.value) || 1))}
                          aria-label={`Quantity of ${l.part.name}`}
                          className="w-12 border-x border-stone bg-white py-1 text-center text-xs tabular-nums focus:outline-none"
                        />
                        <button type="button" onClick={() => setQty(l.partId, l.qty + 1)} aria-label="One more" className="p-1.5 text-slate hover:text-ink">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-2xs text-slate">
                        {formatPrice(l.part.unitPrice)} each
                        <span className="ml-2 text-sm font-medium tabular-nums text-ink">
                          {formatPrice(lineTotal({ qty: l.qty, unitPrice: l.part.unitPrice }))}
                        </span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-xs text-slate">Nothing added yet.</p>
          )}

          <dl className="space-y-2 border-t border-stone/70 bg-sand/30 px-5 py-4 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-slate">Parts (ex VAT)</dt>
              <dd className="tabular-nums text-ink">{formatPrice(totals.subtotal)}</dd>
            </div>
            {chargeable ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <dt>
                    <label htmlFor="discount" className="text-slate">Discount</label>
                  </dt>
                  <dd>
                    <input id="discount" name="discount" type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className="field h-8 w-24 text-right text-xs tabular-nums" />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>
                    <label htmlFor="deliveryCharge" className="text-slate">Delivery</label>
                  </dt>
                  <dd>
                    <input id="deliveryCharge" name="deliveryCharge" type="number" min={0} step="0.01" value={delivery} onChange={(e) => setDelivery(e.target.value)} className="field h-8 w-24 text-right text-xs tabular-nums" />
                  </dd>
                </div>
              </>
            ) : (
              <div className="flex justify-between gap-3">
                <dt className="text-slate">Covered — {BILLING_META[billing].label.toLowerCase()}</dt>
                <dd className="tabular-nums text-moss">−{formatPrice(totals.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-slate">VAT at {Math.round(VAT_RATE * 100)}%</dt>
              <dd className="tabular-nums text-ink">{formatPrice(totals.vat)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-stone pt-2">
              <dt className="font-medium text-ink">Customer pays</dt>
              <dd className="font-display text-xl font-medium tabular-nums text-ink">{formatPrice(totals.total)}</dd>
            </div>
          </dl>

          <div className="space-y-4 border-t border-stone/70 px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label" htmlFor="priority">Priority</label>
                <select id="priority" name="priority" defaultValue={typed.priority ?? 'NORMAL'} className="field">
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{PRIORITY_META[p].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="neededBy">Needed by</label>
                <input id="neededBy" name="neededBy" type="date" defaultValue={typed.neededBy ?? ''} className="field" />
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="customerNote">
                Note for the customer <span className="normal-case tracking-normal text-slate/60">(printed)</span>
              </label>
              <input id="customerNote" name="customerNote" defaultValue={typed.customerNote ?? ''} placeholder="Fitting instructions are in the box" className="field" />
            </div>

            {chargeable && (
              <div className="rounded-brand border border-stone bg-white p-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-ink">
                  <input type="checkbox" name="paidNow" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} className="h-3.5 w-3.5 accent-[#B9763C]" />
                  Payment taken now
                </label>
                {paidNow && (
                  <input name="paymentRef" required defaultValue={typed.paymentRef ?? ''} placeholder="Card ending 4821, or bank reference" className="field mt-2" aria-label="Payment reference" />
                )}
              </div>
            )}

            <p className="text-2xs text-slate">
              {chargeable
                ? paidNow
                  ? 'Paid orders go straight to the warehouse to pick.'
                  : 'The warehouse will see it straight away but will not pick it until it is marked paid.'
                : releasedOnPlacing
                  ? 'You can approve free-of-charge orders, so it goes straight to the warehouse.'
                  : 'A team lead or the warehouse approves free-of-charge orders before they are picked.'}
            </p>

            <FormMessage error={state.error} />
            <SubmitButton size="md" className="w-full" pendingLabel="Placing order…">
              <ShoppingCart className="h-4 w-4" />
              Place order
            </SubmitButton>
          </div>
        </section>
      </div>
    </form>
  );
}
