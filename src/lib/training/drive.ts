import { getDriveClient } from '@/lib/gdrive/client';
import { AppError } from '@/lib/utils/api-error';
import type { TrainingDriveEntry, TrainingDriveKind } from '@/types/training';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

/** The Drive folder the admin drops training data into. Shared with the worker's service account. */
export function getTrainingFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_TRAINING_FOLDER_ID;
  if (!id) throw new AppError('CONFIG_ERROR', 503, 'GOOGLE_DRIVE_TRAINING_FOLDER_ID is not configured');
  return id;
}

function kindOf(name: string, mimeType: string | null | undefined): TrainingDriveKind {
  if (mimeType === FOLDER_MIME) return 'folder';
  if (/\.zip$/i.test(name) || mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') return 'zip';
  if (/\.csv$/i.test(name) || mimeType === 'text/csv') return 'csv';
  return 'other';
}

/** Top-level entries of the training folder (folders, .zip batches, .csv outcome files). */
export async function listTrainingFolder(): Promise<TrainingDriveEntry[]> {
  const folderId = getTrainingFolderId();
  const drive = getDriveClient();
  const entries: TrainingDriveEntry[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime)',
      orderBy: 'folder,modifiedTime desc',
      pageSize: 200,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files ?? []) {
      if (!f.id || !f.name) continue;
      entries.push({
        id: f.id,
        name: f.name,
        kind: kindOf(f.name, f.mimeType),
        size: f.size ? Number(f.size) : null,
        modifiedTime: f.modifiedTime ?? null,
      });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return entries;
}

/**
 * Resolve a Drive id the admin selected and confirm it sits directly inside
 * the training folder — the queue must never point the worker at arbitrary
 * Drive content.
 */
export async function resolveTrainingEntry(id: string): Promise<TrainingDriveEntry> {
  const folderId = getTrainingFolderId();
  const drive = getDriveClient();
  const res = await drive.files
    .get({ fileId: id, fields: 'id,name,mimeType,size,modifiedTime,parents,trashed', supportsAllDrives: true })
    .catch(() => null);
  const f = res?.data;
  if (!f || !f.id || !f.name || f.trashed || !(f.parents ?? []).includes(folderId)) {
    throw new AppError('NOT_FOUND', 404, 'File not found in the training folder');
  }
  return {
    id: f.id,
    name: f.name,
    kind: kindOf(f.name, f.mimeType),
    size: f.size ? Number(f.size) : null,
    modifiedTime: f.modifiedTime ?? null,
  };
}
