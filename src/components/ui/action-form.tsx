'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';

type ActionFormProps = {
  /** A server action taking the form data. */
  action: (formData: FormData) => Promise<void>;
  /** Hidden values submitted with the action. */
  fields?: Record<string, string | undefined>;
  className?: string;
  children: React.ReactNode;
};

/**
 * A one-click control backed by a server action — used for the status buttons
 * that make up most of the portal's interaction.
 *
 * `revalidatePath` in the action is what refreshes the view; the explicit
 * `router.refresh()` here is belt and braces, and running the submit ourselves
 * is what gives the control its pending state, so a click always looks like it
 * did something even on a slow connection. The plain `action` prop is kept so
 * the form still posts, and still works, before the JavaScript has loaded.
 */
export function ActionForm({ action, fields = {}, className, children }: ActionFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <form
      action={action}
      className={cn(pending && 'pointer-events-none opacity-60', className)}
      onSubmit={async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setPending(true);
        try {
          await action(formData);
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      {Object.entries(fields).map(([name, value]) =>
        value === undefined ? null : (
          <input key={name} type="hidden" name={name} value={value} />
        ),
      )}
      {children}
    </form>
  );
}
