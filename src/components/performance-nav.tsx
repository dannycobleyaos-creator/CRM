import { SubNav } from '@/components/ui/sub-nav';

/** The two management views share a period, so switching keeps it. */
export function PerformanceNav({ active, period }: { active: 'overview' | 'channels'; period?: string }) {
  const keep = period && period !== '1' ? `?period=${period}` : '';
  return (
    <SubNav
      active={active}
      items={[
        { key: 'overview', href: `/performance${keep}`, label: 'Output and service' },
        { key: 'channels', href: `/performance/channels${period ? `?period=${period}` : ''}`, label: 'Calls, chats and emails' },
      ]}
    />
  );
}
