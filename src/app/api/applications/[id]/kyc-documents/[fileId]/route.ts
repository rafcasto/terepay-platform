import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { getDriveClient, downloadDriveFile } from '@/lib/gdrive/client';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { checkRateLimit, defaultLimiter } from '@/lib/rate-limit/limiter';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string; fileId: string }> };

type StoredKycDoc = {
  driveFileId?: string;
  fileName?: string;
  mimeType?: string;
};

/**
 * GET /api/applications/[id]/kyc-documents/[fileId]
 * Lets a lender download a borrower's onboarding KYC evidence document from
 * Google Drive. The requested Drive file id MUST belong to this borrower's
 * own onboarding documents (users/{customerId}/applicantProfile/documents) —
 * this prevents a lender from fetching arbitrary Drive files by id.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['lender']);
    const { id, fileId } = await params;

    if (!(await checkRateLimit(defaultLimiter, `kyc-doc-view:${auth.uid}`))) {
      throw new AppError('RATE_LIMITED', 429, 'Too many requests — please slow down');
    }

    const appSnap = await adminDb.collection('loanApplications').doc(id).get();
    if (!appSnap.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');
    const customerId = appSnap.data()!.applicantId as string | undefined;
    if (!customerId) throw new AppError('NOT_FOUND', 404, 'Document not found');

    // Resolve the borrower's onboarding KYC documents and confirm ownership.
    const docsSnap = await adminDb
      .collection('users')
      .doc(customerId)
      .collection('applicantProfile')
      .doc('documents')
      .get();

    const stored = (docsSnap.data()?.documents as StoredKycDoc[] | undefined) ?? [];
    const match = stored.find((d) => d.driveFileId === fileId);
    if (!match) throw new AppError('NOT_FOUND', 404, 'Document not found for this borrower');

    const fileName = (match.fileName ?? 'kyc-document').replace(/[/\\:*?"<>|]/g, '_');

    const drive = getDriveClient();
    const { buffer: data, mimeType } = await downloadDriveFile(drive, fileId);

    await auditLog({
      userId: auth.uid,
      action: 'borrower_kyc_document_viewed',
      targetId: customerId,
      targetType: 'customer_profile',
      outcome: 'success',
      ipAddress: ip,
      changes: { applicationId: id },
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
    if ((err as { code?: number })?.code === 404) {
      return errorResponse(new AppError('NOT_FOUND', 404, 'Document is no longer available in storage'));
    }
    console.error('[applications/kyc-documents] view failed:', err instanceof Error ? err.message : String(err));
    return internalError();
  }
}
