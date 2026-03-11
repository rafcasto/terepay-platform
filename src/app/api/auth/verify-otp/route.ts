import { type NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { verifyOtpSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { getClientIp } from '@/lib/utils/audit';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 5;
const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

function emailHash(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 40);
}

export async function POST(request: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ip = getClientIp(request);

  try {
    const body = await request.json();
    const { email, code } = verifyOtpSchema.parse(body);

    const docId = emailHash(email);
    const otpRef = adminDb.collection('pendingOtps').doc(docId);
    const otpDoc = await otpRef.get();

    if (!otpDoc.exists) {
      return errorResponse(
        new AppError('OTP_NOT_FOUND', 400, 'No verification code found. Please request a new one.'),
      );
    }

    const data = otpDoc.data()!;

    // Check expiry
    if (data.expiresAt < Date.now()) {
      await otpRef.delete();
      return errorResponse(
        new AppError('OTP_EXPIRED', 400, 'Your code has expired. Please request a new one.'),
      );
    }

    // Check attempt limit
    if ((data.attempts ?? 0) >= MAX_ATTEMPTS) {
      await otpRef.delete();
      return errorResponse(
        new AppError('RATE_LIMITED', 429, 'Too many incorrect attempts. Please request a new code.'),
      );
    }

    // Validate code
    if (data.code !== code) {
      const newAttempts = (data.attempts ?? 0) + 1;
      await otpRef.update({ attempts: newAttempts });
      const remaining = MAX_ATTEMPTS - newAttempts;
      return errorResponse(
        new AppError(
          'OTP_INVALID',
          400,
          remaining > 0
            ? `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
            : 'Too many incorrect attempts. Please request a new code.',
          { attemptsRemaining: remaining },
        ),
      );
    }

    // OTP correct — delete it and issue a short-lived verification token
    await otpRef.delete();

    const verificationToken = randomUUID();
    await adminDb.collection('verifiedTokens').doc(verificationToken).set({
      email: email.toLowerCase().trim(),
      expiresAt: Date.now() + TOKEN_TTL_MS,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ verificationToken }, { status: 200 });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request'));
    }
    if (err instanceof AppError) return errorResponse(err);
    console.error('[verify-otp]', err);
    return internalError();
  }
}
