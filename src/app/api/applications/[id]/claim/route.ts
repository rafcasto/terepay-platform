import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { FieldValue } from 'firebase-admin/firestore';

type RouteParams = { params: Promise<{ id: string }> };

const MAX_ACTIVE_PER_LENDER = 10;

/**
 * POST /api/applications/[id]/claim
 * Lender claims a pending_review application, transitioning it to under_assessment.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['lender']);
    const { id } = await params;

    const docRef = adminDb.collection('loanApplications').doc(id);

    await adminDb.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);
      if (!doc.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');

      const data = doc.data()!;
      if (data.status !== 'pending_review') {
        throw new AppError('BAD_REQUEST', 400, `Cannot claim application with status: ${data.status}`);
      }

      // Check lender's active application limit
      const activeSnap = await adminDb
        .collection('loanApplications')
        .where('assignedLenderId', '==', auth.uid)
        .where('status', 'in', ['under_assessment', 'waiting_for_docs', 'credit_check'])
        .get();
      if (activeSnap.size >= MAX_ACTIVE_PER_LENDER) {
        throw new AppError(
          'BAD_REQUEST',
          400,
          `You already have ${MAX_ACTIVE_PER_LENDER} active applications. Complete some before claiming more.`,
        );
      }

      const now = FieldValue.serverTimestamp();
      tx.update(docRef, {
        status: 'under_assessment',
        assignedLenderId: auth.uid,
        'timeline.claimedAt': now,
        'timeline.assessmentStartedAt': now,
        'timeline.updatedAt': now,
      });
    });

    await auditLog({
      userId: auth.uid,
      action: 'application_claimed',
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
    });

    return NextResponse.json({ status: 'under_assessment' });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
