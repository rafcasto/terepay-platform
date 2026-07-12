import { type NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { checkRateLimit, paymentLimiter } from '@/lib/rate-limit/limiter';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { approvePayment } from '@/lib/qippay/payby-client';
import { normaliseNzPhoneForQippay, getReturnBaseUrl } from '@/lib/qippay/setpay-client';
import { isLiveLoanStatus } from '@/lib/loan/active-loan';
import type { EarlyRepayment, LoanApplication } from '@/types/application';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const ApproveBody = z.object({
  providerId: z.string().min(1).max(32),
  phone: z.string().min(4).max(32),
  method: z.enum(['redirect', 'phone', 'login_hint_token', 'username']).optional(),
});

/**
 * POST /api/applications/[id]/early-repayment/approve
 * Embedded PayBy flow: the borrower has picked their bank + confirmed their
 * phone in our UI. Approves the previously-initiated PayBy payment directly
 * with Qippay (no Hosted proxy page). Returns { method, redirectUri? } so the
 * client either redirects the borrower straight to their bank (redirect) or
 * shows a "check your bank app" waiting state (CIBA push) and polls status.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);

  try {
    const auth = await withAuth(request, ['applicant']);

    const allowed = await checkRateLimit(paymentLimiter, auth.uid);
    if (!allowed) throw new AppError('RATE_LIMITED', 429, 'Too many requests');

    const { id } = await params;
    const raw = await request.json().catch(() => ({}));
    const body = ApproveBody.parse(raw);

    const appRef = adminDb.collection('loanApplications').doc(id);
    const snap = await appRef.get();
    if (!snap.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');

    const app = snap.data() as LoanApplication;
    if (app.applicantId !== auth.uid) {
      throw new AppError('FORBIDDEN', 403, 'You do not have access to this application');
    }
    if (!isLiveLoanStatus(app.status)) {
      throw new AppError('BAD_REQUEST', 400, 'This loan is not open for early repayment');
    }

    const er = app.earlyRepayment as EarlyRepayment | undefined;
    if (!er || !er.paymentId) {
      throw new AppError('BAD_REQUEST', 400, 'No early repayment has been started yet');
    }
    if (er.status === 'paid') {
      return NextResponse.json({
        data: { method: 'redirect', redirectUri: undefined, alreadyPaid: true },
      });
    }

    const phoneForQippay = normaliseNzPhoneForQippay(body.phone);

    const approval = await approvePayment({
      paymentId: er.paymentId,
      providerId: body.providerId,
      phone: phoneForQippay,
      ...(body.method ? { method: body.method } : {}),
    });

    // In stub mode there is no real redirect_uri — loop back to our return page
    // with stub=success so the existing reconciler recognises a round-trip.
    let effectiveRedirect = approval.redirectUri;
    if (!effectiveRedirect && approval.method === 'redirect') {
      const base = getReturnBaseUrl();
      effectiveRedirect = `${base}/applicant/applications/${id}/early-repayment/return?outcome=success&stub=success`;
    }

    await appRef.update({
      'earlyRepayment.status': 'pending',
      'earlyRepayment.approvalMethod': approval.method,
      'earlyRepayment.providerId': body.providerId,
      'earlyRepayment.lastStatusFromProvider': `approved:${approval.method}`,
      'timeline.updatedAt': FieldValue.serverTimestamp(),
    });

    await auditLog({
      userId: auth.uid,
      action: 'early_repayment_approve_initiated',
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
      changes: {
        paymentId: er.paymentId,
        providerId: body.providerId,
        method: approval.method,
      },
    });

    return NextResponse.json({
      data: {
        method: approval.method,
        redirectUri: effectiveRedirect,
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(
        new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors),
      );
    }
    if (err instanceof AppError) {
      await auditLog({
        userId: 'unknown',
        action: 'early_repayment_approve_failed',
        targetType: 'application',
        outcome: 'failure',
        errorDetail: err.message,
        changes: { code: err.code },
        ipAddress: ip,
      });
      return errorResponse(err);
    }
    console.error('[early-repayment/approve] unexpected error', err);
    return internalError();
  }
}
