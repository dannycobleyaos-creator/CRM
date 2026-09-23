import Link from 'next/link';
import { CircleHelp, Plus } from 'lucide-react';

import { GlobalSearch } from './global-search';
import { ButtonLink } from '@/components/ui/button';

export function Topbar({ greeting, subline }: { greeting: string; subline: string }) {
  return (
    <header className="sticky top-0 z-30 hidden border-b border-stone bg-linen/85 backdrop-blur lg:block print:hidden">
      <div className="flex items-center gap-6 px-8 py-3.5">
        <div className="min-w-0 shrink-0">
          <p className="truncate font-display text-sm font-medium text-ink">{greeting}</p>
          <p className="truncate text-2xs text-slate">{subline}</p>
        </div>

        <div className="flex flex-1 justify-center">
          <GlobalSearch />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/announcements"
            title="What's new"
            className="rounded-brand border border-stone bg-white p-2 text-slate transition-colors hover:text-ink"
          >
            <CircleHelp className="h-4 w-4" />
          </Link>
          <ButtonLink href="/board?new=1" size="sm">
            <Plus className="h-4 w-4" />
            New task
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
