import Link from 'next/link';

import { cn } from '@/lib/utils';

export type SubNavItem = { key: string; href: string; label: string; count?: number };

/**
 * Tabs between the screens of one area — inventory's parts, bills of materials
 * and purchasing. Underlined rather than pill-shaped, so they never get
 * mistaken for the filters that sit beneath them.
 */
export function SubNav({ items, active }: { items: SubNavItem[]; active: string }) {
  return (
    <nav aria-label="Section" className="-mt-2 flex gap-5 overflow-x-auto border-b border-stone">
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              '-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-0.5 pb-2.5 pt-1 text-sm transition-colors',
              isActive
                ? 'border-ember font-medium text-ink'
                : 'border-transparent text-slate hover:border-stone hover:text-ink',
            )}
          >
            {item.label}
            {typeof item.count === 'number' && item.count > 0 && (
              <span className="rounded-full bg-sand px-1.5 text-2xs font-semibold tabular-nums text-slate">
                {item.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
