import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

import { db } from './db';
import { MANAGEMENT_ROLES, type Role } from './constants';

export const SESSION_COOKIE = 'hygge_session';
const SESSION_DAYS = 7;

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      'AUTH_SECRET is missing or too short. Copy .env.example to .env and set a long random value.',
    );
  }
  return new TextEncoder().encode(secret);
}

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

/**
 * The role travels in the token so `middleware.ts` can turn an agent away from a
 * management URL with a real redirect, before any of it renders. The database
 * check in `requireManagement` stays the authority — this only saves a render.
 */
export async function signSessionToken(userId: string, role: Role) {
  return new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('hygge-crm')
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function readSessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: 'hygge-crm' });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function createSession(userId: string, role: Role) {
  const token = await signSessionToken(userId, role);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  team: string;
  jobTitle: string | null;
  avatarTone: string;
  dailyTarget: number;
};

/**
 * Cached per request so a page can call it as often as it likes without
 * re-hitting the database.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const userId = await readSessionToken(token);
  if (!userId) return null;

  const user = await db.user.findFirst({
    where: { id: userId, isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      team: true,
      jobTitle: true,
      avatarTone: true,
      dailyTarget: true,
    },
  });

  return user ? ({ ...user, role: user.role as Role } satisfies SessionUser) : null;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    // A cookie whose person has been deactivated or removed still passes the
    // middleware's signature check, so it has to be cleared on the way out —
    // otherwise /login sends them straight back here, round and round.
    const jar = await cookies();
    redirect(jar.has(SESSION_COOKIE) ? '/api/session/end' : '/login');
  }
  return user;
}

export const isManagement = (role: Role) => MANAGEMENT_ROLES.includes(role);

/**
 * Who may change prices, stock levels, bills of materials and purchase orders:
 * management and the warehouse. Everybody can see the inventory and order parts.
 */
export const canManageStock = (user: Pick<SessionUser, 'role' | 'team'>) =>
  isManagement(user.role) || user.team === 'Warehouse';

/**
 * Management-only screens. Agents are sent back to their own dashboard rather
 * than shown an error — the nav never offers them the link in the first place,
 * so arriving here means they typed the URL or followed a stale bookmark.
 */
export async function requireManagement(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isManagement(user.role)) redirect('/');
  return user;
}
