import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { disburseSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { ZodError } from 'zod';
import { getBeneficiaryId, schedulePayment } from '@/lib/qippay/setpay-client';
import type { PaymentConsent, RepaymentInstallment, Loan } from '@/types/application';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/applications/[id]/disburse
 *
 * Lender flips an accepted loan to `disbursed`. In one atomic Firestore
 * write this also (1) creates a `loans/{loanId}` doc that becomes the
 * source of truth for repayment state, and (2) records the four Qippay
 * SetPay `payment.id`s that were scheduled prior to the transaction.
 *
 * Sequencing intentionally splits Qippay scheduling out of the transaction
 * — Firestore transactions can't make external HTTP calls. If any of the
 * four `POST /v1/setpay` calls fails, we surface the error and leave the
 * application untouched (the lender retries). The transaction itself is
 * idempotent: re-running after a successful disburse returns the existing
 * loan id and amount.
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

    // --- Pre-flight (outside transaction) -------------------------------
    // Read the app once to validate before doing the expensive Qippay
    // scheduling. The transaction below re-reads and re-validates so a
    // concurrent change can't slip past.
    const preSnap = await appRef.get();
    if (!preSnap.exists) {
      throw new AppError('NOT_FOUND', 404, 'Application not found');
    }
    const preData = preSnap.data()!;

    // Already disbursed: short-circuit, no-op.
    if (preData.status === 'disbursed') {
      return NextResponse.json({
        status: 'disbursed',
        disbursedAmount: preData.loanDetails?.disbursedAmount ?? 0,
        alreadyDisbursed: true,
      });
    }

    if (
      preData.status !== 'awaiting_payment_consent' &&
      preData.status !== 'loan_accepted'
    ) {
      throw new AppError(
        'BAD_REQUEST',
        400,
        `Cannot disburse application with status: ${preData.status}`,
      );
    }

    const consent = preData.paymentConsent as PaymentConsent | undefined;
    if (
      preData.status === 'awaiting_payment_consent' &&
      consent?.status !== 'active'
    ) {
      throw new AppError(
        'CONSENT_REQUIRED',
        409,
        'Cannot disburse: applicant has not completed their bank authorization (Qippay SetPay mandate)',
      );
    }

    if (preData.assignedLenderId && preData.assignedLenderId !== auth.uid) {
      throw new AppError(
        'FORBIDDEN',
        403,
        'Only the assigned lender can disburse this loan',
      );
    }

    const approvedAmount: number | undefined = preData.loanDetails?.approvedAmount;
    const applicationFee: number = preData.loanDetails?.applicationFee ?? 0;
    if (typeof approvedAmount !== 'number') {
      throw new AppError('BAD_REQUEST', 400, 'Application is missing an approved amount');
    }

    const overrideAmount = parsed.disbursedAmount;
    const isOverride = typeof overrideAmount === 'number';
    if (isOverride && overrideAmount > approvedAmount) {
      throw new AppError(
        'BAD_REQUEST',
        400,
        `Disbursed amount (${overrideAmount}) cannot exceed approved amount (${approvedAmount})`,
      );
    }
    const disbursedAmount = isOverride ? overrideAmount : approvedAmount - applicationFee;
    const disbursementDate = new Date().toISOString().slice(0, 10);

    // --- Schedule the four SetPay instalments (outside transaction) ------
    const installmentsFromConsent = consent?.scheduleSummary?.installments ?? [];
    if (
      preData.status === 'awaiting_payment_consent' &&
      installmentsFromConsent.length === 0
    ) {
      throw new AppError(
        'BAD_REQUEST',
        400,
        'Payment consent has no scheduled instalments — cannot disburse',
      );
    }

    const epcId = consent?.mandateId;
    const referenceNumber =
      (preData.referenceNumber as string | undefined) ?? `TP-${id.slice(0, 8)}`;
    const applicantFirst =
      (preData.personalInfo?.firstName as string | undefined) ?? 'TerePay';

    // Schedule each instalment with Qippay. Only run when we have an active
    // mandate — legacy `loan_accepted` applications without a consent are
    // exempt from this step (the lender historically arranged collection
    // out-of-band). Those legacy loans get a doc but no Qippay schedule.
    const scheduledInstalments: RepaymentInstallment[] = [];
    const totalRepayable = installmentsFromConsent.reduce(
      (sum, i) => sum + i.amountCents,
      0,
    ) / 100;

    if (epcId && consent?.status === 'active') {
      const beneficiaryId = getBeneficiaryId();
      for (let i = 0; i < installmentsFromConsent.length; i++) {
        const ins = installmentsFromConsent[i];
        // Force noon NZST (+12) so the date portion always lands on `ins.dueDate`
        // as the Pacific/Auckland calendar date Qippay validates against (docs
        // rev 1 p.19: "scheduled_for must be a FUTURE calendar date for
        // Pacific/Auckland timezone").
        const scheduledFor = `${ins.dueDate}T12:00:00+12:00`;
        const result = await schedulePayment({
          epcId,
          beneficiaryId,
          amountCents: ins.amountCents,
          scheduledFor,
          statementParticulars: applicantFirst,
          statementCode: `INST${i + 1}`,
          statementReference: referenceNumber,
        });
        scheduledInstalments.push({
          installmentNumber: i + 1,
          dueDate: ins.dueDate,
          amount: ins.amountCents / 100,
          status: 'scheduled',
          paymentId: result.paymentId,
          enduringPaymentId: result.enduringPaymentId,
        });
      }
    } else {
      // Legacy path: no Qippay schedule, but we still want a `loans` doc so
      // the dashboard works. Mark instalments scheduled without paymentIds.
      installmentsFromConsent.forEach((ins, i) => {
        scheduledInstalments.push({
          installmentNumber: i + 1,
          dueDate: ins.dueDate,
          amount: ins.amountCents / 100,
          status: 'scheduled',
        });
      });
    }

    // --- Atomic commit: update app + create loan ------------------------
    const loanRef = adminDb.collection('loans').doc();
    const fortnightlyPayment =
      installmentsFromConsent.length > 0
        ? installmentsFromConsent[0].amountCents / 100
        : 0;
    const firstDueDate =
      scheduledInstalments[0]?.dueDate ?? new Date().toISOString().slice(0, 10);

    const txResult = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(appRef);
      if (!snap.exists) {
        throw new AppError('NOT_FOUND', 404, 'Application not found');
      }
      const data = snap.data()!;

      // Re-validate inside the transaction; another caller may have raced us.
      if (data.status === 'disbursed') {
        return {
          alreadyDisbursed: true,
          loanId: (data.loanId as string) ?? '',
          disbursedAmount: data.loanDetails?.disbursedAmount ?? 0,
        };
      }
      if (data.status !== 'awaiting_payment_consent' && data.status !== 'loan_accepted') {
        throw new AppError(
          'BAD_REQUEST',
          400,
          `Cannot disburse application with status: ${data.status}`,
        );
      }

      const now = FieldValue.serverTimestamp();
      const dueTs = Timestamp.fromDate(new Date(`${firstDueDate}T12:00:00+12:00`));

      const loanDoc: Loan = {
        loanId: loanRef.id,
        applicationId: id,
        applicantId: data.applicantId,
        assignedLenderId: data.assignedLenderId,
        status: 'disbursed',
        principal: disbursedAmount,
        totalRepayable,
        totalPaid: 0,
        remainingBalance: totalRepayable,
        fortnightlyPayment,
        installments: scheduledInstalments,
        mandateId: epcId ?? '',
        beneficiaryId: epcId ? getBeneficiaryId() : '',
        nextPaymentDate: dueTs,
        timeline: {
          // serverTimestamp() resolved by Firestore; cast satisfies the
          // Loan type which is shaped around the read side.
          createdAt: now as unknown as Timestamp,
          updatedAt: now as unknown as Timestamp,
          disbursedAt: now as unknown as Timestamp,
        },
      };

      tx.set(loanRef, loanDoc);

      tx.update(appRef, {
        status: 'disbursed',
        loanId: loanRef.id,
        'loanDetails.disbursedAmount': disbursedAmount,
        'loanDetails.disbursementDate': disbursementDate,
        'decision.disbursementDetails': {
          amount: disbursedAmount,
          date: disbursementDate,
          reference: referenceNumber,
        },
        repaymentSchedule: {
          installments: scheduledInstalments,
          totalRepayment: totalRepayable,
        },
        'timeline.disbursedAt': now,
        'timeline.updatedAt': now,
      });

      return {
        alreadyDisbursed: false,
        loanId: loanRef.id,
        disbursedAmount,
      };
    });

    if (!txResult.alreadyDisbursed) {
      await auditLog({
        userId: auth.uid,
        action: 'loan_disbursed',
        targetId: id,
        targetType: 'application',
        outcome: 'success',
        changes: {
          loanId: txResult.loanId,
          disbursedAmount: txResult.disbursedAmount,
          applicationFee,
          override: isOverride,
          consentMandateId: epcId,
          scheduledPaymentIds: scheduledInstalments
            .map((i) => i.paymentId)
            .filter(Boolean),
        },
        ipAddress: ip,
      });
    }

    return NextResponse.json({
      status: 'disbursed',
      disbursedAmount: txResult.disbursedAmount,
      loanId: txResult.loanId,
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
