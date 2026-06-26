import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog } from '@/lib/utils/audit';
import { scheduleInstallments, nzToday } from '@/lib/qippay/schedule-installments';
import type { LoanApplication, ScheduledPayment } from '@/types/application';

export const dynamic = 'force-dynamic';

const MAX_APPLICATIONS = 200;

/** True when an application has at least one future-dated instalment still pending. */
function needsScheduling(app: LoanApplication, today: string): boolean {
  if (app.paymentConsent?.status !== 'active') return false;
  const payments = (app.scheduledPayments as ScheduledPayment[] | undefined) ?? [];
  // No array yet but a schedule exists → first-time scheduling is due.
  if (payments.length === 0) {
    return (app.paymentConsent?.scheduleSummary?.installments?.length ?? 0) > 0;
  }
  return payments.some((p) => p.status === 'pending' && p.dueDate > today);
}

/**
 * GET /api/cron/schedule-payments
 *
 * Daily backfill: lodges any instalments whose SetPay rolling period has now
 * opened. Because SetPay only accepts an instalment once its period is active,
 * we can't schedule a whole loan up-front — this job catches up over time.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. We require
 * CRON_SECRET to be set and to match (fail-closed).
 */
export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      throw new AppError('NOT_CONFIGURED', 503, 'Cron is not configured');
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${secret}`) {
      throw new AppError('UNAUTHORIZED', 401, 'Invalid cron credentials');
    }

    const today = nzToday();

    // Disbursed/active loans are the only ones with instalments to lodge.
    const snap = await adminDb
      .collection('loanApplications')
      .where('status', 'in', ['disbursed', 'active'])
      .limit(MAX_APPLICATIONS)
      .get();

    const candidates = snap.docs.filter((d) =>
      needsScheduling(d.data() as LoanApplication, today),
    );

    let processed = 0;
    let totalScheduledNow = 0;
    let totalStillPending = 0;

    for (const doc of candidates) {
      try {
        const before = (doc.data().scheduledPayments as ScheduledPayment[] | undefined) ?? [];
        const lodgedBefore = before.filter((p) => p.status === 'scheduled' || p.status === 'success' || p.status === 'retrying').length;

        const result = await scheduleInstallments({
          applicationId: doc.id,
          actor: 'system:cron',
        });
        processed++;
        totalScheduledNow += Math.max(0, result.scheduledCount - lodgedBefore);
        totalStillPending += result.pendingCount;
      } catch (err) {
        console.error('[cron/schedule-payments] failed for application', doc.id, err);
      }
    }

    await auditLog({
      userId: 'system:cron',
      action: 'cron_schedule_payments_run',
      targetType: 'application',
      outcome: 'success',
      changes: {
        candidates: candidates.length,
        processed,
        newlyScheduled: totalScheduledNow,
        stillPending: totalStillPending,
      },
    });

    return NextResponse.json({
      ok: true,
      candidates: candidates.length,
      processed,
      newlyScheduled: totalScheduledNow,
      stillPending: totalStillPending,
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error('[cron/schedule-payments] unexpected error', err);
    return internalError();
  }
}
