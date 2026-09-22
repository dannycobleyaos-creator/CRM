'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';

import { createTask, type ActionState } from '@/actions/tasks';
import { PRIORITIES, PRIORITY_META, TASK_CATEGORIES, TASK_CATEGORY_META } from '@/lib/constants';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center gap-2 rounded-brand bg-ember px-4 text-xs font-medium text-white transition-colors hover:bg-ember-dark disabled:opacity-55"
    >
      <Plus className="h-3.5 w-3.5" />
      {pending ? 'Adding…' : 'Add task'}
    </button>
  );
}

export function NewTaskForm({
  team,
  customers,
  defaultOpen = false,
  defaultAssigneeId,
}: {
  team: { id: string; name: string; team: string }[];
  customers: { id: string; name: string; ref: string }[];
  defaultOpen?: boolean;
  defaultAssigneeId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [state, formAction] = useActionState<ActionState, FormData>(createTask, {});
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // React clears the form once the action settles; the echoed values put a
  // rejected submission back so nothing has to be retyped.
  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    router.refresh();
  }, [state.ok, router]);

  const typed = state.values ?? {};

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-brand bg-ember px-4 text-xs font-medium text-white transition-colors hover:bg-ember-dark"
      >
        <Plus className="h-4 w-4" />
        New task
      </button>
    );
  }

  return (
    <div className="card w-full p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="brand-eyebrow">Add work</p>
          <h2 className="mt-1 font-display text-base font-medium text-ink">New task</h2>
          <p className="mt-1 text-xs text-slate">
            An owner and a due date are required — that is the whole point.
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
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="title">
            What needs doing?
          </label>
          <input
            id="title"
            name="title"
            required
            placeholder="Call Mrs Vaughan back about the delivery slot"
            defaultValue={typed.title ?? ''}
            className="field"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="assigneeId">
            Owner
          </label>
          <select
            id="assigneeId"
            name="assigneeId"
            required
            defaultValue={typed.assigneeId || defaultAssigneeId || ''}
            className="field"
          >
            <option value="">Choose someone…</option>
            {team.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.team}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="dueAt">
            Due
          </label>
          <input
            id="dueAt"
            name="dueAt"
            type="datetime-local"
            defaultValue={typed.dueAt ?? ''}
            className="field"
          />
        </div>

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
          <label className="field-label" htmlFor="category">
            Type
          </label>
          <select
            id="category"
            name="category"
            defaultValue={typed.category || 'OTHER'}
            className="field"
          >
            {TASK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {TASK_CATEGORY_META[c].label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="customerId">
            Customer <span className="normal-case tracking-normal text-slate/60">(optional)</span>
          </label>
          <select
            id="customerId"
            name="customerId"
            defaultValue={typed.customerId ?? ''}
            className="field"
          >
            <option value="">Not customer specific</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.ref}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="details">
            Detail <span className="normal-case tracking-normal text-slate/60">(optional)</span>
          </label>
          <textarea
            id="details"
            name="details"
            rows={2}
            placeholder="Anything the owner needs before they start."
            defaultValue={typed.details ?? ''}
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
            Task added to the board.
          </p>
        )}

        <div className="sm:col-span-2">
          <Submit />
        </div>
      </form>
    </div>
  );
}
