import Link from 'next/link';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-ember text-white shadow-sm hover:bg-ember-dark focus-visible:ring-ember/30 border-transparent',
  secondary:
    'bg-white text-ink border-stone hover:border-slate/60 hover:bg-sand/60 focus-visible:ring-ember/20',
  ghost:
    'bg-transparent text-slate border-transparent hover:bg-sand hover:text-ink focus-visible:ring-ember/20',
  danger:
    'bg-clay text-white border-transparent hover:bg-clay/90 focus-visible:ring-clay/30',
  dark: 'bg-charcoal text-white border-transparent hover:bg-ink focus-visible:ring-charcoal/30',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
};

const base =
  'inline-flex items-center justify-center rounded-brand border font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-55';

export const buttonClasses = (
  variant: Variant = 'primary',
  size: Size = 'md',
  className?: string,
) => cn(base, VARIANTS[variant], SIZES[size], className);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}

type ButtonLinkProps = React.ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
};

export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
