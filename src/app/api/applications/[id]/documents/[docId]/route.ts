import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { withAuth } from '@/lib/auth/middleware';
import { reviewDocumentSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { FieldValue } from 'firebase-admin/firestore';
import { ZodError } from 'zod';

type RouteParams = { params: Promise<{ id: string; docId: string }> };

/**
 * PATCH /api/applications/[id]/documents/[docId]
 * Lender accepts or rejects an uploaded document.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['lender']);
    const { id, docId } = await params;

    const appDoc = await adminDb.collection('loanApplications').doc(id).get();
    if (!appDoc.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');

    const body = await request.json();
    const parsed = reviewDocumentSchema.parse(body);

    if (parsed.action === 'reject' && !parsed.rejectionReason) {
      throw new AppError('VALIDATION_ERROR', 422, 'Rejection reason is required when rejecting a document');
    }

    const appData = appDoc.data()!;
    const documents: Record<string, unknown>[] = appData.documents ?? [];
    const docIndex = documents.findIndex((d) => (d as { documentId: string }).documentId === docId);
    if (docIndex === -1) throw new AppError('NOT_FOUND', 404, 'Document not found');

    documents[docIndex] = {
      ...documents[docIndex],
      status: parsed.action === 'accept' ? 'accepted' : 'rejected',
      rejectionReason: parsed.rejectionReason ?? null,
      reviewedAt: new Date().toISOString(),
      reviewedBy: auth.uid,
    };

    await adminDb.collection('loanApplications').doc(id).update({
      documents,
      'timeline.updatedAt': FieldValue.serverTimestamp(),
    });

    await auditLog({
      userId: auth.uid,
      action: `document_${parsed.action}ed`,
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
      changes: { docId, action: parsed.action, rejectionReason: parsed.rejectionReason },
    });

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
