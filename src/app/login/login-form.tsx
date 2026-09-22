'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertCircle, ArrowRight } from 'lucide-react';

import { login, type LoginState } from '@/actions/auth';
import { Button } from '@/components/ui/button';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? 'Signing in…' : 'Sign in to the portal'}
      {!pending && <ArrowRight className="h-4 w-4" />}
    </Button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ''} />

      <div>
        <label className="field-label" htmlFor="email">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="you@hyggepergola.co.uk"
          // React clears the form once the action settles; the echoed value is
          // what puts the address back after a wrong password.
          defaultValue={state.email ?? ''}
          className="field"
        />
      </div>

      <div>
        <label className="field-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="field"
        />
      </div>

      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-brand border border-clay/30 bg-clay-soft px-3 py-2.5 text-xs text-clay"
        >
          <AlertCircle className="mt-px h-4 w-4 shrink-0" />
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
