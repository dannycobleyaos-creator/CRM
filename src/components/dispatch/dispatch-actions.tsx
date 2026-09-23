'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Check, PackageCheck, Truck, XCircle } from 'lucide-react';

import { advanceDispatch, type ActionState } from '@/actions/dispatch';
import { CARRIERS, type DispatchStatus } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * Which buttons make sense from where. Keeping this in one place is what stops
 * a dispatch being "sent" twice or skipping the approval step.
 */
const NEXT_STEPS: Record<string, { status: DispatchStatus; label: string; tone: string }[]> = {
  REQUESTED: [
    { status: 'APPROVED', label: 'Approve', tone: 'primary' },
    { status: 'CANCELLED', label: 'Reject', tone: 'ghost' },
  ],
  APPROVED: [
    { status: 'PICKING', label: 'Start picking', tone: 'primary' },
    { status: 'AWAITING_STOCK', label: 'Short on stock', tone: 'ghost' },
  ],
  PICKING: [{ status: 'AWAITING_STOCK', label: 'Short on stock', tone: 'ghost' }],
  AWAITING_STOCK: [{ status: 'PICKING', label: 'Stock arrived — pick', tone: 'primary' }],
  DISPATCHED: [{ status: 'DELIVERED', label: 'Confirm delivered', tone: 'moss' }],
};

/** States from which the parcel can actually leave the building. */
const CAN_DISPATCH = ['APPROVED', 'PICKING', 'AWAITING_STOCK'];

function Pending({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <span className={pending ? 'opacity-50' : undefined}>{children}</span>;
}

export function DispatchActions({
  requestId,
  status,
  carrier,
  trackingRef,
  awaitingPaymentOn,
}: {
  requestId: string;
  status: string;
  carrier: string | null;
  trackingRef: string | null;
  /** The parts order this dispatch is waiting on payment for, if any. */
  awaitingPaymentOn?: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionState, FormData>(advanceDispatch, {});

  // Pull the queue back from the server once the move lands, so the dispatch
  // leaves the column it was in rather than sitting there looking unchanged.
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  // A paid-for order is released by its payment — until then the only thing
  // the warehouse can do with it is reject it.
  const held = !!awaitingPaymentOn && status === 'REQUESTED';
  const steps = (NEXT_STEPS[status] ?? []).filter((s) => !held || s.status === 'CANCELLED');
  const canDispatch = CAN_DISPATCH.includes(status) && !held;

  if (!steps.length && !canDispatch) {
    return state.error ? (
      <p role="alert" className="text-2xs text-clay">
        {state.error}
      </p>
    ) : null;
  }

  return (
    <form action={formAction} className="space-y-2.5">
      <input type="hidden" name="requestId" value={requestId} />

      {held && (
        <p className="rounded-brand bg-amber-soft px-3 py-2 text-2xs text-amber">
          Held until {awaitingPaymentOn} is paid — it will be approved automatically.
        </p>
      )}

      {canDispatch && (
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            name="carrier"
            defaultValue={carrier ?? ''}
            aria-label="Carrier"
            className="field h-8 text-2xs"
          >
            <option value="">Carrier…</option>
            {CARRIERS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            name="trackingRef"
            defaultValue={trackingRef ?? ''}
            placeholder="Tracking reference"
            aria-label="Tracking reference"
            className="field h-8 text-2xs"
          />
        </div>
      )}

      <Pending>
        <div className="flex flex-wrap gap-1.5">
          {steps.map((s) => (
            <button
              key={s.status}
              type="submit"
              name="status"
              value={s.status}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-2xs font-medium transition-colors',
                s.tone === 'primary' &&
                  'border-ember/30 bg-ember-soft text-ember-dark hover:bg-ember hover:text-white',
                s.tone === 'moss' &&
                  'border-moss/30 bg-moss-soft text-moss hover:bg-moss hover:text-white',
                s.tone === 'ghost' &&
                  'border-stone bg-white text-slate hover:border-slate/60 hover:text-ink',
              )}
            >
              {s.status === 'CANCELLED' ? (
                <XCircle className="h-3 w-3" />
              ) : s.status === 'DELIVERED' ? (
                <Check className="h-3 w-3" />
              ) : (
                <PackageCheck className="h-3 w-3" />
              )}
              {s.label}
            </button>
          ))}

          {canDispatch && (
            <button
              type="submit"
              name="status"
              value="DISPATCHED"
              className="inline-flex h-7 items-center gap-1.5 rounded-full bg-charcoal px-2.5 text-2xs font-medium text-white transition-colors hover:bg-ink"
            >
              <Truck className="h-3 w-3" />
              Mark dispatched
            </button>
          )}
        </div>
      </Pending>

      {state.error && (
        <p role="alert" className="text-2xs text-clay">
          {state.error}
        </p>
      )}
    </form>
  );
}
