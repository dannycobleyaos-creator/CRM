'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { db } from '@/lib/db';
import { createSession, destroySession, verifyPassword } from '@/lib/auth';
import type { Role } from '@/lib/constants';

const credentials = z.object({
  email: z.string().email('Enter a valid work email address'),
  password: z.string().min(1, 'Enter your password'),
  next: z.string().optional(),
});

/**
 * React resets an uncontrolled form once its action settles, so anything the
 * person typed has to come back in the state or they retype it. The password is
 * deliberately not echoed.
 */
export type LoginState = { error?: string; email?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  const parsed = credentials.safeParse({
    email,
    password: String(formData.get('password') ?? ''),
    next: String(formData.get('next') ?? ''),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Check your details and try again',
      email,
    };
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });

  // Deliberately identical message for unknown email and wrong password so the
  // form cannot be used to discover who works here.
  if (!user || !user.isActive || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: 'That email and password combination was not recognised.', email };
  }

  await createSession(user.id, user.role as Role);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const next = parsed.data.next;
  redirect(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
}

export async function logout() {
  await destroySession();
  redirect('/login');
}
