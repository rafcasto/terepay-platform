import { type NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import { normalizeRoles } from '@/lib/auth/roles';

export const dynamic = 'force-dynamic';

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

    // Fetch Firestore document and live Firebase Auth record in parallel.
    // The session cookie is an immutable snapshot — it does NOT update when the
    // user verifies their email.  adminAuth.getUser() always returns live state.
    const [userDoc, liveAuthUser] = await Promise.all([
      adminDb.collection('users').doc(decoded.uid).get(),
      adminAuth.getUser(decoded.uid),
    ]);

    if (!userDoc.exists) {
      return NextResponse.json({ user: null });
    }

    const data = userDoc.data()!;
    const liveEmailVerified = liveAuthUser.emailVerified;

    // Sync Firestore if Firebase Auth now says verified but Firestore still has false.
    if (liveEmailVerified && !data.emailVerified) {
      await adminDb
        .collection('users')
        .doc(decoded.uid)
        .update({ emailVerified: true })
        .catch(() => {/* non-critical */});
    }

    // Roles: prefer the Firestore document (authoritative, updated by admin),
    // then fall back to the token claims, then to the single `role`.
    const roles = normalizeRoles(data.role, data.roles ?? decoded.roles);

    return NextResponse.json({
      user: {
        uid: decoded.uid,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        roles,
        profileComplete: data.profileComplete,
        kycStatus: data.kycStatus ?? 'not_started',
        phoneVerified: data.phoneVerified ?? false,
        emailVerified: liveEmailVerified,
        isExistingCustomer: data.isExistingCustomer === true,
      },
    });
  } catch {
    // Expired or invalid cookie — treat as unauthenticated
    return NextResponse.json({ user: null });
  }
}
