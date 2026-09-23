import { Check, Trash2 } from 'lucide-react';

import { removeOrderDate, toggleOrderDate } from '@/actions/orders';
import { cn, formatDateTime, isToday, relativeTime } from '@/lib/utils';

import { ActionForm } from '@/components/ui/action-form';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { OrderDateChip } from '@/components/status-chips';
import { RescheduleDateForm } from './order-date-forms';

export type KeyDate = {
  id: string;
  kind: string;
  label: string;
  note: string | null;
  dueAt: Date;
  doneAt: Date | null;
  owner: { id: string; name: string; avatarTone: string } | null;
};

/**
 * The dates that matter on an order, in date order, each one either done or
 * not. Overdue goes red, today goes amber — the same language as every other
 * deadline in the portal.
 */
export function KeyDates({
  dates,
  team,
  editable = true,
}: {
  dates: KeyDate[];
  team: { id: string; name: string; team: string }[];
  editable?: boolean;
}) {
  const now = new Date();
  if (!dates.length) {
    return <p className="px-5 py-6 text-center text-xs text-slate">No dates on this order yet.</p>;
  }

  return (
    <ul className="divide-y divide-stone/60">
      {dates.map((d) => {
        const done = !!d.doneAt;
        const overdue = !done && d.dueAt < now;
        const today = !done && !overdue && isToday(d.dueAt);
        return (
          <li key={d.id} className={cn('flex flex-wrap items-start gap-3 px-5 py-3', done && 'bg-sand/20')}>
            {editable ? (
              <ActionForm action={toggleOrderDate} fields={{ dateId: d.id }}>
                <button
                  type="submit"
                  title={done ? 'Mark as not done' : 'Mark as done'}
                  aria-label={done ? `Reopen ${d.label}` : `Mark ${d.label} done`}
                  className={cn(
                    'mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border transition-colors',
                    done
                      ? 'border-moss bg-moss text-white'
                      : overdue
                        ? 'border-clay/60 bg-white hover:bg-clay-soft'
                        : 'border-stone bg-white hover:border-moss hover:bg-moss-soft',
                  )}
                >
                  {done && <Check className="h-3 w-3" />}
                </button>
              </ActionForm>
            ) : (
              <span className={cn('mt-0.5 h-5 w-5 rounded-full border', done ? 'border-moss bg-moss' : 'border-stone')} />
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <OrderDateChip value={d.kind} dot={false} />
                <span className={cn('text-sm font-medium', done ? 'text-slate line-through decoration-slate/40' : 'text-ink')}>
                  {d.label}
                </span>
                {overdue && <Badge tone="clay" dot>Overdue</Badge>}
                {today && <Badge tone="amber" dot>Today</Badge>}
              </div>
              <p className="mt-0.5 text-2xs text-slate">
                {formatDateTime(d.dueAt)}
                {!done && <span className={overdue ? 'text-clay' : undefined}> · {relativeTime(d.dueAt, now)}</span>}
                {done && d.doneAt && ` · done ${relativeTime(d.doneAt, now)}`}
              </p>
              {d.note && <p className="mt-0.5 text-2xs text-slate/90">{d.note}</p>}
            </div>

            <div className="flex items-center gap-3">
              {d.owner && (
                <span className="inline-flex items-center gap-1.5 text-2xs text-slate" title={`Responsible: ${d.owner.name}`}>
                  <Avatar name={d.owner.name} tone={d.owner.avatarTone} size="xs" />
                  <span className="hidden sm:inline">{d.owner.name.split(' ')[0]}</span>
                </span>
              )}
              {editable && (
                <ActionForm action={removeOrderDate} fields={{ dateId: d.id }}>
                  <button
                    type="submit"
                    title="Remove this date"
                    aria-label={`Remove ${d.label}`}
                    className="rounded-brand p-1 text-slate/60 transition-colors hover:bg-clay-soft hover:text-clay"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </ActionForm>
              )}
            </div>

            {/* Last in the row so that, opened, it wraps to full width below. */}
            {editable && !done && (
              <RescheduleDateForm dateId={d.id} dueAt={d.dueAt.toISOString()} ownerId={d.owner?.id ?? null} team={team} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
