import { cn } from '@/lib/utils';
import type { Tone } from '@/lib/constants';

/**
 * One tone map, used by every status chip in the portal. An agent learns the
 * colours once: red needs you, orange is ticking, blue is with someone else,
 * green is done.
 */
export const TONE_CLASSES: Record<Tone, string> = {
  ember: 'bg-ember-soft text-ember-dark border-ember/30',
  moss: 'bg-moss-soft text-moss border-moss/30',
  sky: 'bg-sky-soft text-sky border-sky/30',
  amber: 'bg-amber-soft text-amber border-amber/35',
  clay: 'bg-clay-soft text-clay border-clay/30',
  slate: 'bg-sand text-slate border-stone',
  anthracite: 'bg-anthracite/10 text-anthracite border-anthracite/25',
};

export const TONE_DOTS: Record<Tone, string> = {
  ember: 'bg-ember',
  moss: 'bg-moss',
  sky: 'bg-sky',
  amber: 'bg-amber',
  clay: 'bg-clay',
  slate: 'bg-slate',
  anthracite: 'bg-anthracite',
};

export const TONE_BARS: Record<Tone, string> = TONE_DOTS;

type BadgeProps = {
  tone?: Tone;
  children: React.ReactNode;
  dot?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  title?: string;
};

export function Badge({
  tone = 'slate',
  children,
  dot = false,
  size = 'sm',
  className,
  title,
}: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium',
        size === 'sm' ? 'px-2.5 py-0.5 text-2xs' : 'px-3 py-1 text-xs',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', TONE_DOTS[tone])} />}
      {children}
    </span>
  );
}
