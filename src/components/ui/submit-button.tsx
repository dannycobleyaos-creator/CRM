'use client';

import { useFormStatus } from 'react-dom';

import { buttonClasses } from './button';

type Variant = Parameters<typeof buttonClasses>[0];

/**
 * A submit button that shows it is working. On a slow connection a button that
 * does nothing visible gets clicked twice — and a parts order placed twice is
 * two parcels.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = 'primary',
  size = 'sm',
  className,
  name,
  value,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={pending}
      className={buttonClasses(variant, size, className)}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/** The one line under a form that says what happened. */
export function FormMessage({ error, ok }: { error?: string; ok?: string | false }) {
  if (error) {
    return (
      <p role="alert" className="text-xs text-clay">
        {error}
      </p>
    );
  }
  if (ok) {
    return (
      <p role="status" className="text-xs text-moss">
        {ok}
      </p>
    );
  }
  return null;
}
