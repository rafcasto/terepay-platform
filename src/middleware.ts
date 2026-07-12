import { type NextRequest, NextResponse } from 'next/server';

const PROTECTED_PATHS = ['/applicant', '/lender', '/admin', '/content-editor'];

type Role = 'applicant' | 'lender' | 'admin' | 'content_editor';

const VALID_ROLES: Role[] = ['applicant', 'lender', 'admin', 'content_editor'];

/** Edge-safe copy of the role-normalisation logic (no Node imports allowed here). */
function resolveRoles(payload: { role?: unknown; roles?: unknown }): Role[] {
  const out = new Set<Role>();
  if (Array.isArray(payload.roles)) {
    for (const r of payload.roles) {
      if (typeof r === 'string' && VALID_ROLES.includes(r as Role)) out.add(r as Role);
    }
  }
  if (typeof payload.role === 'string' && VALID_ROLES.includes(payload.role as Role)) {
    out.add(payload.role as Role);
  }
  return [...out];
}

function dashboardFor(role: Role | undefined): string {
  switch (role) {
    case 'admin': return '/admin/dashboard';
    case 'lender': return '/lender/dashboard';
    case 'content_editor': return '/content-editor/dashboard';
    case 'applicant': return '/applicant/dashboard';
    default: return '/auth/login';
  }
}

/** Best landing given the roles held, preferring the primary role. */
function preferredDashboard(primary: Role | undefined, roles: Role[]): string {
  if (primary && roles.includes(primary)) return dashboardFor(primary);
  for (const r of ['admin', 'lender', 'content_editor', 'applicant'] as Role[]) {
    if (roles.includes(r)) return dashboardFor(r);
  }
  return '/auth/login';
}

function portalRoleFor(pathname: string): Role | null {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/lender')) return 'lender';
  if (pathname.startsWith('/content-editor')) return 'content_editor';
  if (pathname.startsWith('/applicant')) return 'applicant';
  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));

  if (!isProtected) return NextResponse.next();

  const session = request.cookies.get('__session')?.value;

  if (!session) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Decode JWT payload without the Admin SDK (Edge Runtime compatible).
  // This is a fast presence/expiry check only — full verification happens in API routes.
  try {
    const parts = session.split('.');
    if (parts.length !== 3) throw new Error('malformed');

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8'),
    );

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.delete('__session');
      return res;
    }

    // Role-based routing: a user may hold multiple roles. Grant access to a
    // portal if the user's roles include that portal's role; otherwise send
    // them to the best dashboard they can access.
    const primary = payload.role as Role | undefined;
    const roles = resolveRoles(payload);
    const requiredRole = portalRoleFor(pathname);

    if (requiredRole && !roles.includes(requiredRole)) {
      return NextResponse.redirect(new URL(preferredDashboard(primary, roles), request.url));
    }
  } catch {
    // Corrupt cookie — clear and redirect to login
    const loginUrl = new URL('/auth/login', request.url);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete('__session');
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/applicant/:path*', '/lender/:path*', '/admin/:path*', '/content-editor/:path*'],
};
