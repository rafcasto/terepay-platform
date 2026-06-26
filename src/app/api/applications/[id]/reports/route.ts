import { type NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { withAuth } from '@/lib/auth/middleware';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getDriveClient, getOrCreateSubfolder } from '@/lib/gdrive/client';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { checkRateLimit, defaultLimiter } from '@/lib/rate-limit/limiter';

export const dynamic = 'force-dynamic';

// Max file size: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const PROVIDERS = new Set(['datazoo', 'centrix']);

type RouteParams = { params: Promise<{ id: string }> };

/** Strip path separators and control characters from a filename. */
function sanitiseFileName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').slice(0, 100);
}

/**
 * POST /api/applications/[id]/reports
 * Assigned lender uploads a provider report (DataZoo KYC or Centrix credit)
 * to Google Drive. The metadata is stored on the borrower's customer profile
 * (users/{customerId}/lenderReports) so the report is reused across the
 * customer's future loan applications.
 *
 * multipart/form-data:
 *   - file: the report (PDF / JPEG / PNG)
 *   - provider: 'datazoo' | 'centrix'
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['lender']);
    const { id } = await params;

    if (!(await checkRateLimit(defaultLimiter, `reports:${auth.uid}`))) {
      throw new AppError('RATE_LIMITED', 429, 'Too many uploads — please slow down');
    }

    const appSnap = await adminDb.collection('loanApplications').doc(id).get();
    if (!appSnap.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');
    const appData = appSnap.data()!;

    if (appData.assignedLenderId !== auth.uid) {
      throw new AppError('FORBIDDEN', 403, 'Only the assigned lender can upload reports');
    }

    const customerId = appData.applicantId as string | undefined;
    if (!customerId) throw new AppError('BAD_REQUEST', 400, 'Application has no associated customer');

    const formData = await request.formData();
    const file = formData.get('file');
    const provider = formData.get('provider');

    if (!(file instanceof File)) {
      throw new AppError('VALIDATION_ERROR', 422, 'No file provided');
    }
    if (typeof provider !== 'string' || !PROVIDERS.has(provider)) {
      throw new AppError('VALIDATION_ERROR', 422, 'Invalid report provider');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new AppError('FILE_TOO_LARGE', 413, 'File must be smaller than 10 MB');
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      throw new AppError('INVALID_FILE_TYPE', 415, 'Only PDF, JPEG and PNG files are accepted');
    }

    const parentFolderId = process.env.GOOGLE_DRIVE_KYC_FOLDER_ID;
    if (!parentFolderId) {
      throw new AppError('CONFIG_ERROR', 500, 'Google Drive folder is not configured');
    }

    const drive = getDriveClient();
    // Per-customer subfolder (getOrCreateSubfolder validates the folder name)
    const customerFolderId = await getOrCreateSubfolder(drive, parentFolderId, customerId);

    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = Readable.from(buffer);
    const safeName = sanitiseFileName(file.name);

    const uploaded = await drive.files.create({
      requestBody: {
        name: `${provider}_${Date.now()}_${safeName}`,
        parents: [customerFolderId],
      },
      media: { mimeType: file.type, body: stream },
      fields: 'id,name,mimeType',
      supportsAllDrives: true,
    });

    const driveFileId = uploaded.data.id;
    if (!driveFileId) throw new AppError('UPLOAD_FAILED', 502, 'Drive upload failed');

    // Lender display name for the report card
    const lenderSnap = await adminDb.collection('users').doc(auth.uid).get();
    const ld = lenderSnap.data();
    const uploadedByName = ld
      ? `${ld.firstName ?? ''} ${ld.lastName ?? ''}`.trim() || auth.email
      : auth.email;

    const repRef = await adminDb
      .collection('users')
      .doc(customerId)
      .collection('lenderReports')
      .add({
        provider,
        fileName: safeName,
        driveFileId,
        mimeType: file.type,
        uploadedBy: auth.uid,
        uploadedByName,
        uploadedFromApplicationId: id,
        uploadedAt: FieldValue.serverTimestamp(),
      });

    await auditLog({
      userId: auth.uid,
      action: 'lender_report_uploaded',
      targetId: customerId,
      targetType: 'customer_profile',
      outcome: 'success',
      ipAddress: ip,
      changes: { provider, applicationId: id, reportId: repRef.id },
    });

    return NextResponse.json({ id: repRef.id, fileName: safeName });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error('[applications/reports] upload failed');
    return internalError();
  }
}
