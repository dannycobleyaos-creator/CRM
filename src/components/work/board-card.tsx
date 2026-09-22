import Link from 'next/link';
import { Check, ChevronRight, Lock, Undo2 } from 'lucide-react';

import { setTaskStatus } from '@/actions/tasks';
import { ActionForm } from '@/components/ui/action-form';
import { Avatar } from '@/components/ui/avatar';
import { PriorityChip, TaskCategoryChip } from '@/components/status-chips';
import type { TaskStatus } from '@/lib/constants';
import { cn, isOverdue, relativeTime } from '@/lib/utils';
import type { TaskItemData } from './task-item';

/**
 * Where a card goes when you nudge it forward, labelled as the verb rather than
 * the destination state — "Start" reads better on a button than "Actioning".
 */
const NEXT_STEP: Partial<Record<TaskStatus, { status: TaskStatus; label: string }>> = {
  TODO: { status: 'IN_PROGRESS', label: 'Start' },
  IN_PROGRESS: { status: 'DONE', label: 'Actioned' },
  BLOCKED: { status: 'IN_PROGRESS', label: 'Resume' },
  AWAITING_OTHERS: { status: 'IN_PROGRESS', label: 'Resume' },
};

function MoveButton({
  taskId,
  status,
  label,
  icon,
  tone,
}: {
  taskId: string;
  status: TaskStatus;
  label: string;
  icon: React.ReactNode;
  tone: 'moss' | 'ember' | 'slate';
}) {
  return (
    <ActionForm action={setTaskStatus} fields={{ taskId, status }}>
      <button
        type="submit"
        title={label}
        aria-label={label}
        className={cn(
          'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-2xs font-medium transition-colors',
          tone === 'moss' && 'border-moss/30 bg-moss-soft text-moss hover:bg-moss hover:text-white',
          tone === 'ember' &&
            'border-ember/30 bg-ember-soft text-ember-dark hover:bg-ember hover:text-white',
          tone === 'slate' && 'border-stone bg-white text-slate hover:border-slate/60 hover:text-ink',
        )}
      >
        {icon}
        {label}
      </button>
    </ActionForm>
  );
}

export function BoardCard({ task }: { task: TaskItemData }) {
  const overdue = task.status !== 'DONE' && isOverdue(task.dueAt);
  const next = NEXT_STEP[task.status as TaskStatus];

  return (
    <li
      className={cn(
        'rounded-brand border bg-white p-3 shadow-sm transition hover:shadow-card',
        overdue ? 'border-clay/40' : 'border-stone/80',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityChip value={task.priority} dot={task.priority === 'URGENT'} />
          <TaskCategoryChip value={task.category} dot={false} />
        </div>
        {task.assignee && (
          <Avatar name={task.assignee.name} tone={task.assignee.avatarTone} size="xs" />
        )}
      </div>

      <p
        className={cn(
          'mt-2 text-xs font-medium leading-snug text-ink',
          task.status === 'DONE' && 'text-slate line-through',
        )}
      >
        {task.title}
      </p>

      {task.customer && (
        <Link
          href={`/customers/${task.customer.id}`}
          className="mt-1.5 block truncate text-2xs text-slate transition-colors hover:text-ember-dark"
        >
          {task.customer.name}
          {task.ticket ? ` · ${task.ticket.ref}` : ''}
        </Link>
      )}

      {task.dueAt && (
        <p className={cn('mt-1 text-2xs', overdue ? 'font-semibold text-clay' : 'text-slate')}>
          {overdue ? 'Overdue ' : 'Due '}
          {relativeTime(task.dueAt)}
        </p>
      )}

      {task.blockedNote && (
        <p className="mt-2 flex items-start gap-1.5 rounded-[0.4rem] bg-amber-soft px-2 py-1.5 text-2xs text-amber">
          <Lock className="mt-px h-3 w-3 shrink-0" />
          {task.blockedNote}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-stone/60 pt-2.5">
        {next && (
          <MoveButton
            taskId={task.id}
            status={next.status}
            label={next.label}
            tone={next.status === 'DONE' ? 'moss' : 'ember'}
            icon={
              next.status === 'DONE' ? (
                <Check className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )
            }
          />
        )}
        {task.status === 'IN_PROGRESS' && (
          <MoveButton
            taskId={task.id}
            status="BLOCKED"
            label="Blocked"
            tone="slate"
            icon={<Lock className="h-3 w-3" />}
          />
        )}
        {task.status === 'DONE' && (
          <MoveButton
            taskId={task.id}
            status="TODO"
            label="Reopen"
            tone="slate"
            icon={<Undo2 className="h-3 w-3" />}
          />
        )}
      </div>
    </li>
  );
}
