import { Badge } from '@/components/ui/badge';
import {
  ANNOUNCEMENT_CATEGORY_META,
  CUSTOMER_STAGE_META,
  DISPATCH_STATUS_META,
  ORDER_STATUS_META,
  PRIORITY_META,
  ROLE_META,
  SOURCE_META,
  TASK_CATEGORY_META,
  TASK_STATUS_META,
  TICKET_CATEGORY_META,
  TICKET_CHANNEL_META,
  TICKET_STATUS_META,
  type StatusMeta,
} from '@/lib/constants';
import { SLA_STATE_META, slaState, titleCase, relativeTime } from '@/lib/utils';

/**
 * Renders any status string through its shared meta table. Unknown values fall
 * back to a readable label rather than crashing — imported data is never as
 * clean as the schema hopes.
 */
function meta<T extends string>(table: StatusMeta<T>, value: string) {
  return table[value as T] ?? { label: titleCase(value), tone: 'slate' as const };
}

type ChipProps = { value: string; dot?: boolean; size?: 'sm' | 'md' };

function chip<T extends string>(table: StatusMeta<T>, displayName: string) {
  function StatusChip({ value, dot = true, size }: ChipProps) {
    const m = meta(table, value);
    return (
      <Badge tone={m.tone} dot={dot} size={size} title={m.hint}>
        {m.label}
      </Badge>
    );
  }
  StatusChip.displayName = displayName;
  return StatusChip;
}

export const TicketStatusChip = chip(TICKET_STATUS_META, 'TicketStatusChip');
export const TaskStatusChip = chip(TASK_STATUS_META, 'TaskStatusChip');
export const DispatchStatusChip = chip(DISPATCH_STATUS_META, 'DispatchStatusChip');
export const CustomerStageChip = chip(CUSTOMER_STAGE_META, 'CustomerStageChip');
export const OrderStatusChip = chip(ORDER_STATUS_META, 'OrderStatusChip');
export const PriorityChip = chip(PRIORITY_META, 'PriorityChip');
export const ChannelChip = chip(TICKET_CHANNEL_META, 'ChannelChip');
export const TicketCategoryChip = chip(TICKET_CATEGORY_META, 'TicketCategoryChip');
export const TaskCategoryChip = chip(TASK_CATEGORY_META, 'TaskCategoryChip');
export const SourceChip = chip(SOURCE_META, 'SourceChip');
export const RoleChip = chip(ROLE_META, 'RoleChip');
export const AnnouncementCategoryChip = chip(ANNOUNCEMENT_CATEGORY_META, 'AnnouncementCategoryChip');

/** The deadline chip: says how long is left, and goes red the moment it isn't. */
export function SlaChip({
  dueAt,
  compact = false,
}: {
  dueAt?: Date | string | null;
  compact?: boolean;
}) {
  const state = slaState(dueAt);
  const m = SLA_STATE_META[state];
  if (state === 'none') {
    return (
      <span className="text-2xs text-slate/70">{compact ? '—' : 'No deadline'}</span>
    );
  }
  return (
    <Badge tone={m.tone} dot>
      {compact ? relativeTime(dueAt) : `${m.label} · ${relativeTime(dueAt)}`}
    </Badge>
  );
}
