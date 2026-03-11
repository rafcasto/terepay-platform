import { type NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
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

    // Check if email is already registered — return 409 so the UI can show
    // an inline error on the email field before sending the Firebase link.
    try {
      await adminAuth.getUserByEmail(email);
      return errorResponse(
        new AppError('CONFLICT', 409, 'An account with this email already exists. Please sign in instead.'),
      );
    } catch (authCheckErr: unknown) {
      const errCode =
        (authCheckErr as { code?: string }).code ??
        (authCheckErr as { errorInfo?: { code?: string } }).errorInfo?.code ??
        '';
      if (errCode !== 'auth/user-not-found') {
        // Unexpected error — log and allow the request to continue.
        // Firebase enforces uniqueness during signInWithEmailLink on the client.
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
