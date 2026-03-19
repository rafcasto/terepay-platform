import { type NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { withAuth } from '@/lib/auth/middleware';
import { kycSmsLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { verifySmsOtpSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { getClientIp } from '@/lib/utils/audit';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new AppError('CONFIG_ERROR', 500, 'Twilio credentials are not configured');
  }
  return twilio(accountSid, authToken);
}

/**
 * POST /api/kyc/verify-sms-otp
 * Verifies the SMS OTP code via Twilio Verify and marks the user's phone as verified.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  const allowed = await checkRateLimit(kycSmsLimiter, ip);
  if (!allowed) {
    return errorResponse(new AppError('RATE_LIMITED', 429, 'Too many attempts. Please wait and try again.'));
  }

  try {
    const { uid } = await withAuth(request, ['applicant']);

    const body = await request.json();
    const { phone, code } = verifySmsOtpSchema.parse(body);

    // Normalise to E.164 (same logic as send endpoint)
    const normalised = normaliseNzPhone(phone);

    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    if (!serviceSid) {
      throw new AppError('CONFIG_ERROR', 500, 'Twilio Verify Service SID is not configured');
    }

    const client = getTwilioClient();
    const check = await client.verify.v2.services(serviceSid).verificationChecks.create({
      to: normalised,
      code,
    });

    if (check.status !== 'approved') {
      return errorResponse(new AppError('INVALID_CODE', 400, 'The code you entered is incorrect or has expired.'));
    }

    // Mark phone as verified in Firestore
    await adminDb.collection('users').doc(uid).update({
      phoneVerified: true,
      phoneNumber: normalised,
      kycStatus: 'in_progress',
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid input', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);

    const twilioErr = err as { code?: number; status?: number; message?: string };
    if (twilioErr.status && twilioErr.message) {
      return errorResponse(new AppError('SMS_ERROR', 400, twilioErr.message));
    }

    return internalError();
  }
}

function normaliseNzPhone(phone: string): string {
  const digits = phone.replace(/[\s\-()]/g, '');
  if (digits.startsWith('+64')) return digits;
  if (digits.startsWith('64')) return `+${digits}`;
  const local = digits.startsWith('0') ? digits.slice(1) : digits;
  return `+64${local}`;
}
