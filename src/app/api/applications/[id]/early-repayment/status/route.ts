import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { checkRateLimit, defaultLimiter } from '@/lib/rate-limit/limiter';
import { getClientIp } from '@/lib/utils/audit';
import { reconcileEarlyRepayment } from '@/lib/qippay/reconcile-early-repayment';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/applications/[id]/early-repayment/status
 * Returns the current Qippay PayBy early-payoff state, refreshing against the
 * upstream provider when the cached state is non-terminal and stale. On a
 * `paid` result the loan has been settled in full. Authorised for the owning
 * applicant or the assigned lender.
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

    const app = appSnap.data()!;
    const isApplicant = app.applicantId === auth.uid;
    const isAssignedLender = app.assignedLenderId && app.assignedLenderId === auth.uid;
    if (!isApplicant && !isAssignedLender) {
      throw new AppError('FORBIDDEN', 403, 'You do not have access to this application');
    }

    const result = await reconcileEarlyRepayment({
      applicationId: id,
      caller: isApplicant ? 'applicant' : 'lender',
      callerUid: auth.uid,
      ipAddress: ip,
    });

    return NextResponse.json({
      data: {
        status: result.status,
        providerStatus: result.providerStatus,
        paidAt: result.paidAt,
        failureReason: result.failureReason,
        hostedUrl: result.hostedUrl,
        paymentId: result.paymentId,
        totalPayoffCents: result.totalPayoffCents,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error('[early-repayment/status] unexpected error', err);
    return internalError();
  }
}
