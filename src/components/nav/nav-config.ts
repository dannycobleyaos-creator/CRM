import {
  BarChart3,
  Building2,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  PackageCheck,
  SquareKanban,
  Users,
} from 'lucide-react';

export type NavKey =
  | 'dashboard'
  | 'cases'
  | 'board'
  | 'customers'
  | 'dispatch'
  | 'announcements'
  | 'performance'
  | 'team';

export type NavItem = {
  key: NavKey;
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Badge counts the number of things waiting on somebody. */
  countKey?: 'cases' | 'board' | 'dispatch' | 'announcements';
  managementOnly?: boolean;
  description: string;
};

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'My work',
    items: [
      {
        key: 'dashboard',
        href: '/',
        label: 'My day',
        icon: LayoutDashboard,
        description: 'Everything waiting on you, in the order it needs doing',
      },
      {
        key: 'board',
        href: '/board',
        label: 'Work board',
        icon: SquareKanban,
        countKey: 'board',
        description: 'Tasks by state — to action, actioning, blocked, actioned',
      },
      {
        key: 'cases',
        href: '/cases',
        label: 'Cases',
        icon: MessagesSquare,
        countKey: 'cases',
        description: 'Every call, chat and email as one queue',
      },
    ],
  },
  {
    title: 'Customers',
    items: [
      {
        key: 'customers',
        href: '/customers',
        label: 'Customers',
        icon: Building2,
        description: 'One record per customer with the full history',
      },
      {
        key: 'dispatch',
        href: '/dispatch',
        label: 'Parts dispatch',
        icon: PackageCheck,
        countKey: 'dispatch',
        description: 'Parts to send out, from request to doorstep',
      },
    ],
  },
  {
    title: 'Company',
    items: [
      {
        key: 'announcements',
        href: '/announcements',
        label: 'Announcements',
        icon: Megaphone,
        countKey: 'announcements',
        description: 'What the whole team needs to know',
      },
      {
        key: 'team',
        href: '/team',
        label: 'Team directory',
        icon: Users,
        description: 'Who does what, and their extension',
      },
      {
        key: 'performance',
        href: '/performance',
        label: 'Performance',
        icon: BarChart3,
        managementOnly: true,
        description: 'Team and individual output, SLA and workload',
      },
    ],
  },
];

export type NavCounts = Partial<Record<NonNullable<NavItem['countKey']>, number>>;
