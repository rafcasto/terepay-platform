import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { adminCreateLenderSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// GET /api/admin/users — list all lender users
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const auth = await withAuth(request, ['admin']);
    await checkRateLimit(defaultLimiter, auth.uid);

    const snap = await adminDb
      .collection('users')
      .where('role', '==', 'lender')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const users = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        uid: d.uid,
        email: d.email,
        firstName: d.firstName,
        lastName: d.lastName,
        status: d.status,
        profileComplete: d.profileComplete,
        createdAt: d.createdAt?.toMillis?.() ?? null,
        lastLoginAt: d.lastLoginAt?.toMillis?.() ?? null,
      };
    });

    return NextResponse.json({ data: users });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}

// POST /api/admin/users — create a new lender account
export async function POST(request: NextRequest): Promise<Response> {
  const ip = getClientIp(request);
  let uid = 'unknown';

  try {
    const allowed = await checkRateLimit(defaultLimiter, ip);
    if (!allowed) {
      return errorResponse(new AppError('RATE_LIMITED', 429, 'Too many requests.'));
    }

    const auth = await withAuth(request, ['admin']);
    uid = auth.uid;

    const body = await request.json();
    const { email, password, firstName, lastName } = adminCreateLenderSchema.parse(body);

    // Check if user already exists in Firebase Auth

    try {
      const existing = await adminAuth.getUserByEmail(email);
      return errorResponse(new AppError('CONFLICT', 409, `User with email ${existing.email} already exists`));
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string };
      if (firebaseErr?.code !== 'auth/user-not-found') throw err;
    }

    // Create Firebase Auth user
    const newUser = await adminAuth.createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
      emailVerified: false,
    });
    const newUid = newUser.uid;

    // Set lender role claim — force ID token refresh on next login
    await adminAuth.setCustomUserClaims(newUid, { role: 'lender' });

    // Create Firestore user document
    const now = FieldValue.serverTimestamp();
    await adminDb.collection('users').doc(newUid).set({
      uid: newUid,
      email: email.toLowerCase().trim(),
      firstName,
      lastName,
      role: 'lender',
      status: 'active',
      profileComplete: false,
      kycStatus: 'not_started',
      phoneVerified: false,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });

    await auditLog({
      userId: auth.uid,
      action: 'admin_create_lender',
      targetId: newUid,
      targetType: 'users',
      outcome: 'success',
      changes: { email, firstName, lastName },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    return NextResponse.json({ data: { uid: newUid } }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);

    await auditLog({
      userId: uid,
      action: 'admin_create_lender',
      targetType: 'users',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
    });
    return internalError();
  }
}
