import { type NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

const isEmulator = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);

export const dynamic = 'force-dynamic';
import { sessionSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { ZodError } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyRecaptcha } from '@/lib/recaptcha/verify';

// 5 days — matches Firebase's maximum session cookie duration
const SESSION_EXPIRY_MS = 60 * 60 * 24 * 5 * 1000;

export async function POST(request: NextRequest) {
  let uid = 'unknown';
  try {
    const body = await request.json();
    const { idToken, recaptchaToken } = sessionSchema.parse(body);

    if (recaptchaToken) {
      const captchaOk = await verifyRecaptcha(recaptchaToken, 'login');
      if (!captchaOk) {
        return errorResponse(new AppError('RECAPTCHA_FAILED', 400, 'reCAPTCHA verification failed. Please try again.'));
      }
    }

    // Verify the ID token before creating a session cookie
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;

    // createSessionCookie is not supported by the Firebase Auth emulator; store
    // the raw ID token instead (1-hour expiry is fine for local dev).
    const sessionCookie = isEmulator
      ? idToken
      : await adminAuth.createSessionCookie(idToken, { expiresIn: SESSION_EXPIRY_MS });

    // Update last login timestamp; also sync emailVerified if the token confirms it
    const updatePayload: Record<string, unknown> = { lastLoginAt: FieldValue.serverTimestamp() };
    if (decoded.email_verified) updatePayload.emailVerified = true;

    await adminDb
      .collection('users')
      .doc(uid)
      .update(updatePayload)
      .catch(() => {/* non-critical */});

    const response = NextResponse.json({ status: 'ok' });
    response.cookies.set('__session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_EXPIRY_MS / 1000,
      path: '/',
    });

    await auditLog({
      userId: uid,
      action: 'session_created',
      targetType: 'auth',
      outcome: 'success',
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent') ?? '',
    });

    return response;
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(
        new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors),
      );
    }
    if (err instanceof AppError) return errorResponse(err);

    await auditLog({
      userId: uid,
      action: 'session_created',
      targetType: 'auth',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: getClientIp(request),
    });

    return internalError();
  }
}
