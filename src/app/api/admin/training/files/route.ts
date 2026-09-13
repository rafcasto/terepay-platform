import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { getTrainingFolderId, listTrainingFolder } from '@/lib/training/drive';

export const dynamic = 'force-dynamic';

// GET /api/admin/training/files — what is currently in the Google Drive training folder.
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const auth = await withAuth(request, ['admin']);
    const allowed = await checkRateLimit(defaultLimiter, auth.uid);
    if (!allowed) throw new AppError('RATE_LIMITED', 429, 'Too many requests.');

    const folderId = getTrainingFolderId();
    const entries = await listTrainingFolder();

    return NextResponse.json({ data: { folderId, entries } });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error('[admin/training/files GET]', err);
    return internalError();
  }
}
