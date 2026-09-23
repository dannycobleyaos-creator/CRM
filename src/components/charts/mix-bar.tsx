import { cn } from '@/lib/utils';

export type MixSegment = { key: string; label: string; value: number; colour: string };

/**
 * Part-to-whole in one thin bar: how a person's contacts split across the
 * channels. Segments are separated by a 2px surface gap, never a stroke, and
 * each one names itself on hover; the numbers sit in the table beside it.
 */
export function MixBar({ segments, className }: { segments: MixSegment[]; className?: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) return <span className="text-2xs text-slate">—</span>;

  return (
    <span
      className={cn('flex h-2 w-full min-w-[6rem] gap-[2px] overflow-hidden rounded-[4px]', className)}
      role="img"
      aria-label={segments.map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(', ')}
    >
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <span
            key={s.key}
            title={`${s.label}: ${s.value.toLocaleString('en-GB')} (${Math.round((s.value / total) * 100)}%)`}
            className="h-full"
            style={{ width: `${(s.value / total) * 100}%`, background: s.colour }}
          />
        ))}
    </span>
  );
}
