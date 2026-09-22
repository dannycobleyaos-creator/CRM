'use client';

import { useActionState, useRef, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Mail, MessageSquare, NotebookPen, Phone, Send, Smartphone } from 'lucide-react';

import { logInteraction, type ActionState } from '@/actions/tickets';
import { logCustomerActivity } from '@/actions/customers';
import { cn } from '@/lib/utils';

const TYPES = [
  { value: 'NOTE', label: 'Note', icon: NotebookPen },
  { value: 'CALL', label: 'Call', icon: Phone },
  { value: 'EMAIL', label: 'Email', icon: Mail },
  { value: 'CHAT', label: 'Chat', icon: MessageSquare },
  { value: 'SMS', label: 'SMS', icon: Smartphone },
] as const;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center gap-2 rounded-brand bg-ember px-4 text-xs font-medium text-white transition-colors hover:bg-ember-dark disabled:opacity-55"
    >
      <Send className="h-3.5 w-3.5" />
      {pending ? 'Logging…' : 'Log it'}
    </button>
  );
}

/**
 * Used on both the case and the customer record. Logging a customer-facing
 * interaction on a case also stamps the first-response time, which is where
 * the SLA numbers come from — nobody has to remember to update anything.
 */
export function LogInteractionForm({
  ticketId,
  customerId,
}: {
  ticketId?: string;
  customerId?: string;
}) {
  const action = ticketId ? logInteraction : logCustomerActivity;
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // React clears the form once the action settles. On success that is what we
  // want; on failure the echoed values below are what put the note back.
  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    router.refresh();
  }, [state.ok, router]);

  const typed = state.values ?? {};

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      {ticketId && <input type="hidden" name="ticketId" value={ticketId} />}
      {customerId && <input type="hidden" name="customerId" value={customerId} />}

      <fieldset>
        <legend className="field-label">What happened?</legend>
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map(({ value, label, icon: Icon }, i) => (
            <label
              key={value}
              className={cn(
                'inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-stone bg-white px-3 py-1.5 text-xs text-slate transition-colors',
                'hover:border-slate/50 hover:text-ink',
                'has-[:checked]:border-charcoal has-[:checked]:bg-charcoal has-[:checked]:text-white',
              )}
            >
              <input
                type="radio"
                name="type"
                value={value}
                defaultChecked={typed.type ? typed.type === value : i === 0}
                className="sr-only"
              />
              <Icon className="h-3.5 w-3.5" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="field-label" htmlFor="summary">
          Summary
        </label>
        <input
          id="summary"
          name="summary"
          required
          placeholder="Called and confirmed the replacement blade is on its way"
          defaultValue={typed.summary ?? ''}
          className="field"
        />
      </div>

      <div>
        <label className="field-label" htmlFor="body">
          Detail <span className="normal-case tracking-normal text-slate/60">(optional)</span>
        </label>
        <textarea
          id="body"
          name="body"
          rows={3}
          placeholder="Anything the next person needs to know before they pick this up."
          defaultValue={typed.body ?? ''}
          className="field resize-y"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-xs text-clay">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-xs text-moss">
          Logged to the timeline.
        </p>
      )}

      <Submit />
    </form>
  );
}
