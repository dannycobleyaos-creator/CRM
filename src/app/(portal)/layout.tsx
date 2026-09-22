import { db } from '@/lib/db';
import { isManagement, requireUser } from '@/lib/auth';
import {
  DISPATCH_OPEN_STATUSES,
  TICKET_ON_US_STATUSES,
} from '@/lib/constants';
import { Sidebar } from '@/components/nav/sidebar';
import { Topbar } from '@/components/nav/topbar';
import { UserMenu } from '@/components/nav/user-menu';
import type { NavCounts } from '@/components/nav/nav-config';

function greetingFor(name: string) {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${name.split(' ')[0]}`;
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // The sidebar badges are the answer to "what needs actioning?" — they only
  // ever count work that is genuinely waiting on somebody here.
  const [myCases, myTasks, openDispatch, announcementTotal, readCount] = await Promise.all([
    db.ticket.count({
      where: { assigneeId: user.id, status: { in: [...TICKET_ON_US_STATUSES] } },
    }),
    db.task.count({ where: { assigneeId: user.id, status: { not: 'DONE' } } }),
    db.partRequest.count({ where: { status: { in: [...DISPATCH_OPEN_STATUSES] } } }),
    db.announcement.count(),
    db.announcementRead.count({ where: { userId: user.id } }),
  ]);

  const counts: NavCounts = {
    cases: myCases,
    board: myTasks,
    dispatch: openDispatch,
    announcements: Math.max(0, announcementTotal - readCount),
  };

  return (
    <div className="lg:grid lg:grid-cols-[268px_minmax(0,1fr)]">
      <Sidebar
        counts={counts}
        canSeeManagement={isManagement(user.role)}
        footer={
          <UserMenu
            name={user.name}
            role={user.role}
            team={user.team}
            avatarTone={user.avatarTone}
          />
        }
      />

      <div className="flex min-h-screen min-w-0 flex-col">
        <Topbar
          greeting={greetingFor(user.name)}
          subline={`${user.jobTitle ?? user.team} · ${counts.board ?? 0} open tasks, ${counts.cases ?? 0} cases with you`}
        />
        <main className="flex-1 px-5 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1400px] animate-fade-up space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
