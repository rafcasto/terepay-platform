import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { FieldValue } from 'firebase-admin/firestore';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/applications/[id]/submit
 * Applicant transitions their draft application to 'submitted'.
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

    const now = FieldValue.serverTimestamp();
    await docRef.update({
      status: 'submitted',
      submittedAt: now,
      'timeline.submittedAt': now,
      'timeline.updatedAt': now,
    });

    await auditLog({
      userId: auth.uid,
      action: 'application_submitted',
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
    });

    return NextResponse.json({ status: 'submitted' });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
