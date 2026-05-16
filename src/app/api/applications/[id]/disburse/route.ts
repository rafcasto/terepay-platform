import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { disburseSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { FieldValue } from 'firebase-admin/firestore';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/applications/[id]/disburse
 * Lender (assigned) marks an accepted loan as disbursed. Computes the disbursed
 * amount as approvedAmount − applicationFee using values already on the
 * application. Idempotent: re-running on an already-disbursed application
 * returns the existing values.
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

      return {
        status: 'disbursed' as const,
        disbursedAmount,
        alreadyDisbursed: false,
        applicationFee,
        isOverride,
        consentMandateId: appData.paymentConsent?.mandateId,
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
          consentMandateId: result.consentMandateId,
        },
        ipAddress: ip,
      });
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
