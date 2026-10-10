import { type NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { authVerifyEmailLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { renderEmail } from '@/lib/email/templates';
import { sendEmail } from '@/lib/email/resend';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/send-verification-email
 *
 * Sends a TerePay-branded email verification message to the authenticated
 * applicant. Unlike Firebase's built-in `sendEmailVerification`, this:
 *   1. Generates the verification action code server-side.
 *   2. Embeds a link to our own branded handler (`/auth/action`) instead of the
 *      generic Firebase-hosted action page.
 *   3. Renders an admin-editable template (with branded default fallback).
 */
export async function POST(request: NextRequest): Promise<Response> {
  const ip = getClientIp(request);
  let uid = 'unknown';

  try {
    const auth = await withAuth(request, ['applicant']);
    uid = auth.uid;

    const allowed = await checkRateLimit(authVerifyEmailLimiter, uid);
    if (!allowed) {
      return errorResponse(
        new AppError('RATE_LIMITED', 429, 'Too many verification emails requested. Please wait a few minutes and try again.'),
      );
    }

    // Authoritative email + verification status straight from Firebase Auth
    // (the session token's email can be stale right after an email change).
    const userRecord = await adminAuth.getUser(uid);
    const email = userRecord.email;
    if (!email) {
      throw new AppError('NO_EMAIL', 400, 'No email address is associated with this account.');
    }
    if (userRecord.emailVerified) {
      return NextResponse.json({ alreadyVerified: true });
    }

    // First name for personalisation (best-effort).
    let firstName = '';
    try {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      firstName = (userDoc.data()?.firstName as string | undefined)?.trim() ?? '';
    } catch {
      /* non-critical */
    }

    const baseUrl = (process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || request.nextUrl.origin).replace(/\/$/, '');

    // Generate the Firebase action code, then re-host it on our own handler.
    const continuePath = '/applicant/onboarding/verify-email';
    const firebaseLink = await adminAuth.generateEmailVerificationLink(email, {
      url: `${baseUrl}${continuePath}`,
      handleCodeInApp: false,
    });

    const oobCode = new URL(firebaseLink).searchParams.get('oobCode');
    if (!oobCode) {
      throw new AppError('LINK_GENERATION_FAILED', 500, 'Could not generate a verification link.');
    }

    const verificationUrl =
      `${baseUrl}/auth/action?mode=verifyEmail` +
      `&oobCode=${encodeURIComponent(oobCode)}` +
      `&continueUrl=${encodeURIComponent(continuePath)}`;

    const rendered = await renderEmail('email_verification', {
      firstName: firstName || 'there',
      verificationUrl,
    });
    if (!rendered) {
      throw new AppError('TEMPLATE_MISSING', 500, 'Verification email template is unavailable.');
    }

    const result = await sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    await auditLog({
      userId: uid,
      action: 'verification_email_sent',
      targetType: 'auth',
      outcome: 'success',
      changes: { delivered: result.sent, skipped: result.skipped ?? false },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    // In development (no email provider configured), surface the link so the
    // flow is testable against the Firebase emulator without sending mail.
    if (result.skipped && process.env.NEXT_PUBLIC_ENVIRONMENT === 'development') {
      console.log('[dev] Email verification link:', verificationUrl);
      return NextResponse.json({ sent: false, devVerificationUrl: verificationUrl });
    }

    return NextResponse.json({ sent: true });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);

    await auditLog({
      userId: uid,
      action: 'verification_email_sent',
      targetType: 'auth',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
    });
    return internalError();
  }
}
