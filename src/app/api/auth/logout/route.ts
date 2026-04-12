import { type NextRequest, NextResponse } from 'next/server';
import { adminAuth, verifySessionOrIdToken } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { internalError } from '@/lib/utils/api-error';

export async function POST(request: NextRequest) {
  const sessionCookie = request.cookies.get('__session')?.value;
  let uid = 'unknown';

  try {
    if (sessionCookie) {
      const decoded = await verifySessionOrIdToken(sessionCookie).catch(() => null);
      if (decoded) {
        uid = decoded.uid;
        // Revoke all refresh tokens — invalidates existing sessions on all devices
        await adminAuth.revokeRefreshTokens(uid);
      }
    }

    const response = NextResponse.redirect(new URL('/auth/login', request.url));
    response.cookies.set('__session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    await auditLog({
      userId: uid,
      action: 'logout',
      targetType: 'auth',
      outcome: 'success',
      ipAddress: getClientIp(request),
    });

    return response;
  } catch {
    return internalError();
  }
}
