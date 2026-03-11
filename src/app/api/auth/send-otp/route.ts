import { type NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { sendOtpSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { checkRateLimit, authSignupLimiter } from '@/lib/rate-limit/limiter';
import { getClientIp } from '@/lib/utils/audit';
import { ZodError } from 'zod';
import { verifyRecaptcha } from '@/lib/recaptcha/verify';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/send-otp
 *
 * Acts as a pre-flight email-availability check before the client calls
 * sendSignInLinkToEmail(). Returns 409 if the email is already registered so
 * the UI can show an error at step 1 without making the user go through the
 * full email-link flow first.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  const allowed = await checkRateLimit(authSignupLimiter, `otp:${ip}`);
  if (!allowed) {
    return errorResponse(new AppError('RATE_LIMITED', 429, 'Too many requests. Please try again later.'));
  }

  try {
    const body = await request.json();
    const { email, recaptchaToken } = sendOtpSchema.parse(body);

    if (recaptchaToken) {
      const captchaOk = await verifyRecaptcha(recaptchaToken, 'send_otp');
      if (!captchaOk) {
        return errorResponse(new AppError('RECAPTCHA_FAILED', 400, 'reCAPTCHA verification failed. Please try again.'));
      }
    }

    // Check if email is already registered with a *completed* profile.
    // A Firebase Auth user may exist without a Firestore profile when a
    // previous signup was interrupted after signInWithEmailLink() but before
    // step 3 finished. In that case we allow resending the link so the user
    // can recover and complete the flow.
    try {
      const existingUser = await adminAuth.getUserByEmail(email);
      const profileSnap = await adminDb.collection('users').doc(existingUser.uid).get();
      if (profileSnap.exists) {
        // Fully registered account — tell the UI to sign in instead.
        return errorResponse(
          new AppError('CONFLICT', 409, 'An account with this email already exists. Please sign in instead.'),
        );
      }
      // Firebase user exists but no Firestore profile → incomplete signup.
      // Fall through and resend the email link so they can finish registering.
    } catch (authCheckErr: unknown) {
      const errCode =
        (authCheckErr as { code?: string }).code ??
        (authCheckErr as { errorInfo?: { code?: string } }).errorInfo?.code ??
        '';
      if (errCode !== 'auth/user-not-found') {
        console.warn('[check-email] Could not verify email availability:', (authCheckErr as Error).message ?? errCode);
      }
      // auth/user-not-found → email is available
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid email address'));
    }
    if (err instanceof AppError) return errorResponse(err);
    console.error('[check-email]', err);
    return internalError();
  }
}
