import { Readable } from 'stream';
import { getDriveClient, getOrCreateSubfolder } from '@/lib/gdrive/client';
import { AppError } from '@/lib/utils/api-error';
import type { TrainingDocKind, TrainingDriveEntry, TrainingDriveKind } from '@/types/training';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
/** Sub-folder of the training folder where cases uploaded from the site live (one folder per application). */
const CASES_FOLDER_NAME = 'cases';

type Drive = ReturnType<typeof getDriveClient>;

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

function toEntry(f: { id?: string | null; name?: string | null; mimeType?: string | null; size?: string | null; modifiedTime?: string | null }): TrainingDriveEntry | null {
  if (!f.id || !f.name) return null;
  return { id: f.id, name: f.name, kind: kindOf(f.name, f.mimeType), size: f.size ? Number(f.size) : null, modifiedTime: f.modifiedTime ?? null };
}

async function listChildren(drive: Drive, folderId: string, extraQ = ''): Promise<TrainingDriveEntry[]> {
  const entries: TrainingDriveEntry[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false${extraQ}`,
      fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime)',
      orderBy: 'folder,modifiedTime desc',
      pageSize: 200,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files ?? []) {
      const e = toEntry(f);
      if (e) entries.push(e);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return entries;
}

export async function getCasesFolderId(drive = getDriveClient()): Promise<string> {
  return getOrCreateSubfolder(drive, getTrainingFolderId(), CASES_FOLDER_NAME);
}

/** Top-level entries of the training folder (batch folders, .zip batches, .csv outcome files). */
export async function listTrainingFolder(): Promise<{ entries: TrainingDriveEntry[]; cases: TrainingDriveEntry[] }> {
  const drive = getDriveClient();
  const rootId = getTrainingFolderId();
  const casesId = await getCasesFolderId(drive);
  const [all, cases] = await Promise.all([
    listChildren(drive, rootId),
    listChildren(drive, casesId, ` and mimeType = '${FOLDER_MIME}'`),
  ]);
  return { entries: all.filter((e) => e.id !== casesId), cases };
}

/**
 * Resolve a Drive id the user selected and confirm it sits directly inside the
 * training folder or its `cases/` sub-folder — the queue must never point the
 * worker at arbitrary Drive content.
 */
export async function resolveTrainingEntry(id: string): Promise<TrainingDriveEntry> {
  const drive = getDriveClient();
  const rootId = getTrainingFolderId();
  const casesId = await getCasesFolderId(drive);
  const res = await drive.files
    .get({ fileId: id, fields: 'id,name,mimeType,size,modifiedTime,parents,trashed', supportsAllDrives: true })
    .catch(() => null);
  const f = res?.data;
  const parents = f?.parents ?? [];
  if (!f || f.trashed || !(parents.includes(rootId) || parents.includes(casesId))) {
    throw new AppError('NOT_FOUND', 404, 'File not found in the training folder');
  }
  const entry = toEntry(f);
  if (!entry) throw new AppError('NOT_FOUND', 404, 'File not found in the training folder');
  return entry;
}

// ---------------------------------------------------------------------------
// Cases uploaded from the site: training/cases/<applicationId>/<kind>-<n>-<file>
// ---------------------------------------------------------------------------

const APPLICATION_ID = /^[a-z0-9][a-z0-9-]{1,39}$/;

export function assertApplicationId(id: string): string {
  if (!APPLICATION_ID.test(id)) throw new AppError('VALIDATION_ERROR', 422, 'Application ID must be 2–40 lowercase letters, digits or dashes');
  return id;
}

async function getCaseFolderId(drive: Drive, applicationId: string): Promise<string> {
  return getOrCreateSubfolder(drive, await getCasesFolderId(drive), assertApplicationId(applicationId));
}

export async function listCaseFiles(applicationId: string): Promise<{ folderId: string; files: TrainingDriveEntry[] }> {
  const drive = getDriveClient();
  const folderId = await getCaseFolderId(drive, applicationId);
  return { folderId, files: await listChildren(drive, folderId) };
}

function safeFileName(name: string): string {
  const base = (name || 'file').normalize('NFKD').replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, ' ').trim();
  return base.slice(0, 100) || 'file';
}

/** Store one document in the case folder. The kind prefix drives the worker's classification. */
export async function uploadCaseFile(applicationId: string, kind: TrainingDocKind, file: File): Promise<{ fileId: string; fileName: string; folderId: string }> {
  const drive = getDriveClient();
  const folderId = await getCaseFolderId(drive, applicationId);
  const existing = await listChildren(drive, folderId);
  const n = existing.filter((e) => e.name.startsWith(`${kind}-`)).length + 1;
  const fileName = `${kind}-${n}-${safeFileName(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const created = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: file.type || 'application/octet-stream', body: Readable.from(buffer) },
    fields: 'id,name',
    supportsAllDrives: true,
  });
  return { fileId: created.data.id!, fileName: created.data.name ?? fileName, folderId };
}

/** Create or overwrite `application.json` (declared figures + outcome) in the case folder. */
export async function writeCaseApplication(applicationId: string, application: Record<string, unknown>): Promise<{ fileId: string; folderId: string }> {
  const drive = getDriveClient();
  const folderId = await getCaseFolderId(drive, applicationId);
  const body = JSON.stringify({ ...application, id: applicationId }, null, 2);
  const existing = await drive.files.list({
    q: `'${folderId}' in parents and name = 'application.json' and trashed = false`,
    fields: 'files(id)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const current = existing.data.files?.[0]?.id;
  if (current) {
    await drive.files.update({ fileId: current, media: { mimeType: 'application/json', body: Readable.from(Buffer.from(body)) }, supportsAllDrives: true });
    return { fileId: current, folderId };
  }
  const created = await drive.files.create({
    requestBody: { name: 'application.json', parents: [folderId] },
    media: { mimeType: 'application/json', body: Readable.from(Buffer.from(body)) },
    fields: 'id',
    supportsAllDrives: true,
  });
  return { fileId: created.data.id!, folderId };
}

/**
 * Remove one uploaded document from a case folder (must be a direct child).
 * The service account is not the folder owner, so it can trash but not
 * permanently delete; trashed files are invisible to every listing here and
 * to the worker (`trashed = false` queries).
 */
export async function deleteCaseFile(applicationId: string, fileId: string): Promise<void> {
  const drive = getDriveClient();
  const folderId = await getCaseFolderId(drive, applicationId);
  const res = await drive.files.get({ fileId, fields: 'id,parents', supportsAllDrives: true }).catch(() => null);
  if (!res?.data.parents?.includes(folderId)) throw new AppError('NOT_FOUND', 404, 'File not found in this case');
  await drive.files.update({ fileId, requestBody: { trashed: true }, supportsAllDrives: true });
}
