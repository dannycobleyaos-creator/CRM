import { statusForRate } from '@/lib/chart-theme';
import { cn } from '@/lib/utils';

/**
 * A percentage with its own bar. Status colour only — this measures a state
 * (are we hitting the promise?), not an identity.
 */
export function Meter({
  value,
  label,
  caption,
  className,
}: {
  value: number | null;
  label: string;
  caption?: string;
  className?: string;
}) {
  const pct = value ?? 0;
  const colour = statusForRate(pct);

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-2xs uppercase tracking-brand text-slate">{label}</span>
        <span className="font-display text-lg font-light text-ink">
          {value === null ? '—' : `${pct}%`}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-sand"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: colour }}
        />
      </div>
      {caption && <p className="text-2xs text-slate/80">{caption}</p>}
    </div>
  );
}
