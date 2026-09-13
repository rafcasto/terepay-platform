import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { assertTrainingAccess } from '@/lib/training/access';
import { getTrainingFolderId, listCaseFiles, listTrainingFolder } from '@/lib/training/drive';

export const dynamic = 'force-dynamic';

// GET /api/training/files            — training folder root + case folders uploaded from the site
// GET /api/training/files?case=<id>  — documents already uploaded for one case
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const auth = await withAuth(request, ['admin', 'lender']);
    await assertTrainingAccess(auth);
    const allowed = await checkRateLimit(defaultLimiter, auth.uid);
    if (!allowed) throw new AppError('RATE_LIMITED', 429, 'Too many requests.');

    const caseId = request.nextUrl.searchParams.get('case');
    if (caseId) {
      if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(caseId)) throw new AppError('VALIDATION_ERROR', 422, 'Invalid application ID');
      const { folderId, files } = await listCaseFiles(caseId);
      return NextResponse.json({ data: { folderId, files } });
    }

    const folderId = getTrainingFolderId();
    const { entries, cases } = await listTrainingFolder();
    return NextResponse.json({ data: { folderId, entries, cases } });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error('[training/files GET]', err);
    return internalError();
  }
}
