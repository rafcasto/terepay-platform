import { createHash } from 'crypto';
import { type NextRequest, NextResponse } from 'next/server';
import type { UserRecord } from 'firebase-admin/auth';
import { ZodError } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { forgotPasswordSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { authPasswordResetLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { verifyRecaptcha } from '@/lib/recaptcha/verify';
import { renderEmail } from '@/lib/email/templates';
import { sendEmail } from '@/lib/email/resend';

export const dynamic = 'force-dynamic';

const AUDIT_ACTION = 'password_reset_requested';
/** Where the branded action page sends the user once the password is changed. */
const CONTINUE_PATH = '/auth/login';

/** Per-account rate-limit key — hashed so no email address lands in Redis. */
function emailKey(email: string): string {
  return createHash('sha256').update(email).digest('hex').slice(0, 32);
}

/**
 * POST /api/auth/forgot-password
 *
 * Unauthenticated by design — the caller has lost access to their account.
 * Sends a TerePay-branded password reset email via Resend. Like the
 * verification email, this bypasses Firebase's generic hosted page:
 *   1. Generates the reset action code server-side (`generatePasswordResetLink`).
 *   2. Re-hosts it on our branded handler (`/auth/action?mode=resetPassword`).
 *   3. Renders the admin-editable `password_reset` template (branded default fallback).
 *
 * Anti-enumeration: the response is the same `{ ok: true }` whether or not an
 * account exists for the address. Never reveal account existence here.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent') ?? '';
  let uid = 'unknown';

  try {
    // 1. Rate limit per IP (pre-parse)
    const ipAllowed = await checkRateLimit(authPasswordResetLimiter, `ip:${ip}`);
    if (!ipAllowed) {
      return errorResponse(
        new AppError('RATE_LIMITED', 429, 'Too many reset requests. Please wait a few minutes and try again.'),
      );
    }

    // 2. Validate body
    const body = await request.json();
    const { email, recaptchaToken } = forgotPasswordSchema.parse(body);

    // 3. Rate limit per target account, so one address can't be flooded from many IPs
    const emailAllowed = await checkRateLimit(authPasswordResetLimiter, `email:${emailKey(email)}`);
    if (!emailAllowed) {
      return errorResponse(
        new AppError('RATE_LIMITED', 429, 'Too many reset requests. Please wait a few minutes and try again.'),
      );
    }

    // 4. reCAPTCHA (unauthenticated mutation surface)
    if (recaptchaToken) {
      const captchaOk = await verifyRecaptcha(recaptchaToken, 'forgot_password');
      if (!captchaOk) {
        return errorResponse(new AppError('RECAPTCHA_FAILED', 400, 'reCAPTCHA verification failed. Please try again.'));
      }
    }

    // 5. Look up the account. Unknown addresses fall through to the same success response.
    let userRecord: UserRecord | null = null;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
    } catch (err) {
      if ((err as { code?: string }).code !== 'auth/user-not-found') throw err;
    }

    if (!userRecord || userRecord.disabled) {
      await auditLog({
        userId: 'unknown',
        action: AUDIT_ACTION,
        targetType: 'auth',
        outcome: 'success',
        changes: { accountFound: false },
        ipAddress: ip,
        userAgent,
      });
      return NextResponse.json({ ok: true });
    }
    uid = userRecord.uid;

    // First name for personalisation (best-effort).
    let firstName = '';
    try {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      firstName = (userDoc.data()?.firstName as string | undefined)?.trim() ?? '';
    } catch {
      /* non-critical */
    }

    const baseUrl = (process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || request.nextUrl.origin).replace(/\/$/, '');

    // 6. Generate the Firebase action code, then re-host it on our own handler.
    const firebaseLink = await adminAuth.generatePasswordResetLink(email, {
      url: `${baseUrl}${CONTINUE_PATH}`,
      handleCodeInApp: false,
    });

    const oobCode = new URL(firebaseLink).searchParams.get('oobCode');
    if (!oobCode) {
      throw new AppError('LINK_GENERATION_FAILED', 500, 'Could not generate a password reset link.');
    }

    const resetUrl =
      `${baseUrl}/auth/action?mode=resetPassword` +
      `&oobCode=${encodeURIComponent(oobCode)}` +
      `&continueUrl=${encodeURIComponent(CONTINUE_PATH)}`;

    const rendered = await renderEmail('password_reset', {
      firstName: firstName || 'there',
      resetUrl,
    });
    if (!rendered) {
      throw new AppError('TEMPLATE_MISSING', 500, 'Password reset email template is unavailable.');
    }

    // 7. Send via Resend
    const result = await sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    await auditLog({
      userId: uid,
      action: AUDIT_ACTION,
      targetId: uid,
      targetType: 'auth',
      outcome: 'success',
      changes: { accountFound: true, delivered: result.sent, skipped: result.skipped ?? false },
      ipAddress: ip,
      userAgent,
    });

    // In development (no email provider configured), surface the link so the
    // flow is testable against the Firebase emulator without sending mail.
    if (result.skipped && process.env.NEXT_PUBLIC_ENVIRONMENT === 'development') {
      console.log('[dev] Password reset link:', resetUrl);
      return NextResponse.json({ ok: true, devResetUrl: resetUrl });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);

    await auditLog({
      userId: uid,
      action: AUDIT_ACTION,
      targetType: 'auth',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
      userAgent,
    });
    return internalError();
  }
}
