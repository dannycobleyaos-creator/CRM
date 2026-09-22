'use client';

import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="brand-eyebrow">Something went wrong</p>
      <h1 className="mt-2 font-display text-2xl font-medium text-ink">
        We couldn&apos;t load that
      </h1>
      <p className="mt-2 max-w-md text-sm text-slate">
        Nothing you did has been lost. Try again — if it keeps happening, send the reference
        below to whoever looks after the portal.
      </p>
      {error.digest && (
        <p className="mt-3 rounded-brand bg-sand px-3 py-1.5 font-mono text-2xs text-slate">
          {error.digest}
        </p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-brand bg-ember px-4 text-sm font-medium text-white transition-colors hover:bg-ember-dark"
      >
        <RotateCcw className="h-4 w-4" />
        Try again
      </button>
    </main>
  );
}
