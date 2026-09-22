import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Tone } from './constants';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

export const formatMoney = (value: number) => gbp.format(value ?? 0);

export const formatDate = (value?: Date | string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

export const formatDateTime = (value?: Date | string | null) =>
  value
    ? new Date(value).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

export const formatTime = (value?: Date | string | null) =>
  value
    ? new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : '—';

/** "4h 12m", "2d", "just now" — compact enough for a dense table. */
export function formatDuration(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  if (abs < 1) return 'just now';
  if (abs < 60) return `${abs}m`;
  if (abs < 60 * 24) {
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(abs / (60 * 24));
  const h = Math.floor((abs % (60 * 24)) / 60);
  return h ? `${d}d ${h}h` : `${d}d`;
}

export function formatSeconds(seconds?: number | null): string {
  if (!seconds && seconds !== 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

/** "2h ago" / "in 35m" — the phrasing agents actually scan for. */
export function relativeTime(value?: Date | string | null, now = new Date()): string {
  if (!value) return '—';
  const diffMs = new Date(value).getTime() - now.getTime();
  const mins = diffMs / 60000;
  if (Math.abs(mins) < 1) return 'just now';
  return mins < 0 ? `${formatDuration(mins)} ago` : `in ${formatDuration(mins)}`;
}

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

export const titleCase = (value: string) =>
  value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export const parseTags = (tags?: string | null) =>
  (tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

export function isToday(value?: Date | string | null) {
  if (!value) return false;
  const d = new Date(value);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

export const isOverdue = (dueAt?: Date | string | null, now = new Date()) =>
  !!dueAt && new Date(dueAt).getTime() < now.getTime();

/** How close a deadline is, as a traffic light the UI can paint directly. */
export type SlaState = 'breached' | 'at-risk' | 'on-track' | 'none';

export function slaState(dueAt?: Date | string | null, now = new Date()): SlaState {
  if (!dueAt) return 'none';
  const minutesLeft = (new Date(dueAt).getTime() - now.getTime()) / 60000;
  if (minutesLeft < 0) return 'breached';
  if (minutesLeft < 60) return 'at-risk';
  return 'on-track';
}

export const SLA_STATE_META: Record<SlaState, { label: string; tone: Tone }> = {
  breached: { label: 'Overdue', tone: 'clay' },
  'at-risk': { label: 'Due soon', tone: 'amber' },
  'on-track': { label: 'On track', tone: 'moss' },
  none: { label: 'No deadline', tone: 'slate' },
};

export const percent = (value: number, total: number) =>
  total === 0 ? 0 : Math.round((value / total) * 100);

/** Read a string field from a FormData, trimmed, or undefined when blank. */
export function formString(data: FormData, key: string): string | undefined {
  const raw = data.get(key);
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : undefined;
}
