import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { assertTrainingAccess } from '@/lib/training/access';
import { assertApplicationId, deleteCaseFile, uploadCaseFile } from '@/lib/training/drive';
import type { TrainingDocKind } from '@/types/training';

export const dynamic = 'force-dynamic';

/** Vercel functions accept ~4.5 MB bodies; one document per request keeps well under it. */
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const KINDS: TrainingDocKind[] = ['statement', 'payslip', 'centrix', 'history', 'other'];
const ALLOWED_EXT = /\.(pdf|txt|csv)$/i;
const ALLOWED_MIME = new Set(['application/pdf', 'text/plain', 'text/csv', 'application/vnd.ms-excel', 'application/octet-stream', '']);

/**
 * POST /api/training/cases/upload — multipart: applicationId, kind, file.
 * Stores the document as training/cases/<applicationId>/<kind>-<n>-<name> in
 * Google Drive; the worker imports the folder on request.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const ip = getClientIp(request);
  let uid = 'unknown';

  try {
    const auth = await withAuth(request, ['admin', 'lender']);
    uid = auth.uid;
    await assertTrainingAccess(auth);
    const allowed = await checkRateLimit(defaultLimiter, auth.uid);
    if (!allowed) throw new AppError('RATE_LIMITED', 429, 'Too many requests.');

    const form = await request.formData();
    const applicationId = assertApplicationId(String(form.get('applicationId') ?? '').trim().toLowerCase());
    const kind = String(form.get('kind') ?? '') as TrainingDocKind;
    const file = form.get('file');

    if (!KINDS.includes(kind)) throw new AppError('VALIDATION_ERROR', 422, 'Unknown document kind');
    if (!(file instanceof File)) throw new AppError('VALIDATION_ERROR', 422, 'No file provided');
    if (file.size === 0) throw new AppError('VALIDATION_ERROR', 422, 'The file is empty');
    if (file.size > MAX_FILE_SIZE) throw new AppError('FILE_TOO_LARGE', 413, 'Each document must be smaller than 4 MB');
    if (!ALLOWED_EXT.test(file.name) || !ALLOWED_MIME.has(file.type)) {
      throw new AppError('INVALID_FILE_TYPE', 415, 'Only PDF, TXT and CSV documents are accepted');
    }

    const stored = await uploadCaseFile(applicationId, kind, file);

    await auditLog({
      userId: auth.uid,
      action: 'training_case_document_uploaded',
      targetId: applicationId,
      targetType: 'training_case',
      outcome: 'success',
      changes: { kind, fileName: stored.fileName, size: file.size },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    return NextResponse.json({ data: stored }, { status: 201 });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error('[training/cases/upload POST]', err);
    await auditLog({
      userId: uid,
      action: 'training_case_document_uploaded',
      targetType: 'training_case',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
    });
    return internalError();
  }
}

/** DELETE /api/training/cases/upload?applicationId=…&fileId=… — remove a document before import. */
export async function DELETE(request: NextRequest): Promise<Response> {
  const ip = getClientIp(request);
  let uid = 'unknown';
  try {
    const auth = await withAuth(request, ['admin', 'lender']);
    uid = auth.uid;
    await assertTrainingAccess(auth);
    const allowed = await checkRateLimit(defaultLimiter, auth.uid);
    if (!allowed) throw new AppError('RATE_LIMITED', 429, 'Too many requests.');

    const applicationId = assertApplicationId(String(request.nextUrl.searchParams.get('applicationId') ?? ''));
    const fileId = String(request.nextUrl.searchParams.get('fileId') ?? '');
    if (!/^[A-Za-z0-9_-]{10,}$/.test(fileId)) throw new AppError('VALIDATION_ERROR', 422, 'Invalid file id');

    await deleteCaseFile(applicationId, fileId);

    await auditLog({
      userId: auth.uid,
      action: 'training_case_document_deleted',
      targetId: applicationId,
      targetType: 'training_case',
      outcome: 'success',
      changes: { fileId },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error('[training/cases/upload DELETE]', err);
    await auditLog({ userId: uid, action: 'training_case_document_deleted', targetType: 'training_case', outcome: 'failure', errorDetail: err instanceof Error ? err.message : 'unknown', ipAddress: ip });
    return internalError();
  }
}
