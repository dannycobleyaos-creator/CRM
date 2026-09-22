'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Megaphone, X } from 'lucide-react';

import { createAnnouncement, type ActionState } from '@/actions/announcements';
import { ANNOUNCEMENT_CATEGORIES, ANNOUNCEMENT_CATEGORY_META, TEAMS } from '@/lib/constants';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center gap-2 rounded-brand bg-ember px-4 text-xs font-medium text-white transition-colors hover:bg-ember-dark disabled:opacity-55"
    >
      <Megaphone className="h-3.5 w-3.5" />
      {pending ? 'Posting…' : 'Post to the board'}
    </button>
  );
}

export function NewAnnouncementForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(createAnnouncement, {});
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // React clears the form once the action settles; the echoed values put a
  // rejected post back rather than making somebody rewrite it.
  useEffect(() => {
    if (!state.ok) return;
    formRef.current?.reset();
    setOpen(false);
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
        <Megaphone className="h-4 w-4" />
        New announcement
      </button>
    );
  }

  return (
    <div className="card w-full p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="brand-eyebrow">Noticeboard</p>
          <h2 className="mt-1 font-display text-base font-medium text-ink">New announcement</h2>
          <p className="mt-1 text-xs text-slate">
            Say what changed and what people need to do differently.
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
            Headline
          </label>
          <input
            id="title"
            name="title"
            required
            placeholder="Matt white louvre blades — low stock"
            defaultValue={typed.title ?? ''}
            className="field"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="category">
            Type
          </label>
          <select
            id="category"
            name="category"
            defaultValue={typed.category || 'COMPANY'}
            className="field"
          >
            {ANNOUNCEMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {ANNOUNCEMENT_CATEGORY_META[c].label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="audience">
            Who needs to see it
          </label>
          <select
            id="audience"
            name="audience"
            defaultValue={typed.audience || 'ALL'}
            className="field"
          >
            <option value="ALL">Everyone</option>
            {TEAMS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="body">
            Message
          </label>
          <textarea
            id="body"
            name="body"
            rows={5}
            required
            defaultValue={typed.body ?? ''}
            className="field resize-y"
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-slate sm:col-span-2">
          <input type="checkbox" name="pinned" className="h-3.5 w-3.5 accent-[#B9763C]" />
          Pin to the top of the board
        </label>

        {state.error && (
          <p role="alert" className="text-xs text-clay sm:col-span-2">
            {state.error}
          </p>
        )}

        <div className="sm:col-span-2">
          <Submit />
        </div>
      </form>
    </div>
  );
}
