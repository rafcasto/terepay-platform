import { type NextRequest, NextResponse } from 'next/server';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { runPaymentRefreshSweep } from '@/lib/qippay/refresh-sweep';
import {
  getPaymentRefreshSettings,
  markPaymentRefreshRun,
  nzNow,
} from '@/lib/admin/payment-refresh-settings';
import { getSetPayTestSettings } from '@/lib/admin/setpay-test-settings';

export const dynamic = 'force-dynamic';
// Daily sweep can touch many applications; give it headroom.
export const maxDuration = 300;

const CRON_ACTOR = 'system:payment_refresh_cron';

/**
 * GET /api/cron/payment-refresh
 *
 * Vercel Cron invokes this hourly (see vercel.json). It runs the payment
 * reconciliation sweep only when the current Pacific/Auckland hour matches the
 * admin-configured `refreshHourNzt` (default midnight) and it has not already
 * run for the current NZT date. This makes the schedule admin-editable at
 * runtime without redeploying, and is DST-safe.
 *
 * While the admin SetPay test cadence is on (never in production) the hour and
 * once-a-day gates are bypassed so every hourly tick verifies test instalments.
 *
 * Each active loan is (1) reconciled against Qippay, then (2) run through the
 * arrears engine — see runPaymentRefreshSweep().
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. We require
 * CRON_SECRET to be set and to match (fail-closed).
 */
export async function GET(request: NextRequest): Promise<Response> {
  const ip = getClientIp(request);

  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      throw new AppError('NOT_CONFIGURED', 503, 'Cron is not configured');
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${secret}`) {
      throw new AppError('UNAUTHORIZED', 401, 'Invalid cron credentials');
    }

    const [settings, testSettings] = await Promise.all([
      getPaymentRefreshSettings(),
      getSetPayTestSettings(),
    ]);
    const { hour, dateNzt } = nzNow();
    // Dev-only escape hatch to trigger the sweep regardless of the hour/dedupe gates.
    const force =
      process.env.NEXT_PUBLIC_ENVIRONMENT === 'development' &&
      request.nextUrl.searchParams.get('force') === '1';
    // Test cadence is locked off in production, so this never bypasses gates there.
    const bypassGates = force || testSettings.enabled;

    // --- Gating: enabled, right hour, not already run today ---
    if (!settings.enabled && !bypassGates) {
      return NextResponse.json({ data: { ran: false, reason: 'disabled', hour, dateNzt } });
    }
    if (hour !== settings.refreshHourNzt && !bypassGates) {
      return NextResponse.json({
        data: { ran: false, reason: 'not_scheduled_hour', hour, scheduledHour: settings.refreshHourNzt, dateNzt },
      });
    }
    if (settings.lastRunDateNzt === dateNzt && !bypassGates) {
      return NextResponse.json({ data: { ran: false, reason: 'already_ran_today', dateNzt } });
    }

    const sweep = await runPaymentRefreshSweep({
      actor: CRON_ACTOR,
      ip,
      auditAction: 'setpay_payment_status_cron_refresh',
    });

    await markPaymentRefreshRun(dateNzt, sweep.processed);

    const summary = {
      dateNzt,
      hour,
      testCadence: testSettings.enabled,
      total: sweep.total,
      processed: sweep.processed,
      changed: sweep.changed,
      errored: sweep.errored,
      feesAssessed: sweep.feesAssessed,
      remindersSent: sweep.remindersSent,
      inArrears: sweep.inArrears,
    };

    await auditLog({
      userId: CRON_ACTOR,
      action: 'payment_refresh_cron_completed',
      targetId: 'paymentRefresh',
      targetType: 'systemConfig',
      outcome: sweep.errored > 0 ? 'failure' : 'success',
      ipAddress: ip,
      changes: summary,
    });

    return NextResponse.json({ data: { ran: true, ...summary } });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error('[cron/payment-refresh] unexpected error', err);
    return internalError();
  }
}
