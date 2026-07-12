import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { checkRateLimit, defaultLimiter } from '@/lib/rate-limit/limiter';
import { getClientIp } from '@/lib/utils/audit';
import { reconcilePaymentStatus } from '@/lib/qippay/reconcile-payments';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/applications/[id]/payment-status
 *
 * Polls Qippay for the latest payment state using the detailed consent
 * status endpoint (GET /v1/enduring_initiation/{epcId}/status), which
 * performs a real-time check with the bank and returns count_complete.
 *
 * Reconciliation runs through the shared reconcilePaymentStatus() helper —
 * the same one the daily cron sweep uses. Advances scheduled/retrying
 * instalments to 'success' and cancels payments/consent on revocation.
 *
 * Accessible to the owning applicant and the assigned lender.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);

  try {
    const auth = await withAuth(request, ['applicant', 'lender']);

    const allowed = await checkRateLimit(defaultLimiter, auth.uid);
    if (!allowed) throw new AppError('RATE_LIMITED', 429, 'Too many requests');

    const { id } = await params;
    const appSnap = await adminDb.collection('loanApplications').doc(id).get();

    if (!appSnap.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');

    const appData = appSnap.data()!;
    const isApplicant = appData.applicantId === auth.uid;
    const isAssignedLender = appData.assignedLenderId && appData.assignedLenderId === auth.uid;

    if (!isApplicant && !isAssignedLender) {
      throw new AppError('FORBIDDEN', 403, 'You do not have access to this application');
    }

    const result = await reconcilePaymentStatus({
      applicationId: id,
      callerUid: auth.uid,
      ipAddress: ip,
    });

    return NextResponse.json({
      data: {
        scheduledPayments: result.scheduledPayments,
        consentStatus: result.consentStatus,
        consentOverallStatus: result.consentOverallStatus,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error('[payment-status] unexpected error', err);
    return internalError();
  }
}
