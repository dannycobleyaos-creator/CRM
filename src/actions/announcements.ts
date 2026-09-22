'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { db } from '@/lib/db';
import { isManagement, requireUser } from '@/lib/auth';
import { ANNOUNCEMENT_CATEGORIES, TEAMS } from '@/lib/constants';
import { formString } from '@/lib/utils';

/** Carries back what was typed — React clears the form when the action settles. */
export type ActionState = {
  error?: string;
  ok?: boolean;
  values?: Record<string, string>;
};

const schema = z.object({
  title: z.string().min(4, 'Give the announcement a headline'),
  body: z.string().min(10, 'Say what people actually need to do'),
  category: z.enum(ANNOUNCEMENT_CATEGORIES).default('COMPANY'),
  audience: z.enum(['ALL', ...TEAMS] as [string, ...string[]]).default('ALL'),
  pinned: z.boolean().default(false),
});

export async function createAnnouncement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!isManagement(user.role)) {
    return { error: 'Only team leads and managers can post to the announcement board.' };
  }

  const submitted = {
    title: formString(formData, 'title') ?? '',
    body: formString(formData, 'body') ?? '',
    category: formString(formData, 'category') ?? 'COMPANY',
    audience: formString(formData, 'audience') ?? 'ALL',
  };

  const parsed = schema.safeParse({
    ...submitted,
    pinned: formData.get('pinned') !== null,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Check the form and try again',
      values: submitted,
    };
  }

  await db.announcement.create({
    data: { ...parsed.data, authorId: user.id },
  });

  revalidatePath('/announcements');
  revalidatePath('/');
  return { ok: true };
}

export async function markAnnouncementRead(formData: FormData) {
  const user = await requireUser();
  const announcementId = formString(formData, 'announcementId');
  if (!announcementId) return;

  await db.announcementRead.upsert({
    where: { announcementId_userId: { announcementId, userId: user.id } },
    create: { announcementId, userId: user.id },
    update: { readAt: new Date() },
  });

  revalidatePath('/announcements');
  revalidatePath('/');
}

export async function markAllAnnouncementsRead() {
  const user = await requireUser();
  const all = await db.announcement.findMany({ select: { id: true } });

  await db.$transaction(
    all.map((a) =>
      db.announcementRead.upsert({
        where: { announcementId_userId: { announcementId: a.id, userId: user.id } },
        create: { announcementId: a.id, userId: user.id },
        update: { readAt: new Date() },
      }),
    ),
  );

  revalidatePath('/announcements');
  revalidatePath('/');
}
