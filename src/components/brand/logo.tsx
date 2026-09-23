import { cn } from '@/lib/utils';

/**
 * The louvre mark: a pergola frame with its roof blades part-open, which is
 * the single most recognisable detail of the product.
 */
export function LouvreMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn('h-8 w-8', className)}
    >
      <rect
        x="2.25"
        y="2.25"
        width="27.5"
        height="27.5"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.75"
        opacity="0.85"
      />
      {[10.4, 16, 21.6].map((y) => (
        <line
          key={y}
          x1="8"
          y1={y + 3.6}
          x2="24"
          y2={y - 3.6}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

type WordmarkProps = {
  /** `light` for dark surfaces, `dark` for light ones. */
  variant?: 'light' | 'dark';
  /** Hides the "Pergola / CRM" sub-line, for tight spaces. */
  compact?: boolean;
  /** The sub-line text. Documents a customer receives say "Pergola", not "CRM". */
  subline?: string;
  className?: string;
};

export function HyggeWordmark({
  variant = 'dark',
  compact = false,
  subline = 'Pergola · CRM',
  className,
}: WordmarkProps) {
  const isLight = variant === 'light';

  return (
    <span className={cn('flex items-center gap-3', className)}>
      <LouvreMark className={cn('h-9 w-9 shrink-0', isLight ? 'text-ember' : 'text-anthracite')} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'font-display text-[1.15rem] font-medium uppercase tracking-[0.28em]',
            isLight ? 'text-white' : 'text-ink',
          )}
        >
          Hygge
          <sup
            className={cn(
              'ml-0.5 align-super text-[0.5rem] tracking-normal',
              isLight ? 'text-ember' : 'text-ember',
            )}
          >
            ™
          </sup>
        </span>
        {!compact && (
          <span
            className={cn(
              'mt-1 text-2xs font-semibold uppercase tracking-brand',
              isLight ? 'text-mist/80' : 'text-slate',
            )}
          >
            {subline}
          </span>
        )}
      </span>
    </span>
  );
}
