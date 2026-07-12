import { type NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z, ZodError } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { checkRateLimit, paymentLimiter } from '@/lib/rate-limit/limiter';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { initiatePayment } from '@/lib/qippay/payby-client';
import { getBeneficiaryId, getReturnBaseUrl, listProviders } from '@/lib/qippay/setpay-client';
import { computeEarlyPayoff } from '@/lib/loan/early-payoff';
import { isLiveLoanStatus } from '@/lib/loan/active-loan';
import { EARLY_REPAYMENT_DISCLAIMER_VERSION } from '@/lib/constants/fees';
import type { EarlyRepayment, LoanApplication } from '@/types/application';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  // The borrower must explicitly accept the advance-payment terms disclaimer.
  disclaimerAccepted: z.literal(true),
});

// Non-terminal states whose Hosted payment can still be resumed rather than
// creating a duplicate PayBy payment.
const RESUMABLE: ReadonlySet<EarlyRepayment['status']> = new Set(['initiated', 'pending']);

/**
 * POST /api/applications/[id]/early-repayment/initiate
 * Borrower starts a voluntary early-payoff of a live loan via Qippay PayBy.
 * - Only allowed on a disbursed/active loan the caller owns.
 * - Requires explicit disclaimer acceptance.
 * - Recomputes the payoff (outstanding balance + prepayment fee) server-side —
 *   the client-supplied amount is never trusted.
 * - Idempotent: resumes an in-flight PayBy payment instead of duplicating it.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent') ?? '';

  try {
    const auth = await withAuth(request, ['applicant']);

    const allowed = await checkRateLimit(paymentLimiter, auth.uid);
    if (!allowed) throw new AppError('RATE_LIMITED', 429, 'Too many requests');

    const json = await request.json().catch(() => ({}));
    bodySchema.parse(json);

    const { id } = await params;
    const appRef = adminDb.collection('loanApplications').doc(id);

    const beneficiaryId = getBeneficiaryId();
    const returnBaseUrl = getReturnBaseUrl();
    const successUrl = `${returnBaseUrl}/applicant/applications/${id}/early-repayment/return?outcome=success`;
    const failureUrl = `${returnBaseUrl}/applicant/applications/${id}/early-repayment/return?outcome=failure`;

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(appRef);
      if (!snap.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');
      const app = snap.data() as LoanApplication;

      if (app.applicantId !== auth.uid) {
        throw new AppError('FORBIDDEN', 403, 'You do not have access to this application');
      }
      if (!isLiveLoanStatus(app.status)) {
        throw new AppError('BAD_REQUEST', 400, 'This loan is not open for early repayment');
      }

      const existing = app.earlyRepayment;
      if (existing?.status === 'paid') {
        throw new AppError('BAD_REQUEST', 400, 'This loan has already been repaid');
      }
      // Resume an in-flight payment rather than creating a duplicate.
      if (existing && RESUMABLE.has(existing.status) && existing.hostedUrl) {
        return {
          reused: true as const,
          paymentId: existing.paymentId,
          hostedUrl: existing.hostedUrl,
          quote: existing.quote,
          phoneHint: app.personalInfo?.phone,
        };
      }

      const payoff = computeEarlyPayoff(app);
      if (!payoff) {
        throw new AppError('BAD_REQUEST', 400, 'There is no outstanding balance to repay');
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .replace(/\.\d{3}Z$/, '.000Z');

      const payment = await initiatePayment({
        beneficiaryId,
        amountCents: payoff.totalPayoffCents,
        successUrl,
        failureUrl,
        customerIp: ip,
        customerUserAgent: userAgent,
        merchantCustomerIdentification: auth.uid,
        statementReference: app.referenceNumber ?? id.slice(0, 12),
        statementParticulars: 'TerePay',
        statementCode: 'PAYOFF',
        expiresAt,
        metadata: { applicationId: id, type: 'early_repayment' },
      });

      const now = FieldValue.serverTimestamp();
      const earlyRepayment: Record<string, unknown> = {
        provider: 'qippay_payby',
        status: 'initiated',
        paymentId: payment.id,
        hostedUrl: payment.hostedUrl,
        beneficiaryId,
        quote: {
          currency: 'NZD',
          outstandingBalanceCents: payoff.outstandingBalanceCents,
          unearnedInterestRebateCents: payoff.unearnedInterestRebateCents,
          netOutstandingCents: payoff.netOutstandingCents,
          prepaymentFeeCents: payoff.prepaymentFeeCents,
          totalPayoffCents: payoff.totalPayoffCents,
          installmentsCleared: payoff.installmentsCleared,
          rebateBreakdown: payoff.breakdown,
        },
        disclaimerAcceptedAt: now,
        disclaimerVersion: EARLY_REPAYMENT_DISCLAIMER_VERSION,
        initiatedAt: now,
        initiatedBy: auth.uid,
      };
      if (payment.expiresAt) {
        earlyRepayment.expiresAt = Timestamp.fromDate(new Date(payment.expiresAt));
      }

      tx.update(appRef, { earlyRepayment, 'timeline.updatedAt': now });

      return {
        reused: false as const,
        paymentId: payment.id,
        hostedUrl: payment.hostedUrl,
        quote: earlyRepayment.quote as EarlyRepayment['quote'],
        phoneHint: app.personalInfo?.phone,
      };
    });

    if (!result.reused) {
      await auditLog({
        userId: auth.uid,
        action: 'early_repayment_initiated',
        targetId: id,
        targetType: 'application',
        outcome: 'success',
        ipAddress: ip,
        changes: {
          paymentId: result.paymentId,
          totalPayoffCents: result.quote.totalPayoffCents,
          outstandingBalanceCents: result.quote.outstandingBalanceCents,
          unearnedInterestRebateCents: result.quote.unearnedInterestRebateCents,
          prepaymentFeeCents: result.quote.prepaymentFeeCents,
          disclaimerVersion: EARLY_REPAYMENT_DISCLAIMER_VERSION,
        },
      });
    }

    // PayBy's documented flow is Hosted (redirect to the payment's `url`).
    // The embedded in-app bank picker is only offered when explicitly enabled
    // AND the PayBy Embedded approve endpoint has been confirmed — otherwise we
    // ship no providers and the client hands off to the Hosted page.
    const paybyEmbedded = process.env.QIPPAY_PAYBY_EMBEDDED === 'true';
    const providers = paybyEmbedded ? await listProviders().catch(() => []) : [];

    return NextResponse.json({
      data: {
        paymentId: result.paymentId,
        hostedUrl: result.hostedUrl,
        quote: result.quote,
        embedded: paybyEmbedded,
        providers,
        phoneHint: result.phoneHint,
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(
        new AppError('BAD_REQUEST', 400, 'You must accept the advance-payment terms to continue'),
      );
    }
    if (err instanceof AppError) {
      await auditLog({
        userId: 'unknown',
        action: 'early_repayment_initiation_failed',
        targetType: 'application',
        outcome: 'failure',
        errorDetail: err.message,
        changes: { code: err.code, statusCode: err.statusCode },
        ipAddress: ip,
      });
      return errorResponse(err);
    }
    console.error('[early-repayment/initiate] unexpected error', err);
    return internalError();
  }
}
