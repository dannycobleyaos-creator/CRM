import Link from 'next/link';

import { HyggeWordmark } from '@/components/brand/logo';
import { ButtonLink } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-linen px-6 text-center">
      <HyggeWordmark />
      <p className="brand-eyebrow mt-10">404</p>
      <h1 className="mt-2 font-display text-2xl font-medium text-ink">
        That record isn&apos;t here
      </h1>
      <p className="mt-2 max-w-sm text-sm text-slate">
        It may have been merged, closed or never existed. Try searching for the customer name
        or the reference.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <ButtonLink href="/">Back to my day</ButtonLink>
        <Link
          href="/search"
          className="rounded-brand border border-stone bg-white px-4 py-2 text-sm text-ink transition-colors hover:bg-sand"
        >
          Search the portal
        </Link>
      </div>
    </main>
  );
}
