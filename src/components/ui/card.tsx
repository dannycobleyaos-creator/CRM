import { cn } from '@/lib/utils';

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card overflow-hidden', className)} {...props}>
      {children}
    </div>
  );
}

type CardHeaderProps = {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

export function CardHeader({
  title,
  eyebrow,
  description,
  action,
  className,
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-stone/70 px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <p className="brand-eyebrow mb-1">{eyebrow}</p>}
        <h2 className="truncate font-display text-base font-medium text-ink">{title}</h2>
        {description && <p className="mt-1 text-xs text-slate">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-5 py-4', className)} {...props}>
      {children}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      {icon && (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-sand text-slate">
          {icon}
        </div>
      )}
      <p className="font-display text-sm font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-slate">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
