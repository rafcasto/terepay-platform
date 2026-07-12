import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { withAuth } from '@/lib/auth/middleware';
import { adminPaymentRefreshSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import {
  getPaymentRefreshSettings,
  setPaymentRefreshSettings,
} from '@/lib/admin/payment-refresh-settings';

export const dynamic = 'force-dynamic';

function serialise(settings: Awaited<ReturnType<typeof getPaymentRefreshSettings>>) {
  const toMillis = (v: unknown) =>
    v && typeof (v as { toMillis?: () => number }).toMillis === 'function'
      ? (v as { toMillis: () => number }).toMillis()
      : null;
  return {
    enabled: settings.enabled,
    refreshHourNzt: settings.refreshHourNzt,
    lastRunDateNzt: settings.lastRunDateNzt ?? null,
    lastRunAt: toMillis(settings.lastRunAt),
    lastRunCount: settings.lastRunCount ?? null,
    updatedAt: toMillis(settings.updatedAt),
    updatedBy: settings.updatedBy ?? null,
  };
}

// GET /api/admin/payment-refresh — read the daily sweep schedule
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const auth = await withAuth(request, ['admin']);
    await checkRateLimit(defaultLimiter, auth.uid);

    const settings = await getPaymentRefreshSettings();
    return NextResponse.json({ data: serialise(settings) });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}

// PATCH /api/admin/payment-refresh — update the daily sweep schedule (admin only)
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
    const patch = adminPaymentRefreshSchema.parse(body);

    if (patch.enabled === undefined && patch.refreshHourNzt === undefined) {
      throw new AppError('VALIDATION_ERROR', 422, 'No valid fields provided');
    }

    await setPaymentRefreshSettings(patch, uid);

    await auditLog({
      userId: uid,
      action: 'admin_update_payment_refresh',
      targetId: 'paymentRefresh',
      targetType: 'systemConfig',
      outcome: 'success',
      changes: patch,
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    const settings = await getPaymentRefreshSettings();
    return NextResponse.json({ data: serialise(settings) });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(
        new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors),
      );
    }
    if (err instanceof AppError) return errorResponse(err);

    await auditLog({
      userId: uid,
      action: 'admin_update_payment_refresh',
      targetType: 'systemConfig',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
    });
    return internalError();
  }
}
