import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { reconcilePaymentStatus } from '@/lib/qippay/reconcile-payments';
import {
  getPaymentRefreshSettings,
  markPaymentRefreshRun,
  nzNow,
} from '@/lib/admin/payment-refresh-settings';

export const dynamic = 'force-dynamic';
// Daily sweep can touch many applications; give it headroom.
export const maxDuration = 300;

const CRON_ACTOR = 'system:payment_refresh_cron';
const MAX_APPLICATIONS = 500;

/**
 * GET /api/cron/payment-refresh
 *
 * Vercel Cron invokes this hourly (see vercel.json). It runs the payment
 * reconciliation sweep only when the current Pacific/Auckland hour matches the
 * admin-configured `refreshHourNzt` (default midnight) and it has not already
 * run for the current NZT date. This makes the schedule admin-editable at
 * runtime without redeploying, and is DST-safe.
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

    const settings = await getPaymentRefreshSettings();
    const { hour, dateNzt } = nzNow();
    // Dev-only escape hatch to trigger the sweep regardless of the hour/dedupe gates.
    const force =
      process.env.NEXT_PUBLIC_ENVIRONMENT === 'development' &&
      request.nextUrl.searchParams.get('force') === '1';

    // --- Gating: enabled, right hour, not already run today ---
    if (!settings.enabled && !force) {
      return NextResponse.json({ data: { ran: false, reason: 'disabled', hour, dateNzt } });
    }
    if (hour !== settings.refreshHourNzt && !force) {
      return NextResponse.json({
        data: { ran: false, reason: 'not_scheduled_hour', hour, scheduledHour: settings.refreshHourNzt, dateNzt },
      });
    }
    if (settings.lastRunDateNzt === dateNzt && !force) {
      return NextResponse.json({ data: { ran: false, reason: 'already_ran_today', dateNzt } });
    }

    // --- Sweep every active-consent application ---
    const snap = await adminDb
      .collection('loanApplications')
      .where('paymentConsent.status', '==', 'active')
      .limit(MAX_APPLICATIONS)
      .get();

    let processed = 0;
    let changed = 0;
    let errored = 0;

    for (const doc of snap.docs) {
      try {
        const result = await reconcilePaymentStatus({
          applicationId: doc.id,
          callerUid: CRON_ACTOR,
          ipAddress: ip,
          auditAction: 'setpay_payment_status_cron_refresh',
        });
        processed += 1;
        if (result.changed) changed += 1;
      } catch (err) {
        errored += 1;
        console.error('[cron/payment-refresh] failed to reconcile', doc.id, err);
      }
    }

    await markPaymentRefreshRun(dateNzt, processed);

    await auditLog({
      userId: CRON_ACTOR,
      action: 'payment_refresh_cron_completed',
      targetId: 'paymentRefresh',
      targetType: 'systemConfig',
      outcome: errored > 0 ? 'failure' : 'success',
      ipAddress: ip,
      changes: { dateNzt, hour, total: snap.size, processed, changed, errored },
    });

    return NextResponse.json({
      data: { ran: true, dateNzt, hour, total: snap.size, processed, changed, errored },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error('[cron/payment-refresh] unexpected error', err);
    return internalError();
  }
}
