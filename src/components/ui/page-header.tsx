import { cn } from '@/lib/utils';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-end justify-between gap-4 border-b border-stone pb-5',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <p className="brand-eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-medium text-ink sm:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-slate">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
