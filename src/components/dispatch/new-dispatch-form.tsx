'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { PackagePlus, X } from 'lucide-react';

import { createPartRequest, type ActionState } from '@/actions/dispatch';
import { PRIORITIES, PRIORITY_META } from '@/lib/constants';
import { cn } from '@/lib/utils';

type PartOption = { id: string; sku: string; name: string; stockQty: number };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center gap-2 rounded-brand bg-ember px-4 text-xs font-medium text-white transition-colors hover:bg-ember-dark disabled:opacity-55"
    >
      <PackagePlus className="h-3.5 w-3.5" />
      {pending ? 'Raising…' : 'Raise dispatch'}
    </button>
  );
}

export function NewDispatchForm({
  customers,
  parts,
}: {
  customers: { id: string; name: string; ref: string }[];
  parts: PartOption[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [state, formAction] = useActionState<ActionState, FormData>(createPartRequest, {});
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // React clears the form once the action settles. The part checkboxes survive
  // because they are React state; the echoed values restore the rest.
  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    setSelected([]);
    router.refresh();
  }, [state.ok, router]);

  const typed = state.values ?? {};

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-brand bg-ember px-4 text-xs font-medium text-white transition-colors hover:bg-ember-dark"
      >
        <PackagePlus className="h-4 w-4" />
        Send parts out
      </button>
    );
  }

  return (
    <div className="card w-full p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="brand-eyebrow">Warehouse</p>
          <h2 className="mt-1 font-display text-base font-medium text-ink">Raise a parts dispatch</h2>
          <p className="mt-1 text-xs text-slate">
            Ships to the address already on the customer record. Stock comes off the shelf when
            picking starts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="rounded-brand p-1.5 text-slate hover:bg-sand hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form ref={formRef} action={formAction} className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="customerId">
            Customer
          </label>
          <select
            id="customerId"
            name="customerId"
            required
            defaultValue={typed.customerId ?? ''}
            className="field"
          >
            <option value="">Choose a customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.ref}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="priority">
              Priority
            </label>
            <select
              id="priority"
              name="priority"
              defaultValue={typed.priority || 'NORMAL'}
              className="field"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_META[p].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="dueAt">
              Needed by
            </label>
            <input
              id="dueAt"
              name="dueAt"
              type="date"
              defaultValue={typed.dueAt ?? ''}
              className="field"
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="reason">
            Why are these going out?
          </label>
          <input
            id="reason"
            name="reason"
            required
            placeholder="Two louvre blades short against the packing list — confirmed by the installer"
            defaultValue={typed.reason ?? ''}
            className="field"
          />
        </div>

        <fieldset className="sm:col-span-2">
          <legend className="field-label">Parts</legend>
          <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-brand border border-stone bg-sand/30 p-2">
            {parts.map((p) => {
              const isSelected = selected.includes(p.id);
              const low = p.stockQty <= 0;
              return (
                <div
                  key={p.id}
                  className={cn(
                    'flex items-center gap-3 rounded-[0.4rem] border bg-white px-3 py-2 transition-colors',
                    isSelected ? 'border-ember/40' : 'border-stone/70',
                  )}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      name="partId"
                      value={p.id}
                      checked={isSelected}
                      onChange={() => toggle(p.id)}
                      className="h-3.5 w-3.5 accent-[#B9763C]"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-ink">{p.name}</span>
                      <span className="block font-mono text-2xs text-slate">
                        {p.sku} ·{' '}
                        <span className={low ? 'text-clay' : 'text-slate'}>
                          {p.stockQty} in stock
                        </span>
                      </span>
                    </span>
                  </label>

                  {isSelected && (
                    <input
                      type="number"
                      name={`qty_${p.id}`}
                      min={1}
                      defaultValue={1}
                      aria-label={`Quantity of ${p.name}`}
                      className="field h-8 w-16 text-xs"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>

        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="notes">
            Notes for the warehouse{' '}
            <span className="normal-case tracking-normal text-slate/60">(optional)</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            defaultValue={typed.notes ?? ''}
            className="field resize-y"
          />
        </div>

        {state.error && (
          <p role="alert" className="text-xs text-clay sm:col-span-2">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p role="status" className="text-xs text-moss sm:col-span-2">
            Dispatch raised and logged on the customer record.
          </p>
        )}

        <div className="sm:col-span-2">
          <Submit />
        </div>
      </form>
    </div>
  );
}
