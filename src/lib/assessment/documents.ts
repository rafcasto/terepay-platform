import { getDriveClient } from '@/lib/gdrive/client';
import { AppError } from '@/lib/utils/api-error';
import type { ApplicationDocument, DocumentType } from '@/types/application';
import type { CreditAssessmentDocKind, CreditAssessmentDocument } from '@/types/credit-assessment';

const FOLDER_MIME = 'application/vnd.google-apps.folder';

/** Document types the assessor can read. Identity documents are never sent. */
const KIND_BY_TYPE: Partial<Record<DocumentType, CreditAssessmentDocKind>> = {
  bank_statement: 'statement',
  payslip: 'payslip',
  other_income: 'other',
  other: 'other',
};

/** The parser needs text: PDF, CSV or TXT. Photos of statements are skipped. */
const READABLE = /\.(pdf|csv|txt)$/i;
const READABLE_MIME = new Set(['application/pdf', 'text/csv', 'text/plain']);

export interface ResolvedDocuments {
  folderId: string;
  rootFolderId: string;
  documents: CreditAssessmentDocument[];
  /** Files the applicant uploaded that the assessor cannot use (images, rejected, not in Drive). */
  skipped: { name: string; reason: string }[];
  /** Required inputs that are absent, in the wording shown to the lender. */
  missing: string[];
}

/**
 * The applications folder is the same root the applicant upload route writes
 * to (`GOOGLE_DRIVE_APPLICATIONS_FOLDER_ID`, falling back to the KYC folder),
 * with one `app_<applicationId>` sub-folder per application.
 */
export function getApplicationsRootFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_APPLICATIONS_FOLDER_ID ?? process.env.GOOGLE_DRIVE_KYC_FOLDER_ID;
  if (!id) {
    throw new AppError('CONFIG_ERROR', 503, 'Google Drive applications folder is not configured (GOOGLE_DRIVE_KYC_FOLDER_ID)');
  }
  return id;
}

function isReadable(name: string, mimeType: string | null | undefined): boolean {
  return READABLE.test(name) || (!!mimeType && READABLE_MIME.has(mimeType));
}

async function findApplicationFolder(
  drive: ReturnType<typeof getDriveClient>,
  rootFolderId: string,
  applicationId: string,
): Promise<string | undefined> {
  const folderName = `app_${applicationId}`.replace(/[^a-zA-Z0-9_-]/g, '');
  const folderRes = await drive.files.list({
    q: `'${rootFolderId}' in parents and name = '${folderName}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: 'files(id)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return folderRes.data.files?.[0]?.id ?? undefined;
}

type DriveFileMeta = { name: string; mimeType?: string | null; size?: string | null };

async function listFolder(
  drive: ReturnType<typeof getDriveClient>,
  folderId: string,
): Promise<Map<string, DriveFileMeta>> {
  const inDrive = new Map<string, DriveFileMeta>();
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType,size)',
      pageSize: 200,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files ?? []) {
      if (f.id && f.name) inDrive.set(f.id, { name: f.name, mimeType: f.mimeType, size: f.size });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return inDrive;
}

/**
 * Cross-check the application's `documents[]` against what actually sits in
 * its Drive folder and turn them into the list the worker downloads. Returns
 * `missing` entries instead of throwing so the caller can report every gap at
 * once.
 *
 * `reuseFrom` carries accepted documents from a previous loan (returning
 * customer inside the evidence-reuse window); they live in that application's
 * own `app_<id>` folder under the same root, so the worker's root check still
 * holds.
 */
export async function resolveAssessmentDocuments(
  applicationId: string,
  documents: ApplicationDocument[] | undefined,
  reuseFrom: { applicationId: string; documents: ApplicationDocument[] }[] = [],
): Promise<ResolvedDocuments> {
  const rootFolderId = getApplicationsRootFolderId();
  const drive = getDriveClient();
  const skipped: { name: string; reason: string }[] = [];
  const missing: string[] = [];
  const out: CreditAssessmentDocument[] = [];

  const sources: { applicationId: string; documents: ApplicationDocument[]; label: string }[] = [
    { applicationId, documents: documents ?? [], label: '' },
    ...reuseFrom
      .filter((r) => r.applicationId !== applicationId && r.documents.length > 0)
      .map((r) => ({ ...r, label: ' (reused from a previous loan)' })),
  ];

  let folderId = '';
  for (const source of sources) {
    const sourceFolder = await findApplicationFolder(drive, rootFolderId, source.applicationId);
    if (!sourceFolder) {
      for (const doc of source.documents) {
        if (KIND_BY_TYPE[doc.type]) skipped.push({ name: doc.fileName, reason: `application Drive folder not found${source.label}` });
      }
      continue;
    }
    if (!folderId) folderId = sourceFolder;
    const inDrive = await listFolder(drive, sourceFolder);

    for (const doc of source.documents) {
      const kind = KIND_BY_TYPE[doc.type];
      if (!kind) continue; // identity documents are not part of the assessment
      if (doc.status === 'rejected') {
        skipped.push({ name: doc.fileName, reason: 'rejected by the lender' });
        continue;
      }
      const file = inDrive.get(doc.documentId);
      if (!file) {
        skipped.push({ name: doc.fileName, reason: `not found in the application Drive folder${source.label}` });
        continue;
      }
      if (!isReadable(file.name, file.mimeType)) {
        skipped.push({ name: doc.fileName, reason: 'not a PDF/CSV — the statement parser cannot read images' });
        continue;
      }
      out.push({
        driveId: doc.documentId,
        name: file.name,
        kind,
        type: doc.type,
        mimeType: file.mimeType ?? undefined,
        size: file.size ? Number(file.size) : undefined,
      });
    }
  }

  if (!folderId) {
    return {
      folderId: '',
      rootFolderId,
      documents: [],
      skipped,
      missing: ['Bank statement (PDF or CSV) — the applicant has not uploaded any documents for this application'],
    };
  }

  if (!out.some((d) => d.kind === 'statement')) {
    missing.push('Bank statement (PDF or CSV) accepted on this application (or reusable from a loan within the last 6 months) and not rejected');
  }

  return { folderId, rootFolderId, documents: out, skipped, missing };
}
