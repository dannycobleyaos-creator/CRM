import type { Metadata } from 'next';
import { Fragment } from 'react';
import { Headset, Mail, MessageSquare, PhoneIncoming } from 'lucide-react';

import { requireManagement } from '@/lib/auth';
import { getContactMetrics, type PersonContacts } from '@/lib/metrics';
import { CHANNEL_COLOURS } from '@/lib/chart-theme';
import { CONTACT_CHANNELS, CONTACT_CHANNEL_META, TEAMS, type Tone } from '@/lib/constants';
import { formatCount, formatDuration, formatSeconds, formatTalkTime } from '@/lib/utils';

import { Card, CardBody, CardHeader, EmptyState } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Stat } from '@/components/ui/stat';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { RoleChip } from '@/components/status-chips';
import { Meter } from '@/components/charts/meter';
import { LineChart } from '@/components/charts/line-chart';
import { ColumnChart } from '@/components/charts/column-chart';
import { MixBar } from '@/components/charts/mix-bar';
import { PerformanceNav } from '@/components/performance-nav';

export const metadata: Metadata = { title: 'Calls, chats and emails' };
export const dynamic = 'force-dynamic';

const PERIODS: Record<string, { days: number; label: string }> = {
  '1': { days: 1, label: 'Today so far' },
  '7': { days: 7, label: 'Last 7 days' },
  '30': { days: 30, label: 'Last 30 days' },
  '90': { days: 90, label: 'Last 90 days' },
};

const SERIES = CONTACT_CHANNELS.map((c) => ({
  key: c,
  name: CONTACT_CHANNEL_META[c].plural,
  colour: CHANNEL_COLOURS[c],
}));

/** The same thresholds as the SLA badges on the overview. */
const rateTone = (rate: number | null): Tone =>
  rate === null ? 'slate' : rate >= 90 ? 'moss' : rate >= 75 ? 'amber' : 'clay';

function RateBadge({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-2xs text-slate">—</span>;
  return (
    <Badge tone={rateTone(rate)} dot>
      {rate}%
    </Badge>
  );
}

function sumPeople(people: PersonContacts[]) {
  return people.reduce(
    (s, p) => ({
      callsIn: s.callsIn + p.callsIn,
      callsOut: s.callsOut + p.callsOut,
      talkSec: s.talkSec + p.talkSec,
      chats: s.chats + p.chats,
      emails: s.emails + p.emails,
      total: s.total + p.total,
      perDay: s.perDay + p.perDay,
    }),
    { callsIn: 0, callsOut: 0, talkSec: 0, chats: 0, emails: 0, total: 0, perDay: 0 },
  );
}

export default async function ChannelsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireManagement();
  const { period = '30' } = await searchParams;
  const { days, label } = PERIODS[period] ?? PERIODS['30']!;
  const { totals, series, bucket, hours, people } = await getContactMetrics(days);

  const teams = TEAMS.map((team) => ({ team, people: people.filter((p) => p.team === team) })).filter(
    (t) => t.people.length,
  );
  const empty = totals.handled === 0 && totals.inboundCalls === 0 && totals.emailsIn === 0;

  return (
    <>
      <PageHeader
        eyebrow="Management view"
        title="Calls, chats and emails"
        description="Every conversation from Aircall, tawk.to and the inbox in one report: how much came in, how quickly customers reached a person, and who did the work."
      />

      <PerformanceNav active="channels" period={period} />

      <FilterTabs
        basePath="/performance/channels"
        paramKey="period"
        active={period}
        options={Object.entries(PERIODS).map(([value, p]) => ({ value, label: p.label }))}
      />

      {empty ? (
        <Card>
          <EmptyState
            icon={<Headset className="h-5 w-5" />}
            title={period === '1' ? 'No contacts yet today' : 'No contacts in this period'}
            description="Calls, chats and emails appear here as soon as they are logged or come in from Aircall, tawk.to and the inbox."
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Calls answered"
              value={formatCount(totals.answeredCalls)}
              sub={
                totals.inboundCalls
                  ? `${totals.answerRate}% of ${formatCount(totals.inboundCalls)} inbound · ${formatCount(totals.missedCalls)} missed`
                  : 'No inbound calls yet'
              }
              tone={rateTone(totals.answerRate)}
              icon={<PhoneIncoming className="h-4 w-4" />}
            />
            <Stat
              label="Live chats handled"
              value={formatCount(totals.chats)}
              sub={
                totals.chats + totals.missedChats
                  ? `${totals.chatAnswerRate}% answered · ${totals.avgChatWaitSec === null ? '—' : formatSeconds(totals.avgChatWaitSec)} average wait`
                  : 'No chats yet'
              }
              tone={rateTone(totals.chatAnswerRate)}
              icon={<MessageSquare className="h-4 w-4" />}
            />
            <Stat
              label="Emails sent"
              value={formatCount(totals.emailsOut)}
              sub={`${formatCount(totals.emailsIn)} received${totals.avgReplyMins === null ? '' : ` · first reply in ${formatDuration(totals.avgReplyMins)} on average`}`}
              tone={rateTone(totals.replyWithinTarget)}
              icon={<Mail className="h-4 w-4" />}
            />
            <Stat
              label="Time on the phone"
              value={formatTalkTime(totals.talkSec)}
              sub={`${formatCount(totals.outboundCalls)} outbound calls${totals.avgHandleSec === null ? '' : ` · ${formatSeconds(totals.avgHandleSec)} average inbound call`}`}
              tone="sky"
              icon={<Headset className="h-4 w-4" />}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader
                eyebrow={label}
                title={`${formatCount(totals.handled)} conversations handled`}
                description={
                  bucket === 'hour'
                    ? 'Calls answered and made, chats handled and emails sent today, hour by hour.'
                    : bucket === 'day'
                      ? `Calls answered and made, chats handled and emails sent each day, to the end of yesterday. About ${formatCount(Math.round(totals.handled / totals.workingDays))} a working day.`
                      : `Average per working day, week by week, to the end of yesterday. About ${formatCount(Math.round(totals.handled / totals.workingDays))} a working day overall.`
                }
              />
              <CardBody className="px-0 pb-0 pt-3">
                <LineChart
                  data={series}
                  series={SERIES}
                  xHeading={bucket === 'hour' ? 'Hour' : bucket === 'week' ? 'Week of' : 'Day'}
                  ariaLabel={
                    bucket === 'week'
                      ? `Calls, live chats and emails handled per working day, week by week, ${label.toLowerCase()}`
                      : `Calls, live chats and emails handled per ${bucket}, ${label.toLowerCase()}`
                  }
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader eyebrow="Service level" title="Did customers reach us?" />
              <CardBody className="space-y-5">
                <Meter
                  value={totals.answerRate}
                  label="Calls answered"
                  caption="Inbound calls picked up by a person, not abandoned in the queue."
                />
                <Meter
                  value={totals.chatAnswerRate}
                  label="Chats answered"
                  caption="Visitors who got a person before giving up."
                />
                <Meter
                  value={totals.replyWithinTarget}
                  label="Emails replied within 4 hours"
                  caption="From the email arriving to our first reply."
                />
                <dl className="space-y-2.5 border-t border-stone/60 pt-4 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate">Average wait before a call is answered</dt>
                    <dd className="tabular-nums text-ink">{totals.avgAnswerSec === null ? '—' : formatSeconds(totals.avgAnswerSec)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate">Average live chat</dt>
                    <dd className="tabular-nums text-ink">{totals.avgChatSec === null ? '—' : formatSeconds(totals.avgChatSec)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate">Outbound calls that connected</dt>
                    <dd className="tabular-nums text-ink">
                      {totals.outboundCalls ? `${Math.round((totals.connectedOutbound / totals.outboundCalls) * 100)}%` : '—'}
                    </dd>
                  </div>
                </dl>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader
              eyebrow={`${label} · ${totals.workingDays} working ${totals.workingDays === 1 ? 'day' : 'days'}`}
              title="When customers try to reach a person"
              description="Calls and live chats arriving in each hour, answered or not, averaged per working day. Put people on the phones for the peaks."
            />
            <CardBody className="px-0 pb-0 pt-3">
              <ColumnChart
                data={hours.map((h) => ({
                  key: h.key,
                  label: h.label,
                  value: h.value,
                  detail: `${formatCount(h.total)} in total, ${formatCount(h.missed)} missed${h.total ? ` (${Math.round((h.missed / h.total) * 100)}%)` : ''}`,
                }))}
                valueName="a day"
                xHeading="Hour"
                ariaLabel="Calls and chats arriving per hour of the day, averaged per working day"
                decimals={1}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              eyebrow={`${people.length} people · ${label}`}
              title="Who handled what"
              description="Grouped by team, busiest first. Missed calls and chats are the company's, not any one person's — nobody picked them up."
              action={
                <span className="flex flex-wrap items-center gap-3">
                  {SERIES.map((s) => (
                    <span key={s.key} className="inline-flex items-center gap-1.5 text-2xs text-slate">
                      <span className="h-2 w-3 rounded-[2px]" style={{ background: s.colour }} />
                      {s.name}
                    </span>
                  ))}
                </span>
              }
            />
            <div className="overflow-x-auto">
              <table className="data-table [&_td]:whitespace-nowrap">
                <thead>
                  <tr>
                    <th className="w-[20%]">Person</th>
                    <th className="text-right">Calls in</th>
                    <th className="hidden md:table-cell text-right">Calls out</th>
                    <th className="hidden lg:table-cell text-right">Talk time</th>
                    <th className="hidden xl:table-cell text-right">Avg call</th>
                    <th className="text-right">Chats</th>
                    <th className="hidden xl:table-cell text-right">Avg chat</th>
                    <th className="text-right">Emails</th>
                    <th className="hidden lg:table-cell text-right">Avg reply</th>
                    <th className="hidden md:table-cell">Within 4h</th>
                    <th className="text-right">Per day</th>
                    <th className="hidden sm:table-cell w-[12%]">Mix</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map(({ team, people: members }) => {
                    const sub = sumPeople(members);
                    return (
                      <Fragment key={team}>
                        <tr className="bg-sand/40 hover:bg-sand/40">
                          <td className="py-2 text-2xs font-semibold uppercase tracking-brand text-slate">{team}</td>
                          <td className="py-2 text-right text-xs font-medium tabular-nums text-slate">{formatCount(sub.callsIn)}</td>
                          <td className="hidden md:table-cell py-2 text-right text-xs tabular-nums text-slate">{formatCount(sub.callsOut)}</td>
                          <td className="hidden lg:table-cell py-2 text-right text-xs tabular-nums text-slate">{formatTalkTime(sub.talkSec)}</td>
                          <td className="hidden xl:table-cell py-2" />
                          <td className="py-2 text-right text-xs font-medium tabular-nums text-slate">{formatCount(sub.chats)}</td>
                          <td className="hidden xl:table-cell py-2" />
                          <td className="py-2 text-right text-xs font-medium tabular-nums text-slate">{formatCount(sub.emails)}</td>
                          <td className="hidden lg:table-cell py-2" />
                          <td className="hidden md:table-cell py-2" />
                          <td className="py-2 text-right text-xs font-medium tabular-nums text-slate">{sub.perDay.toFixed(1)}</td>
                          <td className="hidden sm:table-cell py-2">
                            <MixBar
                              segments={CONTACT_CHANNELS.map((c) => ({
                                key: c,
                                label: CONTACT_CHANNEL_META[c].plural,
                                value: c === 'CALL' ? sub.callsIn + sub.callsOut : c === 'CHAT' ? sub.chats : sub.emails,
                                colour: CHANNEL_COLOURS[c],
                              }))}
                            />
                          </td>
                        </tr>
                        {members.map((p) => (
                          <tr key={p.userId}>
                            <td>
                              <span className="flex items-center gap-2.5">
                                <Avatar name={p.name} tone={p.avatarTone} size="sm" />
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-medium text-ink">{p.name}</span>
                                  <RoleChip value={p.role} dot={false} />
                                </span>
                              </span>
                            </td>
                            <td className="text-right text-sm tabular-nums text-ink">{formatCount(p.callsIn)}</td>
                            <td className="hidden md:table-cell text-right text-sm tabular-nums text-ink">{formatCount(p.callsOut)}</td>
                            <td className="hidden lg:table-cell text-right text-xs tabular-nums text-slate">{formatTalkTime(p.talkSec)}</td>
                            <td className="hidden xl:table-cell text-right text-xs tabular-nums text-slate">
                              {p.avgHandleSec === null ? '—' : formatSeconds(p.avgHandleSec)}
                            </td>
                            <td className="text-right text-sm tabular-nums text-ink">{formatCount(p.chats)}</td>
                            <td className="hidden xl:table-cell text-right text-xs tabular-nums text-slate">
                              {p.avgChatSec === null ? '—' : formatSeconds(p.avgChatSec)}
                            </td>
                            <td className="text-right text-sm tabular-nums text-ink">{formatCount(p.emails)}</td>
                            <td className="hidden lg:table-cell text-right text-xs tabular-nums text-slate">
                              {p.avgReplyMins === null ? '—' : formatDuration(p.avgReplyMins)}
                            </td>
                            <td className="hidden md:table-cell">
                              <RateBadge rate={p.replyWithinTarget} />
                            </td>
                            <td className="text-right text-sm font-medium tabular-nums text-ink">{p.perDay.toFixed(1)}</td>
                            <td className="hidden sm:table-cell">
                              <MixBar
                                segments={CONTACT_CHANNELS.map((c) => ({
                                  key: c,
                                  label: CONTACT_CHANNEL_META[c].plural,
                                  value: c === 'CALL' ? p.callsIn + p.callsOut : c === 'CHAT' ? p.chats : p.emails,
                                  colour: CHANNEL_COLOURS[c],
                                }))}
                              />
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="text-2xs text-slate">
            {period === '1'
              ? 'Today so far, up to now.'
              : `${label} runs to the end of yesterday and covers ${totals.workingDays} working days; today is on the Today view.`}{' '}
            Per day is conversations handled per working day. Reply time is from an email arriving to our first reply; call and
            chat waits are from joining the queue to a person answering. The 4-hour reply target and the 90% / 75%
            colour thresholds match the service levels on the overview.
          </p>
        </>
      )}
    </>
  );
}
