import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getAllContent } from '@/lib/content/site-content';
import { CONTENT_SECTIONS } from '@/types/content';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';

export const dynamic = 'force-dynamic';

// GET /api/content — all editable sections (definitions + current values).
// Content editors and admins only.
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const auth = await withAuth(request, ['content_editor', 'admin']);
    await checkRateLimit(defaultLimiter, auth.uid);

    const values = await getAllContent();

    return NextResponse.json({
      data: {
        sections: CONTENT_SECTIONS,
        values,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
