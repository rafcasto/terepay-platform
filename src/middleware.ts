import { type NextRequest, NextResponse } from 'next/server';

const PROTECTED_PATHS = ['/applicant', '/lender'];

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

    // Role-based routing: prevent applicants from accessing lender pages and vice versa.
    const role = payload.role as string | undefined;

    if (pathname.startsWith('/lender') && role !== 'lender') {
      return NextResponse.redirect(new URL('/applicant/dashboard', request.url));
    }

    if (pathname.startsWith('/applicant') && role !== 'applicant') {
      return NextResponse.redirect(new URL('/lender/dashboard', request.url));
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
  matcher: ['/applicant/:path*', '/lender/:path*'],
};
