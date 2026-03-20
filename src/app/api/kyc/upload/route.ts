import { type NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { Readable } from 'stream';

export const dynamic = 'force-dynamic';

// Max file size: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

function getDriveClient() {
  const email = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !privateKey) {
    throw new AppError('CONFIG_ERROR', 500, 'Google Drive credentials are not configured');
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return google.drive({ version: 'v3', auth });
}

/**
 * POST /api/kyc/upload
 * Uploads a single KYC document to Google Drive.
 * Expects multipart/form-data with fields:
 *   - file: the document file
 *   - docType: string label (e.g. "nz_passport", "proof_of_address")
 *
 * Returns: { driveFileId, fileName, mimeType }
 */
export async function POST(request: NextRequest) {
  try {
    const { uid } = await withAuth(request, ['applicant']);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const docType = formData.get('docType') as string | null;

    if (!file) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'No file provided'));
    }
    if (!docType) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Document type is required'));
    }
    if (file.size > MAX_FILE_SIZE) {
      return errorResponse(new AppError('FILE_TOO_LARGE', 413, 'File must be smaller than 10 MB'));
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return errorResponse(new AppError('INVALID_FILE_TYPE', 415, 'Only JPEG, PNG, WebP, and PDF files are accepted'));
    }

    const parentFolderId = process.env.GOOGLE_DRIVE_KYC_FOLDER_ID;
    if (!parentFolderId) {
      throw new AppError('CONFIG_ERROR', 500, 'Google Drive KYC folder ID is not configured');
    }

    const drive = getDriveClient();

    // Ensure a per-user subfolder exists (create if absent)
    const userFolderId = await getOrCreateUserFolder(drive, parentFolderId, uid);

    // Convert Web API File → Node Readable stream
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const stream = Readable.from(buffer);

    // Sanitise filename to prevent path traversal
    const safeFileName = sanitiseFileName(file.name);

    const uploadedFile = await drive.files.create({
      requestBody: {
        name: `${docType}_${Date.now()}_${safeFileName}`,
        parents: [userFolderId],
      },
      media: {
        mimeType: file.type,
        body: stream,
      },
      fields: 'id,name,mimeType',
      supportsAllDrives: true,
    });

    const driveFileId = uploadedFile.data.id!;
    const fileName = uploadedFile.data.name!;
    const mimeType = uploadedFile.data.mimeType!;

    // Persist draft so the upload survives page refreshes
    await adminDb
      .collection('users')
      .doc(uid)
      .collection('applicantProfile')
      .doc('kycDraft')
      .set(
        {
          uploads: {
            [docType]: { driveFileId, fileName, mimeType, uploadedAt: new Date() },
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    return NextResponse.json({ driveFileId, fileName, mimeType });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error('[kyc/upload] Unexpected error:', err);
    return internalError();
  }
}

/**
 * Find or create a folder named after the user UID inside the KYC parent folder.
 */
async function getOrCreateUserFolder(
  drive: ReturnType<typeof google.drive>,
  parentFolderId: string,
  uid: string,
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(uid)) {
    throw new AppError('VALIDATION_ERROR', 422, 'Invalid user identifier');
  }
  const query = `'${parentFolderId}' in parents and name = '${uid}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const existing = await drive.files.list({
    q: query,
    fields: 'files(id)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (existing.data.files && existing.data.files.length > 0) {
    return existing.data.files[0].id!;
  }

  const folder = await drive.files.create({
    requestBody: {
      name: uid,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });

  return folder.data.id!;
}

/**
 * DELETE /api/kyc/upload
 * Removes a previously uploaded KYC document from Google Drive and clears
 * its entry from the kycDraft Firestore document.
 * Expects JSON body: { driveFileId: string, docType: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const { uid } = await withAuth(request, ['applicant']);

    const body = await request.json();
    const driveFileId = body?.driveFileId as string | undefined;
    const docType = body?.docType as string | undefined;

    if (!driveFileId || typeof driveFileId !== 'string') {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'driveFileId is required'));
    }
    if (!docType || typeof docType !== 'string') {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'docType is required'));
    }

    const drive = getDriveClient();
    try {
      await drive.files.delete({ fileId: driveFileId, supportsAllDrives: true });
    } catch (err: unknown) {
      // 404 means the file is already gone — treat as success
      if ((err as { code?: number })?.code !== 404) throw err;
    }

    await adminDb
      .collection('users')
      .doc(uid)
      .collection('applicantProfile')
      .doc('kycDraft')
      .update({
        [`uploads.${docType}`]: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error('[kyc/upload] DELETE unexpected error:', err);
    return internalError();
  }
}

/** Strip path separators and control characters from a filename. */
function sanitiseFileName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').slice(0, 100);
}
