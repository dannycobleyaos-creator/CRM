'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, MoveRight, X } from 'lucide-react';

import { addOrderDate, rescheduleOrderDate } from '@/actions/orders';
import type { ActionState } from '@/lib/action-state';
import { ORDER_DATE_KINDS, ORDER_DATE_META, type OrderDateKind } from '@/lib/constants';
import { FormMessage, SubmitButton } from '@/components/ui/submit-button';

type Person = { id: string; name: string; team: string };

const toDateInput = (d: Date) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
const toTimeInput = (d: Date) => d.toTimeString().slice(0, 5);

/** Which team usually owns which kind of date — a sensible default, not a rule. */
const DEFAULT_TEAM: Partial<Record<OrderDateKind, string>> = {
  DELIVERY: 'Warehouse',
  INSTALL: 'Installations',
  PAYMENT: 'Customer Care',
  FOLLOW_UP: 'Customer Care',
};

export function AddOrderDateForm({
  orderId,
  team,
  defaultOwnerId,
}: {
  orderId: string;
  team: Person[];
  defaultOwnerId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(addOrderDate, {});
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const typed = state.values ?? {};
  const [kind, setKind] = useState<OrderDateKind>((typed.kind as OrderDateKind) ?? 'INSTALL');
  const [ownerId, setOwnerId] = useState(typed.ownerId ?? defaultOwnerId);

  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    setOpen(false);
    router.refresh();
  }, [state, router]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-brand border border-stone bg-white px-3 text-xs font-medium text-ink transition-colors hover:bg-sand"
      >
        <CalendarPlus className="h-3.5 w-3.5" />
        Add a date
      </button>
    );
  }

  const pickKind = (next: OrderDateKind) => {
    setKind(next);
    // Suggest the usual owner, unless somebody has already been chosen by hand.
    const teamName = DEFAULT_TEAM[next];
    const suggested = teamName ? team.find((p) => p.team === teamName) : undefined;
    if (suggested && ownerId === defaultOwnerId) setOwnerId(suggested.id);
  };

  return (
    <form ref={formRef} action={formAction} className="space-y-3 rounded-brand border border-stone bg-sand/30 p-4">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="flex items-center justify-between">
        <p className="brand-eyebrow">New key date</p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-brand p-1 text-slate hover:bg-sand hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="date-kind">What</label>
          <select id="date-kind" name="kind" value={kind} onChange={(e) => pickKind(e.target.value as OrderDateKind)} className="field">
            {ORDER_DATE_KINDS.map((k) => (
              <option key={k} value={k}>{ORDER_DATE_META[k].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="date-label">
            Label <span className="normal-case tracking-normal text-slate/60">(optional)</span>
          </label>
          <input id="date-label" name="label" defaultValue={typed.label ?? ''} placeholder={ORDER_DATE_META[kind].label} className="field" />
        </div>
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <div>
            <label className="field-label" htmlFor="date-date">Date</label>
            <input id="date-date" name="date" type="date" required defaultValue={typed.date ?? ''} className="field" />
          </div>
          <div>
            <label className="field-label" htmlFor="date-time">Time</label>
            <input id="date-time" name="time" type="time" defaultValue={typed.time ?? '09:00'} className="field" />
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="date-owner">Responsible</label>
          <select id="date-owner" name="ownerId" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="field">
            {team.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {p.team}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="date-note">
            Note <span className="normal-case tracking-normal text-slate/60">(optional)</span>
          </label>
          <input id="date-note" name="note" defaultValue={typed.note ?? ''} placeholder="Two fitters, full day. Side gate access." className="field" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Adding…">
          <CalendarPlus className="h-3.5 w-3.5" />
          Add date
        </SubmitButton>
        <FormMessage error={state.error} />
      </div>
    </form>
  );
}

export function RescheduleDateForm({
  dateId,
  dueAt,
  ownerId,
  team,
}: {
  dateId: string;
  dueAt: string;
  ownerId: string | null;
  team: Person[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(rescheduleOrderDate, {});
  const router = useRouter();
  const typed = state.values ?? {};
  const current = new Date(dueAt);

  useEffect(() => {
    if (!state.ok) return;
    setOpen(false);
    router.refresh();
  }, [state, router]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-1 text-2xs text-slate underline-offset-4 hover:text-ink hover:underline">
        Move
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 basis-full space-y-2 rounded-brand border border-stone bg-white p-3">
      <input type="hidden" name="dateId" value={dateId} />
      <div className="grid gap-2 sm:grid-cols-[1fr_6.5rem_1fr]">
        <input name="date" type="date" required aria-label="New date" defaultValue={typed.date ?? toDateInput(current)} className="field h-8 text-xs" />
        <input name="time" type="time" aria-label="New time" defaultValue={typed.time ?? toTimeInput(current)} className="field h-8 text-xs" />
        <select name="ownerId" aria-label="Responsible" defaultValue={typed.ownerId ?? ownerId ?? ''} className="field h-8 text-xs">
          {team.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <input name="reason" defaultValue={typed.reason ?? ''} placeholder="Why is it moving? (the customer sees no change until you tell them)" className="field h-8 text-xs" />
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton variant="dark" pendingLabel="Moving…">
          <MoveRight className="h-3.5 w-3.5" />
          Move date
        </SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate hover:text-ink">Cancel</button>
        <FormMessage error={state.error} />
      </div>
    </form>
  );
}
