import { type NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { internalError } from '@/lib/utils/api-error';

/**
 * GET /api/auth/me
 * Returns the currently authenticated user from the session cookie.
 * Used by client to hydrate auth state after page reload.
 */
export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get('__session')?.value;
  if (!sessionCookie) {
    return NextResponse.json({ user: null });
  }

  try {
    const decoded = await verifySessionOrIdToken(sessionCookie);
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get();

    if (!userDoc.exists) {
      return NextResponse.json({ user: null });
    }

    const data = userDoc.data()!;
    return NextResponse.json({
      user: {
        uid: decoded.uid,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        profileComplete: data.profileComplete,
      },
    });
  } catch {
    // Expired or invalid cookie — treat as unauthenticated
    return NextResponse.json({ user: null });
  }
}
