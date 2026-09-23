'use client';

import { useActionState } from 'react';
import { PackageCheck, Send, XCircle } from 'lucide-react';

import { setPurchaseStatus } from '@/actions/purchasing';
import type { ActionState } from '@/lib/action-state';
import { FormMessage, SubmitButton } from '@/components/ui/submit-button';

/** The next step for a purchase order — only the steps that make sense from here. */
export function PurchaseActions({
  purchaseOrderId,
  status,
  defaultExpected,
}: {
  purchaseOrderId: string;
  status: string;
  defaultExpected: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(setPurchaseStatus, {});
  if (status !== 'DRAFT' && status !== 'SENT') {
    return <FormMessage ok={state.ok && state.message} error={state.error} />;
  }

  return (
    <form action={formAction} className="space-y-3 print:hidden">
      <input type="hidden" name="purchaseOrderId" value={purchaseOrderId} />
      {status === 'DRAFT' && (
        <div>
          <label className="field-label" htmlFor="expectedAt">Expected delivery</label>
          <input id="expectedAt" name="expectedAt" type="date" defaultValue={defaultExpected} className="field" />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {status === 'DRAFT' ? (
          <SubmitButton name="status" value="SENT" pendingLabel="Saving…">
            <Send className="h-3.5 w-3.5" />
            Mark as sent to supplier
          </SubmitButton>
        ) : (
          <SubmitButton name="status" value="RECEIVED" variant="dark" pendingLabel="Booking in…">
            <PackageCheck className="h-3.5 w-3.5" />
            Receive into stock
          </SubmitButton>
        )}
        <SubmitButton name="status" value="CANCELLED" variant="ghost">
          <XCircle className="h-3.5 w-3.5" />
          Cancel order
        </SubmitButton>
      </div>
      <FormMessage error={state.error} ok={state.ok && state.message} />
    </form>
  );
}
