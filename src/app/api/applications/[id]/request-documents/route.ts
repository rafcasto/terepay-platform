import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { withAuth } from '@/lib/auth/middleware';
import { requestDocumentsSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { FieldValue } from 'firebase-admin/firestore';
import { ZodError } from 'zod';

type RouteParams = { params: Promise<{ id: string }> };

const ALLOWED_CLAIM_STATUSES = ['under_assessment', 'waiting_for_docs'];

/**
 * POST /api/applications/[id]/request-documents
 * Lender requests additional documents from the applicant.
 * Transitions status to waiting_for_docs.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['lender']);
    const { id } = await params;

    const doc = await adminDb.collection('loanApplications').doc(id).get();
    if (!doc.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');

    const data = doc.data()!;
    if (!ALLOWED_CLAIM_STATUSES.includes(data.status)) {
      throw new AppError('BAD_REQUEST', 400, `Cannot request documents while status is: ${data.status}`);
    }

    const body = await request.json();
    const parsed = requestDocumentsSchema.parse(body);

    const now = FieldValue.serverTimestamp();
    await adminDb.collection('loanApplications').doc(id).update({
      status: 'waiting_for_docs',
      documentRequest: {
        requestedAt: now,
        requestedBy: auth.uid,
        requiredDocuments: parsed.requiredDocuments,
        message: parsed.message ?? '',
      },
      'timeline.updatedAt': now,
    });

    await auditLog({
      userId: auth.uid,
      action: 'documents_requested',
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
      changes: { requiredDocuments: parsed.requiredDocuments },
    });

    return NextResponse.json({ status: 'waiting_for_docs' });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
