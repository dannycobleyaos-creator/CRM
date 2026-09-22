import { cn, initials } from '@/lib/utils';

const TONE_BG: Record<string, string> = {
  ember: 'bg-ember/15 text-ember-dark ring-ember/25',
  moss: 'bg-moss/15 text-moss ring-moss/25',
  sky: 'bg-sky/15 text-sky ring-sky/25',
  amber: 'bg-amber/15 text-amber ring-amber/25',
  clay: 'bg-clay/15 text-clay ring-clay/25',
  anthracite: 'bg-anthracite/12 text-anthracite ring-anthracite/20',
};

export function Avatar({
  name,
  tone = 'anthracite',
  size = 'md',
  className,
}: {
  name: string;
  tone?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = {
    xs: 'h-6 w-6 text-[0.6rem]',
    sm: 'h-8 w-8 text-2xs',
    md: 'h-9 w-9 text-xs',
    lg: 'h-12 w-12 text-sm',
  } as const;

  return (
    <span
      title={name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold uppercase ring-1',
        sizes[size],
        TONE_BG[tone] ?? TONE_BG.anthracite,
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({
  people,
  max = 4,
}: {
  people: { name: string; avatarTone?: string }[];
  max?: number;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;

  return (
    <div className="flex items-center -space-x-2">
      {shown.map((p) => (
        <Avatar
          key={p.name}
          name={p.name}
          tone={p.avatarTone}
          size="sm"
          className="ring-2 ring-white"
        />
      ))}
      {rest > 0 && (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sand text-2xs font-semibold text-slate ring-2 ring-white">
          +{rest}
        </span>
      )}
    </div>
  );
}
