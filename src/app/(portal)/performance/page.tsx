import type { Metadata } from 'next';
import { AlarmClock, CheckCircle2, Gauge, Inbox, Smile, Timer } from 'lucide-react';

import { requireManagement } from '@/lib/auth';
import { getAgentMetrics, getCaseMix, getDailyFlow, getTeamTotals } from '@/lib/metrics';
import { TEAMS } from '@/lib/constants';
import { formatDuration } from '@/lib/utils';

import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Stat } from '@/components/ui/stat';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { RoleChip } from '@/components/status-chips';
import { FlowChart } from '@/components/charts/flow-chart';
import { BarList } from '@/components/charts/bar-list';
import { Meter } from '@/components/charts/meter';

export const metadata: Metadata = { title: 'Performance' };
export const dynamic = 'force-dynamic';

const PERIODS: Record<string, { days: number; label: string }> = {
  '7': { days: 7, label: 'Last 7 days' },
  '30': { days: 30, label: 'Last 30 days' },
  '90': { days: 90, label: 'Last 90 days' },
};

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; team?: string }>;
}) {
  await requireManagement();
  const { period = '30', team = '' } = await searchParams;
  const { days, label } = PERIODS[period] ?? PERIODS['30']!;

  const [totals, agents, flow, mix] = await Promise.all([
    getTeamTotals(days),
    getAgentMetrics(days),
    getDailyFlow(days),
    getCaseMix(days),
  ]);

  const visible = (team ? agents.filter((a) => a.team === team) : agents).sort(
    (a, b) =>
      b.casesResolved + b.tasksCompleted - (a.casesResolved + a.tasksCompleted),
  );

  const workload = [...visible]
    .map((a) => ({ key: a.userId, label: a.name, value: a.tasksOpen + a.casesOpen }))
    .sort((x, y) => y.value - x.value);

  const totalOverdue = visible.reduce((s, a) => s + a.tasksOverdue, 0);

  return (
    <>
      <PageHeader
        eyebrow="Management view"
        title="Performance"
        description="Output, responsiveness and workload — built from work people already do in the portal, so nobody has to fill in a timesheet for it to be true."
      />

      {/* One filter row, scoping everything below it */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterTabs
          basePath="/performance"
          paramKey="period"
          active={period}
          params={{ team }}
          options={Object.entries(PERIODS).map(([value, p]) => ({ value, label: p.label }))}
        />
        <span className="hidden h-5 w-px bg-stone sm:block" />
        <FilterTabs
          basePath="/performance"
          paramKey="team"
          active={team}
          params={{ period }}
          options={[
            { value: '', label: 'All teams' },
            ...TEAMS.map((t) => ({ value: t, label: t })),
          ]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Cases resolved"
          value={totals.casesResolved}
          sub={`${totals.casesOpened} opened in the same period`}
          tone={totals.casesResolved >= totals.casesOpened ? 'moss' : 'amber'}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <Stat
          label="Average first response"
          value={totals.avgFirstResponseMins === null ? '—' : formatDuration(totals.avgFirstResponseMins)}
          sub="From the case landing to a human replying"
          tone="sky"
          icon={<Timer className="h-4 w-4" />}
        />
        <Stat
          label="Open backlog"
          value={totals.openBacklog}
          sub={`${totals.breachedNow} past their deadline right now`}
          tone={totals.breachedNow ? 'clay' : 'moss'}
          icon={<Inbox className="h-4 w-4" />}
        />
        <Stat
          label="Tasks actioned"
          value={totals.tasksCompleted}
          sub={`${totalOverdue} currently overdue across the team`}
          tone={totalOverdue ? 'amber' : 'moss'}
          icon={<Gauge className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            eyebrow={label}
            title="Are we keeping up?"
            description={
              days > 30
                ? 'Cases opened against cases resolved, by week. If the orange line stays above the blue one, the backlog is growing.'
                : 'Cases opened against cases resolved, by day. If the orange line stays above the blue one, the backlog is growing.'
            }
          />
          <CardBody className="px-0 pb-0 pt-3">
            <FlowChart data={flow} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader eyebrow="Service level" title="Promises kept" />
          <CardBody className="space-y-5">
            <Meter
              value={totals.slaHitRate}
              label="First response within target"
              caption="Share of resolved cases answered before the deadline the priority sets."
            />
            <Meter
              value={
                totals.casesOpened
                  ? Math.min(100, Math.round((totals.casesResolved / totals.casesOpened) * 100))
                  : null
              }
              label="Resolved vs opened"
              caption="Above 100% means the team is eating into the backlog."
            />
            <div className="flex items-center justify-between gap-3 border-t border-stone/60 pt-4">
              <span className="inline-flex items-center gap-2 text-2xs uppercase tracking-brand text-slate">
                <Smile className="h-3.5 w-3.5" />
                Customer satisfaction
              </span>
              <span className="font-display text-lg font-light text-ink">
                {totals.csat === null ? '—' : `${totals.csat} / 5`}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-stone/60 pt-4">
              <span className="inline-flex items-center gap-2 text-2xs uppercase tracking-brand text-slate">
                <AlarmClock className="h-3.5 w-3.5" />
                Breaching right now
              </span>
              <span className="font-display text-lg font-light text-clay">
                {totals.breachedNow}
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            eyebrow={label}
            title="What people are contacting us about"
            description="Where the demand actually comes from — useful when deciding what to fix upstream."
          />
          <BarList data={mix.byCategory} />
        </Card>

        <Card>
          <CardHeader
            eyebrow={label}
            title="How they reach us"
            description="Phone, chat, email and social, counted in one place for the first time."
          />
          <BarList data={mix.byChannel} />
        </Card>
      </div>

      <Card>
        <CardHeader
          eyebrow={`${visible.length} people · ${label}`}
          title="Individual performance"
          description="Sorted by total output. Response time and SLA are measured from resolved cases only."
        />
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-[22%]">Person</th>
                <th>Cases resolved</th>
                <th className="hidden md:table-cell">Avg first response</th>
                <th>SLA met</th>
                <th className="hidden lg:table-cell">Tasks actioned</th>
                <th>Open now</th>
                <th className="hidden xl:table-cell">Overdue</th>
                <th className="hidden xl:table-cell">CSAT</th>
                <th className="hidden xl:table-cell">Logged call time</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => (
                <tr key={a.userId}>
                  <td>
                    <span className="flex items-center gap-2.5">
                      <Avatar name={a.name} tone={a.avatarTone} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">
                          {a.name}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          <RoleChip value={a.role} dot={false} />
                          <span className="text-2xs text-slate">{a.team}</span>
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="text-sm tabular-nums text-ink">{a.casesResolved}</td>
                  <td className="hidden md:table-cell text-sm tabular-nums text-slate">
                    {a.avgFirstResponseMins === null ? '—' : formatDuration(a.avgFirstResponseMins)}
                  </td>
                  <td>
                    {a.slaHitRate === null ? (
                      <span className="text-2xs text-slate">—</span>
                    ) : (
                      <Badge
                        tone={a.slaHitRate >= 90 ? 'moss' : a.slaHitRate >= 75 ? 'amber' : 'clay'}
                        dot
                      >
                        {a.slaHitRate}%
                      </Badge>
                    )}
                  </td>
                  <td className="hidden lg:table-cell text-sm tabular-nums text-ink">
                    {a.tasksCompleted}
                  </td>
                  <td className="text-sm tabular-nums text-slate">
                    {a.tasksOpen + a.casesOpen}
                  </td>
                  <td className="hidden xl:table-cell">
                    {a.tasksOverdue > 0 ? (
                      <Badge tone="clay" dot={false}>
                        {a.tasksOverdue}
                      </Badge>
                    ) : (
                      <span className="text-2xs text-slate">0</span>
                    )}
                  </td>
                  <td className="hidden xl:table-cell text-sm tabular-nums text-slate">
                    {a.csat === null ? '—' : a.csat}
                  </td>
                  <td className="hidden xl:table-cell text-sm tabular-nums text-slate">
                    {a.loggedCallMinutes ? formatDuration(a.loggedCallMinutes) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader
          eyebrow="Right now"
          title="Who is carrying what"
          description="Open cases plus open tasks, per person. A flat profile means the work is spread; a spike means somebody needs help."
        />
        <BarList data={workload} emptyLabel="Nobody has anything open." />
      </Card>

      <p className="text-2xs text-slate">
        Figures cover {label.toLowerCase()}
        {team ? ` for ${team}` : ''}. Response and SLA numbers come from cases resolved in the
        period; workload is live.
      </p>
    </>
  );
}
