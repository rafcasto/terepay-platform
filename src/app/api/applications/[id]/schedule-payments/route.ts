import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { checkRateLimit, defaultLimiter } from '@/lib/rate-limit/limiter';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { scheduleInstallments } from '@/lib/qippay/schedule-installments';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/applications/[id]/schedule-payments
 *
 * Lender-triggered retry: attempts to lodge any instalments that are still
 * `pending` with Qippay (e.g. ones whose rolling period has since opened).
 * Idempotent — already-scheduled instalments are untouched. Returns the
 * refreshed instalment array so the UI can update in place.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);

  try {
    const auth = await withAuth(request, ['lender']);

    const allowed = await checkRateLimit(defaultLimiter, auth.uid);
    if (!allowed) throw new AppError('RATE_LIMITED', 429, 'Too many requests');

    const { id } = await params;
    const appRef = adminDb.collection('loanApplications').doc(id);
    const snap = await appRef.get();
    if (!snap.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');

    const data = snap.data()!;
    if (data.assignedLenderId && data.assignedLenderId !== auth.uid) {
      throw new AppError('FORBIDDEN', 403, 'Only the assigned lender can schedule these payments');
    }
    if (data.status !== 'disbursed' && data.status !== 'active') {
      throw new AppError(
        'BAD_REQUEST',
        400,
        `Payments can only be scheduled for a disbursed loan (status: ${data.status})`,
      );
    }

    const result = await scheduleInstallments({ applicationId: id, actor: auth.uid, ip });

    await auditLog({
      userId: auth.uid,
      action: 'setpay_payments_schedule_requested',
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
      changes: {
        attempted: result.attemptedCount,
        scheduledCount: result.scheduledCount,
        pendingCount: result.pendingCount,
        ...(result.skippedReason ? { skippedReason: result.skippedReason } : {}),
      },
    });

    return NextResponse.json({
      data: {
        scheduledPayments: result.payments,
        scheduledCount: result.scheduledCount,
        pendingCount: result.pendingCount,
        attemptedCount: result.attemptedCount,
        ...(result.skippedReason ? { skippedReason: result.skippedReason } : {}),
      },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error('[schedule-payments] unexpected error', err);
    return internalError();
  }
}
