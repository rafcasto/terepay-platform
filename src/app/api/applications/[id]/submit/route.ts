import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { FieldValue } from 'firebase-admin/firestore';

type RouteParams = { params: Promise<{ id: string }> };

/** Generate a TP-YYYY-NNNNN reference number. */
async function generateReference(): Promise<string> {
  const year = new Date().getFullYear();
  const counterRef = adminDb.collection('counters').doc(`applications_${year}`);
  const result = await adminDb.runTransaction(async (tx) => {
    const doc = await tx.get(counterRef);
    const next = (doc.data()?.count ?? 0) + 1;
    tx.set(counterRef, { count: next }, { merge: true });
    return next;
  });
  return `TP-${year}-${String(result).padStart(5, '0')}`;
}

/**
 * POST /api/applications/[id]/submit
 * Applicant transitions their draft application to 'pending_review'.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['applicant']);
    const { id } = await params;

    const docRef = adminDb.collection('loanApplications').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');

    const data = doc.data()!;
    if (data.applicantId !== auth.uid) {
      throw new AppError('FORBIDDEN', 403, 'You do not have access to this application');
    }
    if (data.status !== 'draft') {
      throw new AppError('BAD_REQUEST', 400, 'Only draft applications can be submitted');
    }

    const referenceNumber = data.referenceNumber || await generateReference();
    const now = FieldValue.serverTimestamp();

    await docRef.update({
      status: 'pending_review',
      referenceNumber,
      submittedAt: now,
      'timeline.submittedAt': now,
      'timeline.updatedAt': now,
      affordabilityStatus: 'not_started',
      internalNotes: [],
      documents: data.documents ?? [],
      affordabilityAssessmentIds: [],
    });

    await auditLog({
      userId: auth.uid,
      action: 'application_submitted',
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
      changes: { referenceNumber },
    });

    return NextResponse.json({ status: 'pending_review', referenceNumber });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
