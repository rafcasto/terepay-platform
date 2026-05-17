import { type NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { checkRateLimit, paymentLimiter } from '@/lib/rate-limit/limiter';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import {
  createMandate,
  getBeneficiaryId,
  getReturnBaseUrl,
  listProviders,
} from '@/lib/qippay/setpay-client';
import type { PaymentConsent, PaymentConsentAttempt } from '@/types/application';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const REINITIABLE: ReadonlySet<PaymentConsent['status']> = new Set([
  'failed',
  'expired',
  'cancelled',
]);

/**
 * POST /api/applications/[id]/consent/initiate
 * Applicant kicks off the Qippay SetPay mandate that gates disbursement.
 * - Only allowed when status === 'awaiting_payment_consent'.
 * - Idempotent: if a non-terminal mandate already exists, returns its hostedUrl
 *   instead of creating a duplicate.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent') ?? '';

  try {
    const auth = await withAuth(request, ['applicant']);

    const allowed = await checkRateLimit(paymentLimiter, auth.uid);
    if (!allowed) {
      throw new AppError('RATE_LIMITED', 429, 'Too many requests');
    }

    const { id } = await params;
    const appRef = adminDb.collection('loanApplications').doc(id);

    const beneficiaryId = getBeneficiaryId();
    const returnBaseUrl = getReturnBaseUrl();
    const successUrl = `${returnBaseUrl}/applicant/applications/${id}/consent/return?outcome=success`;
    const failureUrl = `${returnBaseUrl}/applicant/applications/${id}/consent/return?outcome=failure`;

    const result = await adminDb.runTransaction(async (tx) => {
      const appSnap = await tx.get(appRef);
      if (!appSnap.exists) {
        throw new AppError('NOT_FOUND', 404, 'Application not found');
      }
      const app = appSnap.data()!;

      if (app.applicantId !== auth.uid) {
        throw new AppError('FORBIDDEN', 403, 'You do not have access to this application');
      }

      if (app.status !== 'awaiting_payment_consent') {
        throw new AppError(
          'BAD_REQUEST',
          400,
          `Cannot start payment consent from status: ${app.status}`,
        );
      }

      const phoneHint: string | undefined = app.personalInfo?.phone;
      const existing = app.paymentConsent as PaymentConsent | undefined;

      // Already-active mandate: nothing to do, return what we have.
      if (existing?.status === 'active') {
        return {
          mandateId: existing.mandateId,
          alreadyActive: true as const,
          phoneHint,
          totalAmountCents: existing.scheduleSummary?.totalAmountCents,
          installments: existing.scheduleSummary?.installments ?? [],
        };
      }

      // In-flight (non-terminal) mandate: reuse rather than create a duplicate
      // SetPay consent. Caller will collect bank + phone and call /consent/approve.
      if (
        existing &&
        existing.status !== 'not_started' &&
        !REINITIABLE.has(existing.status)
      ) {
        return {
          mandateId: existing.mandateId,
          alreadyActive: false as const,
          reused: true as const,
          phoneHint,
          totalAmountCents: existing.scheduleSummary?.totalAmountCents,
          installments: existing.scheduleSummary?.installments ?? [],
        };
      }

      // Build the schedule from already-computed loan details where present.
      const approvedAmount: number | undefined = app.loanDetails?.approvedAmount;
      const applicationFee: number = app.loanDetails?.applicationFee ?? 0;
      const fortnightlyPayment: number | undefined =
        app.loanDetails?.fortnightlyPayment;
      const totalRepayment: number | undefined = app.loanDetails?.totalRepayment;

      if (typeof approvedAmount !== 'number') {
        throw new AppError(
          'BAD_REQUEST',
          400,
          'Application is missing an approved amount',
        );
      }

      // TerePay product is 4 × fortnightly. Derive installment amounts when
      // we don't have a stored schedule yet.
      const installmentCount = 4;
      const perInstallmentNzd =
        typeof fortnightlyPayment === 'number'
          ? fortnightlyPayment
          : ((approvedAmount + approvedAmount * 0.047) / installmentCount);
      const perInstallmentCents = Math.round(perInstallmentNzd * 100);

      const today = new Date();
      const installments = Array.from({ length: installmentCount }, (_, i) => {
        const due = new Date(today);
        due.setDate(today.getDate() + 14 * (i + 1));
        return {
          dueDate: due.toISOString().slice(0, 10),
          amountCents: perInstallmentCents,
        };
      });
      const totalAmountCents =
        typeof totalRepayment === 'number'
          ? Math.round(totalRepayment * 100)
          : installments.reduce((acc, i) => acc + i.amountCents, 0);

      // SetPay consent window covers the full repayment schedule with a
      // small safety buffer past the last installment in case of retries.
      const fromDateTime = today.toISOString();
      const lastDue = new Date(today);
      lastDue.setDate(today.getDate() + 14 * installmentCount + 7);
      const toDateTime = lastDue.toISOString();

      const mandate = await createMandate({
        beneficiaryId,
        successUrl,
        failureUrl,
        customerIp: ip,
        customerUserAgent: userAgent,
        merchantCustomerIdentification: auth.uid,
        metadata: { applicationId: id },
        frequencyPeriod: 'Fortnightly',
        frequencyTotalAmountCents: perInstallmentCents,
        totalAmountCents,
        totalCount: installmentCount,
        fromDateTime,
        toDateTime,
        installments,
      });

      const now = FieldValue.serverTimestamp();
      const attempts: PaymentConsentAttempt[] = existing?.attempts ?? [];
      if (existing && REINITIABLE.has(existing.status)) {
        attempts.push({
          mandateId: existing.mandateId,
          initiatedAt: existing.initiatedAt,
          finalStatus: existing.status,
          failureReason: existing.failureReason,
        });
      }

      const nextConsent: Record<string, unknown> = {
        provider: 'qippay_setpay',
        status: 'initiated',
        mandateId: mandate.id,
        hostedUrl: mandate.hostedUrl,
        beneficiaryId,
        scheduleSummary: {
          currency: 'NZD',
          totalAmountCents,
          installments,
        },
        initiatedAt: now,
        initiatedBy: auth.uid,
        attempts,
      };
      if (mandate.expiresAt) {
        nextConsent.expiresAt = Timestamp.fromDate(new Date(mandate.expiresAt));
      }

      tx.update(appRef, {
        paymentConsent: nextConsent,
        'timeline.updatedAt': now,
        // Application fee was implicitly $0; preserve the explicit number so
        // downstream disburse math doesn't surprise the lender.
        'loanDetails.applicationFee': applicationFee,
      });

      return {
        mandateId: mandate.id,
        alreadyActive: false as const,
        reused: false as const,
        phoneHint,
        totalAmountCents,
        installments,
      };
    });

    if (!result.alreadyActive) {
      await auditLog({
        userId: auth.uid,
        action: 'payment_consent_initiated',
        targetId: id,
        targetType: 'application',
        outcome: 'success',
        ipAddress: ip,
        changes: {
          mandateId: result.mandateId,
          reused: 'reused' in result ? result.reused : false,
          scheduleTotalCents: result.totalAmountCents,
        },
      });
    }

    // Fetch available banks for the applicant's bank-picker UI. Cheap & idempotent
    // so we just call it here rather than introducing a separate endpoint.
    const providers = await listProviders().catch(() => []);

    return NextResponse.json({
      data: {
        mandateId: result.mandateId,
        providers,
        phoneHint: result.phoneHint,
        scheduleSummary: {
          currency: 'NZD' as const,
          totalAmountCents: result.totalAmountCents,
          installments: result.installments,
        },
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      await auditLog({
        userId: 'unknown',
        action: 'payment_consent_initiation_failed',
        targetType: 'application',
        outcome: 'failure',
        errorDetail: err.message,
        changes: { code: err.code, statusCode: err.statusCode },
        ipAddress: ip,
      });
      return errorResponse(err);
    }
    console.error('[consent/initiate] unexpected error', err);
    return internalError();
  }
}
