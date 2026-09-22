import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { Tone } from '@/lib/constants';
import { TONE_DOTS } from './badge';

type StatProps = {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: Tone;
  icon?: React.ReactNode;
  href?: string;
  className?: string;
};

/**
 * A single number with a short qualifier. Kept deliberately plain — the number
 * is the message, the tone bar carries the urgency.
 */
export function Stat({ label, value, sub, tone = 'slate', icon, href, className }: StatProps) {
  const body = (
    <>
      <span className={cn('absolute inset-y-0 left-0 w-[3px]', TONE_DOTS[tone])} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <p className="brand-eyebrow">{label}</p>
        {icon && <span className="text-slate/70">{icon}</span>}
      </div>
      <p className="mt-2 font-display text-3xl font-light leading-none tracking-tight text-ink">
        {value}
      </p>
      {sub && <p className="mt-2 text-xs text-slate">{sub}</p>}
    </>
  );

  const shell = cn(
    'card relative block overflow-hidden px-5 py-4 transition',
    href && 'hover:-translate-y-px hover:shadow-lift',
    className,
  );

  return href ? (
    <Link href={href} className={shell}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}
