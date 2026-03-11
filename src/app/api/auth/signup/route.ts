import { type NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { signupSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { authSignupLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { FieldValue } from 'firebase-admin/firestore';
import { ZodError } from 'zod';
import { verifyRecaptcha } from '@/lib/recaptcha/verify';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // Rate limiting
  const allowed = await checkRateLimit(authSignupLimiter, ip);
  if (!allowed) {
    return errorResponse(new AppError('RATE_LIMITED', 429, 'Too many requests. Please try again later.'));
  }

  try {
    const body = await request.json();
    const { firstName, lastName, phone, idToken, recaptchaToken } = signupSchema.parse(body);

    if (recaptchaToken) {
      const captchaOk = await verifyRecaptcha(recaptchaToken, 'signup');
      if (!captchaOk) {
        return errorResponse(new AppError('RECAPTCHA_FAILED', 400, 'reCAPTCHA verification failed. Please try again.'));
      }
    }

    // Verify the Firebase ID token issued by signInWithEmailLink on the client.
    // This proves the user verified ownership of their email address.
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      throw new AppError('INVALID_TOKEN', 401, 'Invalid or expired auth token. Please restart the sign-up process.');
    }

    const { uid, email } = decodedToken;
    if (!email) {
      throw new AppError('INVALID_TOKEN', 401, 'Token is missing email claim.');
    }

    // Idempotency — skip if profile already exists (handles double-submit)
    const existingProfile = await adminDb.collection('users').doc(uid).get();
    if (existingProfile.exists) {
      return NextResponse.json({ uid }, { status: 200 });
    }

    // Set applicant role as a custom claim
    await adminAuth.setCustomUserClaims(uid, { role: 'applicant' });

    // Create the Firestore user document
    const now = FieldValue.serverTimestamp();
    await adminDb.collection('users').doc(uid).set({
      uid,
      email: email.toLowerCase().trim(),
      firstName,
      lastName,
      phone: phone ?? null,
      role: 'applicant',
      profileComplete: false,
      status: 'active',
      phoneVerified: false,
      emailVerified: true, // Firebase email link sets emailVerified = true
      createdAt: now,
      updatedAt: now,
    });

    await auditLog({
      userId: uid,
      action: 'signup_success',
      targetType: 'auth',
      outcome: 'success',
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    return NextResponse.json({ uid }, { status: 201 });
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
