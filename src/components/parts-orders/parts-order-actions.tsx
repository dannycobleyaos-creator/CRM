'use client';

import { useActionState, useState } from 'react';
import { Ban, CreditCard } from 'lucide-react';

import { cancelPartsOrder, markPartsOrderPaid } from '@/actions/parts-orders';
import type { ActionState } from '@/lib/action-state';
import { formatPrice } from '@/lib/utils';
import { FormMessage, SubmitButton } from '@/components/ui/submit-button';

export function MarkPaidForm({ partsOrderId, total }: { partsOrderId: string; total: number }) {
  const [state, formAction] = useActionState<ActionState, FormData>(markPartsOrderPaid, {});
  if (state.ok) return <FormMessage ok={state.message} />;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="partsOrderId" value={partsOrderId} />
      <div>
        <label className="field-label" htmlFor="paymentRef">Payment reference</label>
        <input
          id="paymentRef"
          name="paymentRef"
          required
          defaultValue={state.values?.paymentRef ?? ''}
          placeholder="Card ending 4821, or bank reference"
          className="field"
        />
      </div>
      <SubmitButton pendingLabel="Recording…">
        <CreditCard className="h-3.5 w-3.5" />
        Mark {formatPrice(total)} paid
      </SubmitButton>
      <FormMessage error={state.error} />
    </form>
  );
}

export function CancelOrderForm({ partsOrderId }: { partsOrderId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(cancelPartsOrder, {});
  if (state.ok) return <FormMessage ok={state.message} />;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-slate underline-offset-4 hover:text-clay hover:underline"
      >
        <Ban className="h-3.5 w-3.5" />
        Cancel this order
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-brand border border-clay/30 bg-clay-soft/40 p-3">
      <input type="hidden" name="partsOrderId" value={partsOrderId} />
      <div>
        <label className="field-label" htmlFor="cancel-reason">Why is it being cancelled?</label>
        <input
          id="cancel-reason"
          name="reason"
          required
          defaultValue={state.values?.reason ?? ''}
          placeholder="Customer found the missing part in the packaging"
          className="field"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton variant="danger" pendingLabel="Cancelling…">
          Cancel order
        </SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate hover:text-ink">
          Keep it
        </button>
      </div>
      <FormMessage error={state.error} />
    </form>
  );
}
