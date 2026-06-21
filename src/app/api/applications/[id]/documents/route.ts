import { type NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getDriveClient, getOrCreateSubfolder } from '@/lib/gdrive/client';
import type { ApplicationDocument, DocumentType } from '@/types/application';

export const dynamic = 'force-dynamic';

// 10 MB per file — matches the design handoff and existing KYC upload limit.
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/csv',
]);

const ALLOWED_DOC_TYPES: ReadonlySet<DocumentType> = new Set([
  'passport',
  'drivers_licence',
  'visa',
  'payslip',
  'bank_statement',
  'other',
]);

// Statuses where the applicant is allowed to push more documents up.
// Outside this window the lender has either made a decision or hasn't
// requested additional material — silent uploads aren't useful.
const UPLOAD_ALLOWED_STATUSES = new Set([
  'waiting_for_docs',
  'pending_review',
  'under_assessment',
  'credit_check',
]);

/**
 * POST /api/applications/[id]/documents
 *
 * Applicant uploads a single document. Stored in Google Drive (per the
 * platform's KYC pattern — Firebase Storage is not used). Appends an
 * `ApplicationDocument` entry to `loanApplications.documents[]` with
 * `status: 'pending'`. The lender then PATCHes the document via the
 * existing /[docId] endpoint to accept or reject it.
 *
 * Body (multipart/form-data):
 *   - file: File
 *   - type: DocumentType  (passport | drivers_licence | visa | payslip | bank_statement | other)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(request);
  let applicationId = '';

  try {
    const auth = await withAuth(request, ['applicant']);
    const { id } = await params;
    applicationId = id;

    const appRef = adminDb.collection('loanApplications').doc(id);
    const appSnap = await appRef.get();
    if (!appSnap.exists) {
      throw new AppError('NOT_FOUND', 404, 'Application not found');
    }
    const app = appSnap.data()!;

    // Ownership: own application OR a lender-created application the user
    // has claimed via customerId.
    const userDoc = await adminDb.collection('users').doc(auth.uid).get();
    const customerId = userDoc.data()?.customerId as string | undefined;
    const isOwner =
      app.applicantId === auth.uid ||
      (customerId && app.offlineCustomerId === customerId);
    if (!isOwner) {
      throw new AppError('NOT_FOUND', 404, 'Application not found');
    }

    if (!UPLOAD_ALLOWED_STATUSES.has(app.status as string)) {
      throw new AppError(
        'BAD_REQUEST',
        400,
        `Documents cannot be uploaded while application status is "${app.status}"`,
      );
    }

    const form = await request.formData();
    const file = form.get('file') as File | null;
    const rawType = (form.get('type') as string | null) ?? 'other';

    if (!file) {
      throw new AppError('VALIDATION_ERROR', 422, 'No file provided');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new AppError('FILE_TOO_LARGE', 413, 'File must be smaller than 10 MB');
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      throw new AppError(
        'INVALID_FILE_TYPE',
        415,
        'Only JPEG, PNG, WebP, PDF, and CSV files are accepted',
      );
    }
    if (!ALLOWED_DOC_TYPES.has(rawType as DocumentType)) {
      throw new AppError('VALIDATION_ERROR', 422, `Unknown document type: ${rawType}`);
    }
    const docType = rawType as DocumentType;

    const parentFolderId = process.env.GOOGLE_DRIVE_APPLICATIONS_FOLDER_ID
      ?? process.env.GOOGLE_DRIVE_KYC_FOLDER_ID;
    if (!parentFolderId) {
      throw new AppError(
        'CONFIG_ERROR',
        500,
        'Google Drive folder ID is not configured (set GOOGLE_DRIVE_APPLICATIONS_FOLDER_ID)',
      );
    }

    const drive = getDriveClient();
    const subfolderName = `app_${id}`.replace(/[^a-zA-Z0-9_-]/g, '');
    const appFolderId = await getOrCreateSubfolder(drive, parentFolderId, subfolderName);

    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = Readable.from(buffer);
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    const driveName = `${docType}_${Date.now()}_${safeFileName}`;

    const uploaded = await drive.files.create({
      requestBody: { name: driveName, parents: [appFolderId] },
      media: { mimeType: file.type, body: stream },
      fields: 'id,name,mimeType,webViewLink',
      supportsAllDrives: true,
    });

    const documentId = uploaded.data.id!;
    const entry: ApplicationDocument = {
      documentId,
      type: docType,
      fileName: file.name,
      fileUrl: uploaded.data.webViewLink ?? `https://drive.google.com/file/d/${documentId}/view`,
      fileSize: file.size,
      uploadedAt: Timestamp.now(),
      uploadedBy: auth.uid,
      status: 'pending',
    };

    await appRef.update({
      documents: FieldValue.arrayUnion(entry),
      'timeline.updatedAt': FieldValue.serverTimestamp(),
    });

    await auditLog({
      userId: auth.uid,
      action: 'application_document_uploaded',
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      changes: { documentId, type: docType, fileName: file.name, fileSize: file.size },
      ipAddress: ip,
    });

    return NextResponse.json({
      success: true,
      data: { documentId, fileName: file.name, type: docType, status: 'pending' },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    await auditLog({
      userId: 'unknown',
      action: 'application_document_uploaded',
      targetId: applicationId,
      targetType: 'application',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : String(err),
      ipAddress: ip,
    });
    return internalError();
  }
}
