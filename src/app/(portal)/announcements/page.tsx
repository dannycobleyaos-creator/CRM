import type { Metadata } from 'next';
import { CheckCheck, Megaphone, Pin } from 'lucide-react';

import { isManagement, requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { markAllAnnouncementsRead, markAnnouncementRead } from '@/actions/announcements';
import { formatDateTime, relativeTime } from '@/lib/utils';

import { ActionForm } from '@/components/ui/action-form';
import { Card, CardBody, EmptyState } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarStack } from '@/components/ui/avatar';
import { AnnouncementCategoryChip } from '@/components/status-chips';
import { NewAnnouncementForm } from '@/components/announcements/new-announcement-form';

export const metadata: Metadata = { title: 'Announcements' };
export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage() {
  const user = await requireUser();

  const announcements = await db.announcement.findMany({
    where: { OR: [{ audience: 'ALL' }, { audience: user.team }] },
    orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
    include: {
      author: { select: { name: true, avatarTone: true, jobTitle: true } },
      reads: {
        include: { user: { select: { id: true, name: true, avatarTone: true } } },
      },
    },
  });

  const unreadCount = announcements.filter(
    (a) => !a.reads.some((r) => r.userId === user.id),
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="Noticeboard"
        title="Announcements"
        description="Process changes, stock warnings and company news — in one place, with a record of who has read what."
        actions={
          <>
            {unreadCount > 0 && (
              <ActionForm action={markAllAnnouncementsRead}>
                <Button type="submit" variant="secondary" size="sm">
                  <CheckCheck className="h-4 w-4" />
                  Mark all read
                </Button>
              </ActionForm>
            )}
            {isManagement(user.role) && <NewAnnouncementForm />}
          </>
        }
      />

      {unreadCount > 0 && (
        <p className="rounded-brand border border-ember/30 bg-ember-soft px-4 py-2.5 text-xs text-ember-dark">
          You have {unreadCount} unread {unreadCount === 1 ? 'announcement' : 'announcements'}.
        </p>
      )}

      {announcements.length ? (
        <div className="space-y-4">
          {announcements.map((a) => {
            const read = a.reads.some((r) => r.userId === user.id);

            return (
              <Card
                key={a.id}
                className={
                  a.pinned
                    ? 'border-l-4 border-l-ember'
                    : !read
                      ? 'border-l-4 border-l-stone'
                      : undefined
                }
              >
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <AnnouncementCategoryChip value={a.category} />
                    {a.pinned && (
                      <Badge tone="anthracite" dot={false}>
                        <Pin className="h-3 w-3" />
                        Pinned
                      </Badge>
                    )}
                    {a.audience !== 'ALL' && (
                      <Badge tone="sky" dot={false}>
                        {a.audience} only
                      </Badge>
                    )}
                    {!read && (
                      <Badge tone="ember" dot>
                        Unread
                      </Badge>
                    )}
                  </div>

                  <div>
                    <h2 className="font-display text-lg font-medium text-ink">{a.title}</h2>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate">
                      {a.body}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone/60 pt-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={a.author.name} tone={a.author.avatarTone} size="sm" />
                      <div>
                        <p className="text-xs font-medium text-ink">{a.author.name}</p>
                        <p className="text-2xs text-slate">
                          {a.author.jobTitle} · {relativeTime(a.publishedAt)}
                          <span className="text-slate/60"> · {formatDateTime(a.publishedAt)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {a.reads.length > 0 && (
                        <span
                          className="flex items-center gap-2"
                          title={`Read by ${a.reads.map((r) => r.user.name).join(', ')}`}
                        >
                          <AvatarStack people={a.reads.map((r) => r.user)} max={5} />
                          <span className="text-2xs text-slate">read</span>
                        </span>
                      )}
                      {!read && (
                        <ActionForm
                          action={markAnnouncementRead}
                          fields={{ announcementId: a.id }}
                        >
                          <Button type="submit" variant="secondary" size="sm">
                            Got it
                          </Button>
                        </ActionForm>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<Megaphone className="h-5 w-5" />}
            title="Nothing posted yet"
            description="When a manager posts a process change or a stock warning it will appear here."
          />
        </Card>
      )}
    </>
  );
}
