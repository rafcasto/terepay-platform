import { type NextRequest, NextResponse } from 'next/server';
import { randomInt, createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { sendOtpSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { checkRateLimit, authSignupLimiter } from '@/lib/rate-limit/limiter';
import { getClientIp } from '@/lib/utils/audit';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

/** Stable, non-reversible Firestore doc ID from an email address */
function emailHash(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 40);
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // IP-level rate limit — reuse signup limiter (3 / 5 min)
  const allowed = await checkRateLimit(authSignupLimiter, `otp:${ip}`);
  if (!allowed) {
    return errorResponse(new AppError('RATE_LIMITED', 429, 'Too many requests. Please try again later.'));
  }

  try {
    const body = await request.json();
    const { email } = sendOtpSchema.parse(body);

    const docId = emailHash(email);
    const docRef = adminDb.collection('pendingOtps').doc(docId);

    // Per-email cooldown — prevent rapid resends (60 s window)
    const existing = await docRef.get();
    if (existing.exists) {
      const data = existing.data()!;
      const createdAt: number = data.createdAt?.toMillis?.() ?? 0;
      if (Date.now() - createdAt < 60_000) {
        return errorResponse(
          new AppError('RATE_LIMITED', 429, 'Please wait before requesting another code.'),
        );
      }
    }

    // Generate 6-digit OTP
    const code = String(randomInt(100000, 999999));
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    await docRef.set({
      email: email.toLowerCase().trim(),
      code,
      expiresAt,
      attempts: 0,
      createdAt: FieldValue.serverTimestamp(),
    });

    // -----------------------------------------------------------------------
    // EMAIL DELIVERY
    // Replace this section with a real transactional email service before
    // going to production (see docs/ONBOARDING_UX_REQUIREMENTS.md §8).
    // -----------------------------------------------------------------------
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[send-otp] DEV — OTP for ${email}: ${code}`);
    }
    // Example (Resend):
    // import { Resend } from 'resend';
    // await new Resend(process.env.RESEND_API_KEY).emails.send({
    //   from: 'TerePay <noreply@terepay.com>',
    //   to: email,
    //   subject: 'Your TerePay verification code',
    //   html: `<p>Your code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
    // });
    // -----------------------------------------------------------------------

    const isDev = process.env.NODE_ENV !== 'production';
    return NextResponse.json(
      { success: true, ...(isDev ? { code } : {}) },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid email address'));
    }
    if (err instanceof AppError) return errorResponse(err);
    console.error('[send-otp]', err);
    return internalError();
  }
}
