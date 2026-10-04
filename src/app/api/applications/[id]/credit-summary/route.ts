import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { withAuth } from '@/lib/auth/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { saveCreditSummary } from '@/lib/loan/credit-summary';
import { checkRateLimit, defaultLimiter } from '@/lib/rate-limit/limiter';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { creditSummarySchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PUT /api/applications/[id]/credit-summary
 * The assigned lender enters (or corrects) the credit summary read off the
 * borrower's Centrix report. Manual data entry; stored encrypted on the
 * customer profile and reused across the customer's applications.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['lender']);
    const { id } = await params;

    if (!(await checkRateLimit(defaultLimiter, `credit-summary:${auth.uid}`))) {
      throw new AppError('RATE_LIMITED', 429, 'Too many requests — please slow down');
    }

    const figures = creditSummarySchema.parse(await request.json());

    const appSnap = await adminDb.collection('loanApplications').doc(id).get();
    if (!appSnap.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');
    const appData = appSnap.data()!;

    if (appData.assignedLenderId !== auth.uid) {
      await auditLog({
        userId: auth.uid,
        action: 'credit_summary_updated',
        targetId: id,
        targetType: 'application',
        outcome: 'failure',
        errorDetail: 'not_assigned_lender',
        ipAddress: ip,
      });
      throw new AppError('FORBIDDEN', 403, 'Only the assigned lender can update the credit summary');
    }

    const customerId = appData.applicantId as string | undefined;
    if (!customerId) throw new AppError('BAD_REQUEST', 400, 'Application has no associated customer');

    const lenderSnap = await adminDb.collection('users').doc(auth.uid).get();
    const ld = lenderSnap.data();
    const lenderName =
      (ld ? `${ld.firstName ?? ''} ${ld.lastName ?? ''}`.trim() : '') || auth.email || 'Lender';

    await saveCreditSummary({ customerId, applicationId: id, figures, lenderId: auth.uid, lenderName });

    // IDs only — the credit figures themselves never go into the audit log.
    await auditLog({
      userId: auth.uid,
      action: 'credit_summary_updated',
      targetId: customerId,
      targetType: 'customer_profile',
      outcome: 'success',
      ipAddress: ip,
      changes: { applicationId: id },
    });

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);
    console.error('[applications/credit-summary] update failed');
    return internalError();
  }
}
