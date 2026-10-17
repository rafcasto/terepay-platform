import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { checkRateLimit, defaultLimiter } from '@/lib/rate-limit/limiter';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { assessArrearsForApplication } from '@/lib/loan/assess-arrears';
import { isArrearsAutoEnabled } from '@/lib/loan/arrears-feature';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/applications/[id]/arrears/assess
 *
 * Assigned lender runs the arrears engine on one loan right now: charges any
 * late payment / default fees that are due, accrues post-default interest and
 * sends the due reminder emails. The engine is idempotent, so running it twice
 * never double-charges.
 *
 * This is the only way arrears are assessed while the `arrears_auto_enabled`
 * flag is off; with it on, this simply brings the loan up to date ahead of the
 * next sweep.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  let applicationId = '';

  try {
    const auth = await withAuth(request, ['lender']);

    const allowed = await checkRateLimit(defaultLimiter, auth.uid);
    if (!allowed) throw new AppError('RATE_LIMITED', 429, 'Too many requests');

    const { id } = await params;
    applicationId = id;

    const snap = await adminDb.collection('loanApplications').doc(id).get();
    if (!snap.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');
    const data = snap.data()!;

    if (data.assignedLenderId && data.assignedLenderId !== auth.uid) {
      throw new AppError('FORBIDDEN', 403, 'Only the assigned lender can assess arrears on this loan');
    }
    if (data.status !== 'disbursed' && data.status !== 'active') {
      throw new AppError(
        'BAD_REQUEST',
        400,
        `Arrears can only be assessed on a live loan (status: ${data.status})`,
      );
    }

    const result = await assessArrearsForApplication({ applicationId: id, actor: auth.uid, ip });
    const autoEnabled = await isArrearsAutoEnabled();

    await auditLog({
      userId: auth.uid,
      action: 'arrears_assessment_requested',
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
      changes: {
        ran: result.ran,
        ...(result.skippedReason ? { skippedReason: result.skippedReason } : {}),
        newFeeCount: result.newFeeCount,
        remindersSent: result.remindersSent,
        isInArrears: result.isInArrears,
        autoEnabled,
      },
    });

    return NextResponse.json({
      data: {
        ran: result.ran,
        skippedReason: result.skippedReason ?? null,
        newFeeCount: result.newFeeCount,
        remindersSent: result.remindersSent,
        isInArrears: result.isInArrears,
        autoEnabled,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);

    await auditLog({
      userId: 'unknown',
      action: 'arrears_assessment_requested',
      targetId: applicationId,
      targetType: 'application',
      outcome: 'failure',
      ipAddress: ip,
    });
    return internalError();
  }
}
