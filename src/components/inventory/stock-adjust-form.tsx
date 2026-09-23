'use client';

import { useActionState, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';

import { adjustStock } from '@/actions/inventory';
import type { ActionState } from '@/lib/action-state';
import { MANUAL_STOCK_REASONS, STOCK_MOVE_META } from '@/lib/constants';
import { FormMessage, SubmitButton } from '@/components/ui/submit-button';

/**
 * Correcting the shelf by hand. A stock take asks for what was counted; any
 * other reason asks for the change. Both land in the ledger with a name on them.
 */
export function StockAdjustForm({ partId, current }: { partId: string; current: number }) {
  const [state, formAction] = useActionState<ActionState, FormData>(adjustStock, {});
  const typed = state.values ?? {};
  const [reason, setReason] = useState(typed.reason ?? 'STOCK_TAKE');
  const isCount = reason === 'STOCK_TAKE';

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="partId" value={partId} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="reason">Reason</label>
          <select
            id="reason"
            name="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="field"
          >
            {MANUAL_STOCK_REASONS.map((r) => (
              <option key={r} value={r}>
                {STOCK_MOVE_META[r].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="quantity">
            {isCount ? 'Counted on shelf' : 'Change (+ or −)'}
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            required
            step={1}
            min={isCount ? 0 : undefined}
            placeholder={isCount ? String(current) : '-2'}
            defaultValue={typed.quantity ?? ''}
            className="field tabular-nums"
          />
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="note">
          Note {reason !== 'ADJUSTMENT' && <span className="normal-case tracking-normal text-slate/60">(optional)</span>}
        </label>
        <input
          id="note"
          name="note"
          defaultValue={typed.note ?? ''}
          placeholder={reason === 'ADJUSTMENT' ? 'Two blades found damaged in the rack' : 'Quarterly count'}
          className="field"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton variant="dark" pendingLabel="Updating…">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Update stock
        </SubmitButton>
        <FormMessage error={state.error} ok={state.ok && state.message} />
      </div>
    </form>
  );
}
