import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { withAuth } from '@/lib/auth/middleware';
import { lenderDecisionSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { FieldValue } from 'firebase-admin/firestore';
import { ZodError } from 'zod';

type RouteParams = { params: Promise<{ id: string }> };

const LOAN_INTEREST_RATE = 0.047; // 4.7% for 8 weeks
const ESTABLISHMENT_FEE_NEW = 50;
const ESTABLISHMENT_FEE_REPEAT = 20;

/**
 * POST /api/applications/[id]/decision
 * Lender approves or declines an application.
 * Approval is only allowed when:
 * - Affordability assessment is complete with recommendation = 'proceed'
 * - No hard decline triggers
 * - Credit check has passed (or is bypassed for decline)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['lender']);
    const { id } = await params;

    const appRef = adminDb.collection('loanApplications').doc(id);
    const appDoc = await appRef.get();
    if (!appDoc.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');

    const appData = appDoc.data()!;

    const body = await request.json();
    const parsed = lenderDecisionSchema.parse(body);

    // ── Validate pre-conditions for approval ──────────────────────────────
    if (parsed.action === 'approve') {
      const allowedStatuses = ['under_assessment', 'credit_check'];
      if (!allowedStatuses.includes(appData.status)) {
        throw new AppError('BAD_REQUEST', 400, `Cannot approve application with status: ${appData.status}`);
      }

      if (appData.affordabilityStatus !== 'complete') {
        throw new AppError(
          'BAD_REQUEST',
          400,
          'Affordability assessment must be completed before approval',
        );
      }

      // Check the latest affordability assessment recommendation
      const assessmentSnap = await adminDb
        .collection('affordabilityAssessments')
        .where('applicationId', '==', id)
        .where('isSuperseded', '==', false)
        .limit(1)
        .get();

      if (assessmentSnap.empty) {
        throw new AppError('BAD_REQUEST', 400, 'No completed affordability assessment found');
      }

      const assessment = assessmentSnap.docs[0].data();
      if (assessment.hardDeclineTriggers?.length > 0) {
        throw new AppError(
          'BAD_REQUEST',
          400,
          `Hard decline triggered: ${(assessment.hardDeclineTriggers as string[]).join(', ')}`,
        );
      }
      if (assessment.recommendation === 'decline') {
        throw new AppError(
          'BAD_REQUEST',
          400,
          'Affordability assessment recommends decline. Cannot approve.',
        );
      }
    }

    const now = FieldValue.serverTimestamp();
    const approvedAmount = parsed.approvedAmount ?? appData.loanDetails?.requestedAmount;

    // Determine if new or repeat customer
    const previousLoansSnap = await adminDb
      .collection('loanApplications')
      .where('applicantId', '==', appData.applicantId)
      .where('status', 'in', ['approved', 'disbursed', 'active', 'closed_repaid'])
      .get();
    const isRepeatCustomer = previousLoansSnap.size > 0;
    const establishmentFee = isRepeatCustomer ? ESTABLISHMENT_FEE_REPEAT : ESTABLISHMENT_FEE_NEW;

    const fortnightlyPayment = approvedAmount
      ? Math.round(((approvedAmount * (1 + LOAN_INTEREST_RATE)) / 4) * 100) / 100
      : undefined;
    const totalRepayment = approvedAmount
      ? Math.round((approvedAmount * (1 + LOAN_INTEREST_RATE)) * 100) / 100
      : undefined;

    if (parsed.action === 'approve') {
      await appRef.update({
        status: 'approved',
        decision: {
          decidedBy: auth.uid,
          decidedAt: now,
          action: 'approved',
          rationale: parsed.rationale,
          approvedAmount,
        },
        'loanDetails.approvedAmount': approvedAmount,
        'loanDetails.establishmentFee': establishmentFee,
        'loanDetails.fortnightlyPayment': fortnightlyPayment,
        'loanDetails.totalRepayment': totalRepayment,
        'timeline.approvedAt': now,
        'timeline.updatedAt': now,
      });
    } else {
      await appRef.update({
        status: 'declined',
        decision: {
          decidedBy: auth.uid,
          decidedAt: now,
          action: 'declined',
          rationale: parsed.rationale,
          declineReasons: parsed.declineReasons ?? [],
        },
        'timeline.declinedAt': now,
        'timeline.updatedAt': now,
      });
    }

    await auditLog({
      userId: auth.uid,
      action: `application_${parsed.action}d`,
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
      changes: {
        action: parsed.action,
        rationale: parsed.rationale,
        approvedAmount: parsed.action === 'approve' ? approvedAmount : undefined,
        declineReasons: parsed.declineReasons,
      },
    });

    return NextResponse.json({ status: parsed.action === 'approve' ? 'approved' : 'declined' });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
