import { google } from 'googleapis';
import { AppError } from '@/lib/utils/api-error';

export function getDriveClient() {
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
 * Find or create a subfolder named after `folderName` inside `parentFolderId`.
 * Validates that `folderName` contains only safe characters.
 */
export async function getOrCreateSubfolder(
  drive: ReturnType<typeof google.drive>,
  parentFolderId: string,
  folderName: string,
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(folderName)) {
    throw new AppError('VALIDATION_ERROR', 422, 'Invalid folder name');
  }

  const query = `'${parentFolderId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
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
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });

  return folder.data.id!;
}

/**
 * Upload a Buffer to Google Drive inside the given folder.
 * Returns { fileId, fileName }.
 */
export async function uploadBufferToDrive(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer,
): Promise<{ fileId: string; fileName: string }> {
  const { Readable } = await import('stream');
  const stream = Readable.from(buffer);

  const uploaded = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id,name',
    supportsAllDrives: true,
  });

  return { fileId: uploaded.data.id!, fileName: uploaded.data.name! };
}
