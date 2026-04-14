import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { withAuth } from '@/lib/auth/middleware';
import { approveApplicationSchema, rejectApplicationSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { FieldValue } from 'firebase-admin/firestore';
import { ZodError } from 'zod';
import { randomUUID } from 'crypto';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/applications/[id]/approve
 * Lender approves a loan application and creates the corresponding loan record.
 * Uses applicationId as the loan document ID for idempotency.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  let applicationId = '';

  try {
    const auth = await withAuth(request, ['lender']);
    const { id } = await params;
    applicationId = id;

    const appRef = adminDb.collection('loanApplications').doc(id);
    const loanRef = adminDb.collection('loans').doc(id); // 1:1 by design (idempotent)

    const body = await request.json();
    const action = body.action as string;

    if (action === 'reject') {
      const parsed = rejectApplicationSchema.parse(body);

      await appRef.update({
        status: 'rejected',
        'approval': {
          approverId: auth.uid,
          approvedAt: FieldValue.serverTimestamp(),
          status: 'rejected',
          comments: parsed.comments,
        },
        'timeline.rejectedAt': FieldValue.serverTimestamp(),
        'timeline.updatedAt': FieldValue.serverTimestamp(),
      });

      await auditLog({
        userId: auth.uid,
        action: 'application_rejected',
        targetId: id,
        targetType: 'application',
        outcome: 'success',
        ipAddress: ip,
      });

      return NextResponse.json({ status: 'rejected' });
    }

    // Approve flow
    const parsed = approveApplicationSchema.parse(body);

    // Idempotent: skip if loan already exists for this application
    await adminDb.runTransaction(async (tx) => {
      const [appDoc, loanDoc] = await Promise.all([tx.get(appRef), tx.get(loanRef)]);

      if (!appDoc.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');
      if (loanDoc.exists) return; // already approved — idempotent

      const appData = appDoc.data()!;
      if (!['submitted', 'under_review'].includes(appData.status)) {
        throw new AppError('BAD_REQUEST', 400, `Cannot approve application with status: ${appData.status}`);
      }

      const now = FieldValue.serverTimestamp();
      const monthlyRate = parsed.approvedRate / 100 / 12;
      const n = parsed.approvedTerm;
      const monthlyPayment =
        monthlyRate === 0
          ? parsed.approvedAmount / n
          : parsed.approvedAmount * (monthlyRate * Math.pow(1 + monthlyRate, n)) /
            (Math.pow(1 + monthlyRate, n) - 1);

      tx.update(appRef, {
        status: 'approved',
        'approval': {
          approverId: auth.uid,
          approvedAt: now,
          status: 'approved',
          approvedAmount: parsed.approvedAmount,
          approvedRate: parsed.approvedRate,
          approvedTerm: parsed.approvedTerm,
          monthlyPayment,
          comments: parsed.comments ?? '',
          conditions: parsed.conditions ?? [],
        },
        'loanDetails.approvedLoanAmount': parsed.approvedAmount,
        'loanDetails.approvedRate': parsed.approvedRate,
        'loanDetails.approvedTerm': parsed.approvedTerm,
        'loanDetails.monthlyPayment': monthlyPayment,
        'timeline.approvedAt': now,
        'timeline.updatedAt': now,
      });

      tx.set(loanRef, {
        loanId: id,
        applicationId: id,
        applicantId: appData.applicantId,
        lenderId: auth.uid,
        principal: parsed.approvedAmount,
        interestRate: parsed.approvedRate,
        term: parsed.approvedTerm,
        monthlyPayment,
        dailyInterestRate: parsed.approvedRate / 100 / 365,
        status: 'active',
        totalPayments: parsed.approvedTerm,
        paymentsCompleted: 0,
        paymentsRemaining: parsed.approvedTerm,
        totalPaid: 0,
        remainingBalance: parsed.approvedAmount,
        totalInterestPaid: 0,
        estimatedTotalInterest: monthlyPayment * parsed.approvedTerm - parsed.approvedAmount,
        daysOverdue: 0,
        daysDelinquent: 0,
        latePaymentCount: 0,
        createdAt: now,
        updatedAt: now,
        dateIssued: now,
      });
    });

    await auditLog({
      userId: auth.uid,
      action: 'application_approved',
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      changes: { approvedAmount: parsed.approvedAmount, approvedRate: parsed.approvedRate },
      ipAddress: ip,
    });

    return NextResponse.json({ status: 'approved' });
  } catch (err) {
    if (err instanceof ZodError) {
      console.error('[approve] Zod validation failed:', JSON.stringify(err.flatten().fieldErrors));
      return errorResponse(
        new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors),
      );
    }
    if (err instanceof AppError) return errorResponse(err);

    await auditLog({ userId: 'unknown', action: 'application_approved', targetId: applicationId, targetType: 'application', outcome: 'failure', ipAddress: ip });
    return internalError();
  }
}
