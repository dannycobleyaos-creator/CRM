import Link from 'next/link';
import { ArrowRight, Check, CircleDot, Lock, Play } from 'lucide-react';

import { setTaskStatus } from '@/actions/tasks';
import { ActionForm } from '@/components/ui/action-form';
import { Avatar } from '@/components/ui/avatar';
import { PriorityChip, TaskCategoryChip, TaskStatusChip } from '@/components/status-chips';
import { cn, formatDateTime, isOverdue, relativeTime } from '@/lib/utils';

export type TaskItemData = {
  id: string;
  title: string;
  details: string | null;
  status: string;
  priority: string;
  category: string;
  dueAt: Date | null;
  blockedNote: string | null;
  assignee: { id: string; name: string; avatarTone: string } | null;
  customer: { id: string; name: string; ref: string } | null;
  ticket: { id: string; ref: string } | null;
};

/** One-click state changes, posted as plain forms so they work without JS. */
function StatusButton({
  taskId,
  status,
  label,
  icon,
  tone = 'secondary',
}: {
  taskId: string;
  status: string;
  label: string;
  icon: React.ReactNode;
  tone?: 'secondary' | 'primary' | 'moss';
}) {
  return (
    <ActionForm action={setTaskStatus} fields={{ taskId, status }}>
      <button
        type="submit"
        title={label}
        aria-label={label}
        className={cn(
          'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-2xs font-medium transition-colors',
          tone === 'moss' && 'border-moss/30 bg-moss-soft text-moss hover:bg-moss hover:text-white',
          tone === 'primary' &&
            'border-ember/30 bg-ember-soft text-ember-dark hover:bg-ember hover:text-white',
          tone === 'secondary' && 'border-stone bg-white text-slate hover:border-slate/60 hover:text-ink',
        )}
      >
        {icon}
        {label}
      </button>
    </ActionForm>
  );
}

export function TaskItem({
  task,
  showAssignee = false,
  className,
}: {
  task: TaskItemData;
  showAssignee?: boolean;
  className?: string;
}) {
  const overdue = task.status !== 'DONE' && isOverdue(task.dueAt);

  return (
    <li
      className={cn(
        'group flex flex-col gap-3 px-5 py-3.5 transition-colors hover:bg-sand/40 sm:flex-row sm:items-center',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <TaskStatusChip value={task.status} />
          <PriorityChip value={task.priority} dot={false} />
          <TaskCategoryChip value={task.category} dot={false} />
        </div>

        <p
          className={cn(
            'mt-1.5 text-sm font-medium text-ink',
            task.status === 'DONE' && 'text-slate line-through',
          )}
        >
          {task.title}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-slate">
          {task.customer && (
            <Link
              href={`/customers/${task.customer.id}`}
              className="font-medium text-slate transition-colors hover:text-ember-dark"
            >
              {task.customer.name} · {task.customer.ref}
            </Link>
          )}
          {task.ticket && (
            <Link
              href={`/cases/${task.ticket.id}`}
              className="transition-colors hover:text-ember-dark"
            >
              {task.ticket.ref}
            </Link>
          )}
          {task.dueAt && (
            <span className={cn(overdue && 'font-semibold text-clay')}>
              {overdue ? 'Overdue ' : 'Due '}
              {relativeTime(task.dueAt)}
              <span className="text-slate/60"> · {formatDateTime(task.dueAt)}</span>
            </span>
          )}
          {task.blockedNote && (
            <span className="inline-flex items-center gap-1 text-amber">
              <Lock className="h-3 w-3" />
              {task.blockedNote}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {showAssignee && task.assignee && (
          <Avatar name={task.assignee.name} tone={task.assignee.avatarTone} size="sm" />
        )}

        {task.status === 'TODO' && (
          <StatusButton
            taskId={task.id}
            status="IN_PROGRESS"
            label="Start"
            tone="primary"
            icon={<Play className="h-3 w-3" />}
          />
        )}
        {task.status === 'IN_PROGRESS' && (
          <StatusButton
            taskId={task.id}
            status="AWAITING_OTHERS"
            label="Hand off"
            icon={<ArrowRight className="h-3 w-3" />}
          />
        )}
        {['BLOCKED', 'AWAITING_OTHERS'].includes(task.status) && (
          <StatusButton
            taskId={task.id}
            status="IN_PROGRESS"
            label="Resume"
            tone="primary"
            icon={<CircleDot className="h-3 w-3" />}
          />
        )}
        {task.status !== 'DONE' ? (
          <StatusButton
            taskId={task.id}
            status="DONE"
            label="Actioned"
            tone="moss"
            icon={<Check className="h-3 w-3" />}
          />
        ) : (
          <StatusButton
            taskId={task.id}
            status="TODO"
            label="Reopen"
            icon={<CircleDot className="h-3 w-3" />}
          />
        )}
      </div>
    </li>
  );
}

export const taskItemSelect = {
  id: true,
  title: true,
  details: true,
  status: true,
  priority: true,
  category: true,
  dueAt: true,
  blockedNote: true,
  assignee: { select: { id: true, name: true, avatarTone: true } },
  customer: { select: { id: true, name: true, ref: true } },
  ticket: { select: { id: true, ref: true } },
} as const;
