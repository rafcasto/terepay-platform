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

/**
 * Cross-check the application's `documents[]` against what actually sits in
 * its Drive folder and turn them into the list the worker downloads. Returns
 * `missing` entries instead of throwing so the caller can report every gap at
 * once.
 */
export async function resolveAssessmentDocuments(
  applicationId: string,
  documents: ApplicationDocument[] | undefined,
): Promise<ResolvedDocuments> {
  const rootFolderId = getApplicationsRootFolderId();
  const drive = getDriveClient();
  const folderName = `app_${applicationId}`.replace(/[^a-zA-Z0-9_-]/g, '');
  const skipped: { name: string; reason: string }[] = [];
  const missing: string[] = [];

  const folderRes = await drive.files.list({
    q: `'${rootFolderId}' in parents and name = '${folderName}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: 'files(id)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const folderId = folderRes.data.files?.[0]?.id;
  if (!folderId) {
    return {
      folderId: '',
      rootFolderId,
      documents: [],
      skipped,
      missing: ['Bank statement (PDF or CSV) — the applicant has not uploaded any documents for this application'],
    };
  }

  const inDrive = new Map<string, { name: string; mimeType?: string | null; size?: string | null }>();
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

  const out: CreditAssessmentDocument[] = [];
  for (const doc of documents ?? []) {
    const kind = KIND_BY_TYPE[doc.type];
    if (!kind) continue; // identity documents are not part of the assessment
    if (doc.status === 'rejected') {
      skipped.push({ name: doc.fileName, reason: 'rejected by the lender' });
      continue;
    }
    const file = inDrive.get(doc.documentId);
    if (!file) {
      skipped.push({ name: doc.fileName, reason: 'not found in the application Drive folder' });
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

  if (!out.some((d) => d.kind === 'statement')) {
    missing.push('Bank statement (PDF or CSV) uploaded to this application and not rejected');
  }

  return { folderId, rootFolderId, documents: out, skipped, missing };
}
