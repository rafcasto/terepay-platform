import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { runPaymentRefreshSweep } from '@/lib/qippay/refresh-sweep';
import { markSetPayTestVerifyRun } from '@/lib/admin/setpay-test-settings';

export const dynamic = 'force-dynamic';
// Same headroom as the cron — the sweep may touch many applications.
export const maxDuration = 300;

/**
 * POST /api/admin/setpay-testing/verify
 *
 * On-demand verification: reconciles every active-consent loan against Qippay
 * right now (the same sweep the payment-refresh cron runs once a day) and
 * returns a per-application summary. Lets an admin confirm test-cadence
 * instalments were collected minutes after disbursement instead of waiting
 * for the daily sweep. No request body.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const ip = getClientIp(request);
  let uid = 'unknown';

  try {
    const allowed = await checkRateLimit(defaultLimiter, ip);
    if (!allowed) {
      return errorResponse(new AppError('RATE_LIMITED', 429, 'Too many requests.'));
    }

    const auth = await withAuth(request, ['admin']);
    uid = auth.uid;

    const sweep = await runPaymentRefreshSweep({
      actor: uid,
      ip,
      auditAction: 'setpay_payment_status_admin_verify',
    });

    await markSetPayTestVerifyRun(sweep.processed);

    await auditLog({
      userId: uid,
      action: 'admin_setpay_test_verify',
      targetId: 'setpayTesting',
      targetType: 'systemConfig',
      outcome: sweep.errored > 0 ? 'failure' : 'success',
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
      changes: {
        total: sweep.total,
        processed: sweep.processed,
        changed: sweep.changed,
        errored: sweep.errored,
        feesAssessed: sweep.feesAssessed,
        remindersSent: sweep.remindersSent,
        inArrears: sweep.inArrears,
      },
    });

    return NextResponse.json({
      data: {
        ranAt: Date.now(),
        total: sweep.total,
        processed: sweep.processed,
        changed: sweep.changed,
        errored: sweep.errored,
        feesAssessed: sweep.feesAssessed,
        remindersSent: sweep.remindersSent,
        inArrears: sweep.inArrears,
        applications: sweep.applications,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);

    await auditLog({
      userId: uid,
      action: 'admin_setpay_test_verify',
      targetType: 'systemConfig',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
    });
    return internalError();
  }
}
