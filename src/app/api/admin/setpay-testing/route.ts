import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { withAuth } from '@/lib/auth/middleware';
import { adminSetPayTestSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import {
  getSetPayTestSettings,
  setSetPayTestSettings,
} from '@/lib/admin/setpay-test-settings';
import { getMode } from '@/lib/qippay/setpay-client';

export const dynamic = 'force-dynamic';

function serialise(settings: Awaited<ReturnType<typeof getSetPayTestSettings>>) {
  const toMillis = (v: unknown) =>
    v && typeof (v as { toMillis?: () => number }).toMillis === 'function'
      ? (v as { toMillis: () => number }).toMillis()
      : null;
  let qippayMode: 'live' | 'stub' | 'unknown' = 'unknown';
  try {
    qippayMode = getMode();
  } catch {
    // Misconfigured — leave as unknown; the page only uses it for a hint.
  }
  return {
    enabled: settings.enabled,
    intervalMinutes: settings.intervalMinutes,
    lockedInProduction: settings.lockedInProduction,
    qippayMode,
    lastVerifyAt: toMillis(settings.lastVerifyAt),
    lastVerifyCount: settings.lastVerifyCount ?? null,
    updatedAt: toMillis(settings.updatedAt),
    updatedBy: settings.updatedBy ?? null,
  };
}

// GET /api/admin/setpay-testing — read the SetPay test cadence config
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const auth = await withAuth(request, ['admin']);
    await checkRateLimit(defaultLimiter, auth.uid);

    const settings = await getSetPayTestSettings();
    return NextResponse.json({ data: serialise(settings) });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}

// PATCH /api/admin/setpay-testing — update the SetPay test cadence (admin only, never in production)
export async function PATCH(request: NextRequest): Promise<Response> {
  const ip = getClientIp(request);
  let uid = 'unknown';

  try {
    const allowed = await checkRateLimit(defaultLimiter, ip);
    if (!allowed) {
      return errorResponse(new AppError('RATE_LIMITED', 429, 'Too many requests.'));
    }

    const auth = await withAuth(request, ['admin']);
    uid = auth.uid;

    const body = await request.json();
    const patch = adminSetPayTestSchema.parse(body);

    if (patch.enabled === undefined && patch.intervalMinutes === undefined) {
      throw new AppError('VALIDATION_ERROR', 422, 'No valid fields provided');
    }

    await setSetPayTestSettings(patch, uid);

    await auditLog({
      userId: uid,
      action: 'admin_update_setpay_testing',
      targetId: 'setpayTesting',
      targetType: 'systemConfig',
      outcome: 'success',
      changes: patch,
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    const settings = await getSetPayTestSettings();
    return NextResponse.json({ data: serialise(settings) });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(
        new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors),
      );
    }
    if (err instanceof AppError) {
      await auditLog({
        userId: uid,
        action: 'admin_update_setpay_testing',
        targetId: 'setpayTesting',
        targetType: 'systemConfig',
        outcome: 'failure',
        errorDetail: err.code,
        ipAddress: ip,
      });
      return errorResponse(err);
    }

    await auditLog({
      userId: uid,
      action: 'admin_update_setpay_testing',
      targetType: 'systemConfig',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
    });
    return internalError();
  }
}
