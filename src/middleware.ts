import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'hygge_session';
const PUBLIC_PATHS = ['/login'];
const MANAGEMENT_PATHS = ['/performance'];
const MANAGEMENT_ROLES = ['TEAM_LEAD', 'MANAGER', 'ADMIN'];

/**
 * Keeps signed-out visitors out of the portal without every page having to
 * render first. `jose` is edge-safe, so the token is verified properly here
 * rather than just checked for existence.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  let signedIn = false;
  let role: string | null = null;

  if (token && process.env.AUTH_SECRET) {
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(process.env.AUTH_SECRET),
        { issuer: 'hygge-crm' },
      );
      signedIn = true;
      role = typeof payload.role === 'string' ? payload.role : null;
    } catch {
      signedIn = false;
    }
  }

  if (!signedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // Turn an agent away from a management URL here, so the address bar ends up
  // somewhere that matches what they are actually looking at.
  if (
    signedIn &&
    MANAGEMENT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) &&
    !MANAGEMENT_ROLES.includes(role ?? '')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (signedIn && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
