import { type NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { signupSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { authSignupLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { FieldValue } from 'firebase-admin/firestore';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // Rate limiting
  const allowed = await checkRateLimit(authSignupLimiter, ip);
  if (!allowed) {
    return errorResponse(new AppError('RATE_LIMITED', 429, 'Too many requests. Please try again later.'));
  }

  try {
    const body = await request.json();
    const { email, password, firstName, lastName, phone, verificationToken } = signupSchema.parse(body);

    // Verify the email OTP token produced by POST /api/auth/verify-otp
    if (verificationToken) {
      const tokenDoc = await adminDb.collection('verifiedTokens').doc(verificationToken).get();
      if (
        !tokenDoc.exists ||
        tokenDoc.data()?.email !== email.toLowerCase().trim() ||
        tokenDoc.data()?.expiresAt < Date.now()
      ) {
        throw new AppError('INVALID_VERIFICATION', 400, 'Email verification failed or expired. Please restart the signup process.');
      }
      // Consume the token — single-use
      await tokenDoc.ref.delete();
    }

    // Create the Firebase Auth user
    let userRecord;
    try {
      userRecord = await adminAuth.createUser({ email, password, displayName: `${firstName} ${lastName}` });
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'auth/email-already-exists') {
        throw new AppError('CONFLICT', 409, 'An account with this email already exists');
      }
      throw err;
    }

    // Role is ALWAYS 'applicant' from the public signup endpoint
    await adminAuth.setCustomUserClaims(userRecord.uid, { role: 'applicant' });

    // Create the user document in Firestore
    const now = FieldValue.serverTimestamp();
    await adminDb.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      firstName,
      lastName,
      phone: phone ?? null,
      role: 'applicant',
      profileComplete: false,
      status: 'active',
      phoneVerified: false,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });

    await auditLog({
      userId: userRecord.uid,
      action: 'signup_success',
      targetType: 'auth',
      outcome: 'success',
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    return NextResponse.json({ uid: userRecord.uid }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(
        new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors),
      );
    }
    if (err instanceof AppError) return errorResponse(err);

    await auditLog({
      userId: 'unknown',
      action: 'signup_failed',
      targetType: 'auth',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
    });

    return internalError();
  }
}
