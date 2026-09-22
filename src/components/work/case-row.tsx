import Link from 'next/link';

import { Avatar } from '@/components/ui/avatar';
import {
  ChannelChip,
  PriorityChip,
  SlaChip,
  TicketCategoryChip,
  TicketStatusChip,
} from '@/components/status-chips';
import { claimCase } from '@/actions/tickets';
import { ActionForm } from '@/components/ui/action-form';
import { relativeTime } from '@/lib/utils';

export type CaseRowData = {
  id: string;
  ref: string;
  subject: string;
  status: string;
  priority: string;
  channel: string;
  category: string;
  openedAt: Date;
  dueAt: Date | null;
  customer: { id: string; name: string; ref: string };
  assignee: { id: string; name: string; avatarTone: string } | null;
};

export const caseRowSelect = {
  id: true,
  ref: true,
  subject: true,
  status: true,
  priority: true,
  channel: true,
  category: true,
  openedAt: true,
  dueAt: true,
  customer: { select: { id: true, name: true, ref: true } },
  assignee: { select: { id: true, name: true, avatarTone: true } },
} as const;

export function CaseTable({
  cases,
  showAssignee = true,
  allowClaim = false,
}: {
  cases: CaseRowData[];
  showAssignee?: boolean;
  allowClaim?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th className="w-[38%]">Case</th>
            <th>Status</th>
            <th className="hidden md:table-cell">Priority</th>
            <th className="hidden xl:table-cell">Channel</th>
            <th>Deadline</th>
            {showAssignee && <th>Owner</th>}
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr key={c.id}>
              <td>
                <Link href={`/cases/${c.id}`} className="group block min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-2xs text-slate">{c.ref}</span>
                    <TicketCategoryChip value={c.category} dot={false} />
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-medium text-ink transition-colors group-hover:text-ember-dark">
                    {c.subject}
                  </span>
                  <span className="mt-0.5 block truncate text-2xs text-slate">
                    {c.customer.name} · opened {relativeTime(c.openedAt)}
                  </span>
                </Link>
              </td>
              <td>
                <TicketStatusChip value={c.status} />
              </td>
              <td className="hidden md:table-cell">
                <PriorityChip value={c.priority} dot={false} />
              </td>
              <td className="hidden xl:table-cell">
                <ChannelChip value={c.channel} dot={false} />
              </td>
              <td>
                <SlaChip dueAt={c.dueAt} compact />
              </td>
              {showAssignee && (
                <td>
                  {c.assignee ? (
                    <span className="flex items-center gap-2">
                      <Avatar name={c.assignee.name} tone={c.assignee.avatarTone} size="xs" />
                      <span className="text-xs text-slate">
                        {c.assignee.name.split(' ')[0]}
                      </span>
                    </span>
                  ) : allowClaim ? (
                    <ActionForm action={claimCase} fields={{ ticketId: c.id }}>
                      <button
                        type="submit"
                        className="rounded-full border border-ember/30 bg-ember-soft px-2.5 py-1 text-2xs font-medium text-ember-dark transition-colors hover:bg-ember hover:text-white"
                      >
                        Claim
                      </button>
                    </ActionForm>
                  ) : (
                    <span className="text-2xs text-clay">Unassigned</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
