import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { withAuth } from '@/lib/auth/middleware';
import { reviewDocumentSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { FieldValue } from 'firebase-admin/firestore';
import { ZodError } from 'zod';
import { getDriveClient } from '@/lib/gdrive/client';
import { checkRateLimit, defaultLimiter } from '@/lib/rate-limit/limiter';

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


/**
 * GET /api/applications/[id]/documents/[docId]
 * Streams an applicant-uploaded application document (identity / income
 * evidence) from Google Drive back to the lender for review/download. The
 * docId must belong to this application's documents[] — the documentId is the
 * Drive file id, validated here before serving.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['lender']);
    const { id, docId } = await params;

    if (!(await checkRateLimit(defaultLimiter, `app-doc-view:${auth.uid}`))) {
      throw new AppError('RATE_LIMITED', 429, 'Too many requests — please slow down');
    }

    const appSnap = await adminDb.collection('loanApplications').doc(id).get();
    if (!appSnap.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');

    const documents = (appSnap.data()!.documents as Array<Record<string, unknown>> | undefined) ?? [];
    const match = documents.find((d) => (d as { documentId?: string }).documentId === docId);
    if (!match) throw new AppError('NOT_FOUND', 404, 'Document not found');

    const fileName = ((match.fileName as string) ?? 'document').replace(/[/\\:*?"<>|]/g, '_');

    const drive = getDriveClient();
    const meta = await drive.files.get({ fileId: docId, fields: 'mimeType', supportsAllDrives: true });
    const mimeType = (meta.data.mimeType as string) ?? 'application/octet-stream';
    const driveRes = await drive.files.get(
      { fileId: docId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' },
    );
    const data = Buffer.from(driveRes.data as ArrayBuffer);

    await auditLog({
      userId: auth.uid,
      action: 'application_document_viewed',
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
      changes: { documentId: docId },
    });

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error('[applications/documents] view failed');
    return internalError();
  }
}
