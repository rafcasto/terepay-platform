import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { disburseSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { FieldValue } from 'firebase-admin/firestore';
import { ZodError } from 'zod';
import {
  schedulePayment,
  getBeneficiaryId,
} from '@/lib/qippay/setpay-client';
import type { PaymentConsent, ScheduledPayment } from '@/types/application';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/applications/[id]/disburse
 * Lender (assigned) marks an accepted loan as disbursed. Computes the disbursed
 * amount as approvedAmount − applicationFee using values already on the
 * application. Idempotent: re-running on an already-disbursed application
 * returns the existing values.
 *
 * After a successful disbursement, all fortnightly instalments are submitted
 * to Qippay (POST /v1/setpay) with their future due dates. Each instalment
 * is tracked in `scheduledPayments`. If Qippay scheduling fails for any
 * instalment, that instalment is stored as `status: 'pending'` so it can be
 * retried — the disbursement itself is not rolled back.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  let applicationId = '';

  try {
    const auth = await withAuth(request, ['lender']);
    const { id } = await params;
    applicationId = id;

    const rawBody = await request.json().catch(() => ({}));
    const parsed = disburseSchema.parse(rawBody);

    const appRef = adminDb.collection('loanApplications').doc(id);

    const result = await adminDb.runTransaction(async (tx) => {
      const appDoc = await tx.get(appRef);
      if (!appDoc.exists) {
        throw new AppError('NOT_FOUND', 404, 'Application not found');
      }

      const appData = appDoc.data()!;

      if (appData.status === 'disbursed') {
        return {
          status: 'disbursed' as const,
          disbursedAmount: appData.loanDetails?.disbursedAmount ?? 0,
          alreadyDisbursed: true,
          paymentConsent: null as PaymentConsent | null,
          applicationShortId: id.slice(0, 12),
        };
      }

      // Accept either the new `awaiting_payment_consent` state (post Qippay
      // integration) or the legacy `loan_accepted` state (applications
      // accepted before the consent gate existed).
      if (
        appData.status !== 'awaiting_payment_consent' &&
        appData.status !== 'loan_accepted'
      ) {
        throw new AppError(
          'BAD_REQUEST',
          400,
          `Cannot disburse application with status: ${appData.status}`,
        );
      }

      // Consent gate: new flow requires an active Qippay SetPay mandate
      // before disbursement. Legacy `loan_accepted` applications (created
      // before this feature) are exempt — their `paymentConsent` will be
      // absent, not stale.
      if (
        appData.status === 'awaiting_payment_consent' &&
        appData.paymentConsent?.status !== 'active'
      ) {
        throw new AppError(
          'CONSENT_REQUIRED',
          409,
          'Cannot disburse: applicant has not completed their bank authorization (Qippay SetPay mandate)',
        );
      }

      if (appData.assignedLenderId && appData.assignedLenderId !== auth.uid) {
        throw new AppError(
          'FORBIDDEN',
          403,
          'Only the assigned lender can disburse this loan',
        );
      }

      const approvedAmount: number | undefined = appData.loanDetails?.approvedAmount;
      const applicationFee: number = appData.loanDetails?.applicationFee ?? 0;

      if (typeof approvedAmount !== 'number') {
        throw new AppError(
          'BAD_REQUEST',
          400,
          'Application is missing an approved amount',
        );
      }

      const defaultDisbursedAmount = approvedAmount - applicationFee;
      const overrideAmount = parsed.disbursedAmount;
      const isOverride = typeof overrideAmount === 'number';

      if (isOverride && overrideAmount > approvedAmount) {
        throw new AppError(
          'BAD_REQUEST',
          400,
          `Disbursed amount (${overrideAmount}) cannot exceed approved amount (${approvedAmount})`,
        );
      }

      const disbursedAmount = isOverride ? overrideAmount : defaultDisbursedAmount;
      const disbursementDate = new Date().toISOString().slice(0, 10);
      const now = FieldValue.serverTimestamp();

      tx.update(appRef, {
        status: 'disbursed',
        'loanDetails.disbursedAmount': disbursedAmount,
        'loanDetails.disbursementDate': disbursementDate,
        'decision.disbursementDetails': {
          amount: disbursedAmount,
          date: disbursementDate,
          reference: '',
        },
        'timeline.disbursedAt': now,
        'timeline.updatedAt': now,
      });

      const consent = appData.paymentConsent as PaymentConsent | undefined;

      return {
        status: 'disbursed' as const,
        disbursedAmount,
        alreadyDisbursed: false,
        applicationFee,
        isOverride,
        paymentConsent: consent ?? null,
        applicationShortId: id.slice(0, 12),
      };
    });

    if (!result.alreadyDisbursed) {
      await auditLog({
        userId: auth.uid,
        action: 'loan_disbursed',
        targetId: id,
        targetType: 'application',
        outcome: 'success',
        changes: {
          disbursedAmount: result.disbursedAmount,
          applicationFee: result.applicationFee,
          override: result.isOverride,
          consentMandateId: result.paymentConsent?.mandateId,
        },
        ipAddress: ip,
      });

      // ── Auto-schedule instalments with Qippay ──────────────────────────────
      // For applications that went through the new Qippay consent flow, submit
      // each instalment to POST /v1/setpay immediately after disbursement.
      // Instalments with a due date in the past are skipped (they can't be
      // scheduled). If Qippay is unreachable, the instalment is recorded as
      // `pending` so an operator can retry.
      const consent = result.paymentConsent;
      const installments = consent?.scheduleSummary?.installments ?? [];

      if (consent?.mandateId && installments.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let beneficiaryId = '';
        try {
          beneficiaryId = getBeneficiaryId();
        } catch {
          // Not configured — skip scheduling, store all as pending
        }

        const scheduledPayments: ScheduledPayment[] = await Promise.all(
          installments.map(async (inst, i): Promise<ScheduledPayment> => {
            const installmentNumber = i + 1;
            const dueDate = new Date(inst.dueDate);

            // Skip past-due dates
            if (dueDate <= today) {
              return {
                installmentNumber,
                dueDate: inst.dueDate,
                amountCents: inst.amountCents,
                status: 'pending',
                retryCount: 0,
              };
            }

            if (!beneficiaryId) {
              return {
                installmentNumber,
                dueDate: inst.dueDate,
                amountCents: inst.amountCents,
                status: 'pending',
                retryCount: 0,
              };
            }

            try {
              const scheduled = await schedulePayment({
                epcId: consent.mandateId,
                beneficiaryId,
                amountCents: inst.amountCents,
                scheduledFor: `${inst.dueDate}T00:00:00.000Z`,
                statementParticulars: 'TerePay',
                statementCode: `Inst${installmentNumber}`,
                statementReference: result.applicationShortId,
              });

              return {
                installmentNumber,
                dueDate: inst.dueDate,
                amountCents: inst.amountCents,
                qippayPaymentId: scheduled.paymentId,
                status: 'scheduled',
                retryCount: 0,
              };
            } catch (err) {
              console.error(
                `[disburse] Failed to schedule instalment ${installmentNumber} with Qippay`,
                err,
              );
              return {
                installmentNumber,
                dueDate: inst.dueDate,
                amountCents: inst.amountCents,
                status: 'pending',
                retryCount: 0,
              };
            }
          }),
        );

        await adminDb
          .collection('loanApplications')
          .doc(id)
          .update({
            scheduledPayments,
            'timeline.updatedAt': FieldValue.serverTimestamp(),
          });

        const scheduledCount = scheduledPayments.filter((p) => p.status === 'scheduled').length;
        const pendingCount = scheduledPayments.filter((p) => p.status === 'pending').length;

        await auditLog({
          userId: auth.uid,
          action: 'setpay_payments_scheduled',
          targetId: id,
          targetType: 'application',
          outcome: 'success',
          changes: {
            mandateId: consent.mandateId,
            totalInstallments: installments.length,
            scheduledCount,
            pendingCount,
          },
          ipAddress: ip,
        });
      }
    }

    return NextResponse.json({
      status: result.status,
      disbursedAmount: result.disbursedAmount,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(
        new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors),
      );
    }
    if (err instanceof AppError) return errorResponse(err);

    await auditLog({
      userId: 'unknown',
      action: 'loan_disbursed',
      targetId: applicationId,
      targetType: 'application',
      outcome: 'failure',
      ipAddress: ip,
    });
    return internalError();
  }
}
