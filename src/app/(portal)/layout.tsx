import { db } from '@/lib/db';
import { canManageStock, isManagement, requireUser } from '@/lib/auth';
import {
  DISPATCH_OPEN_STATUSES,
  TICKET_ON_US_STATUSES,
} from '@/lib/constants';
import { Sidebar } from '@/components/nav/sidebar';
import { Topbar } from '@/components/nav/topbar';
import { UserMenu } from '@/components/nav/user-menu';
import type { NavCounts } from '@/components/nav/nav-config';
import { endOfDay } from '@/lib/utils';

function greetingFor(name: string) {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${name.split(' ')[0]}`;
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // The sidebar badges are the answer to "what needs actioning?" — they only
  // ever count work that is genuinely waiting on somebody here.
  const now = new Date();
  const [
    myCases,
    myTasks,
    myDatesDue,
    awaitingPayment,
    openDispatch,
    lowStock,
    announcementTotal,
    readCount,
  ] = await Promise.all([
    db.ticket.count({
      where: { assigneeId: user.id, status: { in: [...TICKET_ON_US_STATUSES] } },
    }),
    db.task.count({ where: { assigneeId: user.id, status: { not: 'DONE' } } }),
    // Order dates that are yours and due by the end of today — overdue included.
    db.orderDate.count({
      where: { ownerId: user.id, doneAt: null, dueAt: { lte: endOfDay(now) } },
    }),
    db.partsOrder.count({ where: { status: 'PLACED', paymentStatus: 'AWAITING' } }),
    db.partRequest.count({ where: { status: { in: [...DISPATCH_OPEN_STATUSES] } } }),
    canManageStock(user)
      ? db.part.count({
          where: { isActive: true, stockQty: { lte: db.part.fields.reorderLevel } },
        })
      : Promise.resolve(0),
    db.announcement.count(),
    db.announcementRead.count({ where: { userId: user.id } }),
  ]);

  const counts: NavCounts = {
    cases: myCases,
    board: myTasks,
    orders: myDatesDue,
    partsOrders: awaitingPayment,
    dispatch: openDispatch,
    inventory: lowStock,
    announcements: Math.max(0, announcementTotal - readCount),
  };

  return (
    <div className="lg:grid lg:grid-cols-[268px_minmax(0,1fr)] print:block">
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
        <main className="flex-1 px-5 py-6 sm:px-6 lg:px-8 lg:py-8 print:p-0">
          <div className="mx-auto w-full max-w-[1400px] animate-fade-up space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
