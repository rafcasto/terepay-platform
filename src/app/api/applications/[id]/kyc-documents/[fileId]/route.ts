import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { getDriveClient, downloadDriveFile, inlineContentDisposition } from '@/lib/gdrive/client';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { checkRateLimit, defaultLimiter } from '@/lib/rate-limit/limiter';
import { reviewKycDocumentSchema } from '@/lib/validation/schemas';
import { FieldValue } from 'firebase-admin/firestore';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string; fileId: string }> };

type StoredKycDoc = {
  driveFileId?: string;
  fileName?: string;
  mimeType?: string;
  status?: string;
  rejectionReason?: string | null;
  reviewedAt?: string;
  reviewedBy?: string;
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
        'Content-Disposition': inlineContentDisposition(fileName),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    if ((err as { code?: number })?.code === 404) {
      return errorResponse(new AppError('NOT_FOUND', 404, 'Document is no longer available in storage'));
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[applications/kyc-documents] view failed:', detail);
    // Surface the underlying reason outside production to aid debugging.
    if (process.env.NEXT_PUBLIC_ENVIRONMENT !== 'production') {
      return errorResponse(new AppError('DOWNLOAD_FAILED', 502, `Download failed: ${detail}`));
    }
    return internalError();
  }
}

/**
 * PATCH /api/applications/[id]/kyc-documents/[fileId]
 * Lender accepts or rejects one of the borrower's onboarding identity
 * documents. The status lives on the customer profile
 * (users/{customerId}/applicantProfile/documents) so the verdict carries
 * across all of the borrower's applications. The user's `kycStatus` is
 * rolled up from the individual document verdicts.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['lender']);
    const { id, fileId } = await params;

    if (!(await checkRateLimit(defaultLimiter, `kyc-doc-review:${auth.uid}`))) {
      throw new AppError('RATE_LIMITED', 429, 'Too many requests — please slow down');
    }

    const appSnap = await adminDb.collection('loanApplications').doc(id).get();
    if (!appSnap.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');
    const customerId = appSnap.data()!.applicantId as string | undefined;
    if (!customerId) throw new AppError('NOT_FOUND', 404, 'Document not found');

    const body = await request.json();
    const parsed = reviewKycDocumentSchema.parse(body);
    if (parsed.action === 'reject' && !parsed.rejectionReason?.trim()) {
      throw new AppError('VALIDATION_ERROR', 422, 'Rejection reason is required when rejecting a document');
    }

    const docsRef = adminDb
      .collection('users')
      .doc(customerId)
      .collection('applicantProfile')
      .doc('documents');
    const docsSnap = await docsRef.get();
    const stored = (docsSnap.data()?.documents as StoredKycDoc[] | undefined) ?? [];
    const idx = stored.findIndex((d) => d.driveFileId === fileId);
    if (idx === -1) throw new AppError('NOT_FOUND', 404, 'Document not found for this borrower');

    const next = [...stored];
    next[idx] = {
      ...next[idx],
      status: parsed.action === 'accept' ? 'accepted' : 'rejected',
      rejectionReason: parsed.action === 'reject' ? parsed.rejectionReason!.trim() : null,
      reviewedAt: new Date().toISOString(),
      reviewedBy: auth.uid,
    };

    const allAccepted = next.length > 0 && next.every((d) => d.status === 'accepted');
    const anyRejected = next.some((d) => d.status === 'rejected');
    const kycStatus = allAccepted ? 'approved' : anyRejected ? 'rejected' : 'submitted';

    const now = FieldValue.serverTimestamp();
    const batch = adminDb.batch();
    batch.update(docsRef, { documents: next, reviewedAt: now });
    batch.update(adminDb.collection('users').doc(customerId), { kycStatus, updatedAt: now });
    await batch.commit();

    await auditLog({
      userId: auth.uid,
      action: `kyc_document_${parsed.action}ed`,
      targetId: customerId,
      targetType: 'customer_profile',
      outcome: 'success',
      ipAddress: ip,
      changes: { applicationId: id, fileId, action: parsed.action, kycStatus },
    });

    return NextResponse.json({ status: 'ok', kycStatus });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
