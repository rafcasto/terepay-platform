import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';

export const dynamic = 'force-dynamic';

// GET /api/admin/applications — list all loan applications (admin view)
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const auth = await withAuth(request, ['admin']);
    await checkRateLimit(defaultLimiter, auth.uid);

    const url = new URL(request.url);
    const limitParam = Math.min(parseInt(url.searchParams.get('limit') ?? '200', 10), 500);

    const snap = await adminDb
      .collection('loanApplications')
      .orderBy('timeline.createdAt', 'desc')
      .limit(limitParam)
      .get();

    const applications = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        applicantId: d.applicantId,
        status: d.status,
        requestedAmount: d.loanDetails?.requestedAmount ?? null,
        assignedLenderId: d.assignedLenderId ?? null,
        submittedAt: d.timeline?.submittedAt?.toMillis?.() ?? null,
      };
    });

    return NextResponse.json({ data: applications });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
