import Link from 'next/link';
import { cn } from '@/lib/utils';

export type FilterOption = { value: string; label: string; count?: number };

/**
 * Link-based filters rather than client state: the URL is the view, so agents
 * can bookmark "my breached cases" and managers can send each other a link.
 */
export function FilterTabs({
  options,
  active,
  paramKey,
  basePath,
  params = {},
  className,
}: {
  options: FilterOption[];
  active: string;
  paramKey: string;
  basePath: string;
  params?: Record<string, string | undefined>;
  className?: string;
}) {
  const href = (value: string) => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v && k !== paramKey) search.set(k, v);
    }
    if (value) search.set(paramKey, value);
    const qs = search.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {options.map((o) => {
        const isActive = o.value === active;
        return (
          <Link
            key={o.value || 'all'}
            href={href(o.value)}
            aria-current={isActive ? 'true' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              isActive
                ? 'border-charcoal bg-charcoal text-white'
                : 'border-stone bg-white text-slate hover:border-slate/50 hover:text-ink',
            )}
          >
            {o.label}
            {typeof o.count === 'number' && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-2xs tabular-nums',
                  isActive ? 'bg-white/15 text-white' : 'bg-sand text-slate',
                )}
              >
                {o.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
