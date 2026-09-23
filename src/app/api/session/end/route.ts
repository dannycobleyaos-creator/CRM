import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE } from '@/lib/auth';

/**
 * Clears a session cookie that no longer belongs to an active person — their
 * account was deactivated or removed. The middleware only checks the cookie's
 * signature, so without this the browser would bounce between the portal and
 * the sign-in page. Lives under /api so the middleware never intercepts it.
 */
export function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '?ended=1';
  const response = NextResponse.redirect(url);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
