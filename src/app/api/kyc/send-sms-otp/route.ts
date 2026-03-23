import { type NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { withAuth } from '@/lib/auth/middleware';
import { kycSmsLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { sendSmsOtpSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { getClientIp } from '@/lib/utils/audit';
import { disableSmsOtp } from '@/lib/flags/flags';
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
 * POST /api/kyc/send-sms-otp
 * Sends an SMS verification code to the user's NZ phone number via Twilio Verify.
 * Requires an active session (authenticated applicant).
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // Rate limit by IP to prevent SMS flooding
  const allowed = await checkRateLimit(kycSmsLimiter, ip);
  if (!allowed) {
    return errorResponse(new AppError('RATE_LIMITED', 429, 'Too many SMS requests. Please wait a few minutes and try again.'));
  }

  try {
    await withAuth(request, ['applicant']);

    const body = await request.json();
    const { phone } = sendSmsOtpSchema.parse(body);

    // Normalise to NZ E.164 format (+64)
    const normalised = normaliseNzPhone(phone);

    // If the disable-sms-otp flag is on, skip Twilio entirely
    const smsDisabled = await disableSmsOtp();
    console.log('[send-sms-otp] disableSmsOtp flag value:', smsDisabled);
    if (smsDisabled) {
      return NextResponse.json({ success: true, bypassMode: true, phone: normalised });
    }

    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    if (!serviceSid) {
      throw new AppError('CONFIG_ERROR', 500, 'Twilio Verify Service SID is not configured');
    }

    const client = getTwilioClient();
    await client.verify.v2.services(serviceSid).verifications.create({
      to: normalised,
      channel: 'sms',
    });

    return NextResponse.json({ success: true, phone: normalised });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid phone number', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);

    // Twilio errors expose a .code and .status
    const twilioErr = err as { code?: number; status?: number; message?: string };
    if (twilioErr.status && twilioErr.message) {
      return errorResponse(new AppError('SMS_ERROR', 400, twilioErr.message));
    }

    return internalError();
  }
}

/**
 * Convert a NZ local phone number to E.164 format.
 * Strips spaces, dashes, parentheses; prepends +64.
 * e.g. "021 123 4567" → "+6421123456​7"
 *      "0211234567"  → "+6421123456​7"
 */
function normaliseNzPhone(phone: string): string {
  const digits = phone.replace(/[\s\-()]/g, '');
  // Already has country code
  if (digits.startsWith('+64')) return digits;
  if (digits.startsWith('64')) return `+${digits}`;
  // Strip leading 0
  const local = digits.startsWith('0') ? digits.slice(1) : digits;
  return `+64${local}`;
}
