import {
  ArrowLeftRight,
  Cog,
  Mail,
  MessageSquare,
  NotebookPen,
  PackageCheck,
  Phone,
  Smartphone,
  SquareCheckBig,
} from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ACTIVITY_TYPE_META, type ActivityType, type Tone } from '@/lib/constants';
import { cn, formatDateTime, formatSeconds, relativeTime } from '@/lib/utils';

const ICONS: Record<string, typeof Phone> = {
  CALL: Phone,
  CHAT: MessageSquare,
  EMAIL: Mail,
  SMS: Smartphone,
  NOTE: NotebookPen,
  STATUS_CHANGE: ArrowLeftRight,
  TASK: SquareCheckBig,
  DISPATCH: PackageCheck,
  SYSTEM: Cog,
};

const DOT_TONES: Record<Tone, string> = {
  ember: 'bg-ember-soft text-ember-dark ring-ember/25',
  moss: 'bg-moss-soft text-moss ring-moss/25',
  sky: 'bg-sky-soft text-sky ring-sky/25',
  amber: 'bg-amber-soft text-amber ring-amber/25',
  clay: 'bg-clay-soft text-clay ring-clay/25',
  slate: 'bg-sand text-slate ring-stone',
  anthracite: 'bg-anthracite/10 text-anthracite ring-anthracite/20',
};

export type TimelineEntry = {
  id: string;
  type: string;
  summary: string;
  body: string | null;
  direction: string | null;
  sourceSystem: string | null;
  sourceRef: string | null;
  durationSec: number | null;
  occurredAt: Date;
  user: { name: string; avatarTone: string } | null;
};

export const timelineSelect = {
  id: true,
  type: true,
  summary: true,
  body: true,
  direction: true,
  sourceSystem: true,
  sourceRef: true,
  durationSec: true,
  occurredAt: true,
  user: { select: { name: true, avatarTone: true } },
} as const;

/**
 * The whole argument for the portal in one component: a call from Aircall, a
 * tawk chat, an email and a note sit on the same spine, newest first, with the
 * source system stamped on each so nothing looks like it came from nowhere.
 */
export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (!entries.length) {
    return (
      <p className="px-5 py-8 text-center text-xs text-slate">
        Nothing logged yet. Anything you record here is what the next agent will read.
      </p>
    );
  }

  return (
    <ol className="relative px-5 py-4">
      <span
        className="absolute bottom-6 left-[2.35rem] top-8 w-px bg-stone"
        aria-hidden
      />
      {entries.map((entry) => {
        const meta = ACTIVITY_TYPE_META[entry.type as ActivityType] ?? {
          label: entry.type,
          tone: 'slate' as const,
        };
        const Icon = ICONS[entry.type] ?? Cog;

        return (
          <li key={entry.id} className="relative flex gap-4 pb-6 last:pb-1">
            <span
              className={cn(
                'relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1',
                DOT_TONES[meta.tone],
              )}
            >
              <Icon className="h-4 w-4" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Badge tone={meta.tone} dot={false}>
                  {meta.label}
                </Badge>
                {entry.direction && (
                  <span className="text-2xs uppercase tracking-brand text-slate/70">
                    {entry.direction === 'INBOUND' ? 'Inbound' : 'Outbound'}
                  </span>
                )}
                {entry.sourceSystem && entry.sourceSystem !== 'CRM' && (
                  <Badge tone="slate" dot={false} title={entry.sourceRef ?? undefined}>
                    via {entry.sourceSystem === 'TAWK' ? 'tawk.to' : entry.sourceSystem.toLowerCase()}
                  </Badge>
                )}
                {entry.durationSec ? (
                  <span className="text-2xs text-slate">{formatSeconds(entry.durationSec)}</span>
                ) : null}
              </div>

              <p className="mt-1.5 text-sm font-medium text-ink">{entry.summary}</p>
              {entry.body && (
                <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate">
                  {entry.body}
                </p>
              )}

              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-2xs text-slate/70">
                {entry.user ? (
                  <>
                    <Avatar name={entry.user.name} tone={entry.user.avatarTone} size="xs" />
                    <span>{entry.user.name}</span>
                    <span aria-hidden>·</span>
                  </>
                ) : entry.direction === 'INBOUND' ? (
                  <>
                    <span>From the customer</span>
                    <span aria-hidden>·</span>
                  </>
                ) : null}
                <time dateTime={entry.occurredAt.toISOString()} title={formatDateTime(entry.occurredAt)}>
                  {relativeTime(entry.occurredAt)}
                </time>
                <span className="text-slate/50">({formatDateTime(entry.occurredAt)})</span>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
