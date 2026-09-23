'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

import { addBomLine } from '@/actions/inventory';
import type { ActionState } from '@/lib/action-state';
import { FormMessage, SubmitButton } from '@/components/ui/submit-button';

type PartOption = { id: string; sku: string; name: string };

/** Adds a part to the bill — or, if it is already on it, sets its quantity. */
export function BomLineForm({ productId, parts }: { productId: string; parts: PartOption[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(addBomLine, {});
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const typed = state.values ?? {};

  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    router.refresh();
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="productId" value={productId} />
      <div className="min-w-[16rem] flex-1">
        <label className="field-label" htmlFor="bom-part">Part</label>
        <select id="bom-part" name="partId" required defaultValue={typed.partId ?? ''} className="field">
          <option value="">Choose a part…</option>
          {parts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.sku}
            </option>
          ))}
        </select>
      </div>
      <div className="w-24">
        <label className="field-label" htmlFor="bom-qty">Qty</label>
        <input id="bom-qty" name="qty" type="number" min={1} required defaultValue={typed.qty ?? '1'} className="field tabular-nums" />
      </div>
      <SubmitButton variant="secondary" pendingLabel="Adding…" className="h-10">
        <Plus className="h-3.5 w-3.5" />
        Add to bill
      </SubmitButton>
      <div className="basis-full">
        <FormMessage error={state.error} />
      </div>
    </form>
  );
}
