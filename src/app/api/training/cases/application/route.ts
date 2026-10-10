import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { withAuth } from '@/lib/auth/middleware';
import { trainingCaseApplicationSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { assertTrainingAccess } from '@/lib/training/access';
import { writeCaseApplication } from '@/lib/training/drive';

export const dynamic = 'force-dynamic';

/**
 * POST /api/training/cases/application — save the declared figures and
 * outcome for a case as application.json in its Drive folder. Returns the
 * case folder id so the client can queue an import for it.
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

    const body = await request.json();
    const { applicationId, application } = trainingCaseApplicationSchema.parse(body);

    // Drop blanks so the worker's normaliser treats them as "not declared".
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(application)) {
      if (v === undefined || v === null || v === '') continue;
      clean[k] = v;
    }

    const { folderId } = await writeCaseApplication(applicationId, clean);

    await auditLog({
      userId: auth.uid,
      action: 'training_case_application_saved',
      targetId: applicationId,
      targetType: 'training_case',
      outcome: 'success',
      changes: { fields: Object.keys(clean) },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    return NextResponse.json({ data: { applicationId, folderId } });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);
    console.error('[training/cases/application POST]', err);
    await auditLog({ userId: uid, action: 'training_case_application_saved', targetType: 'training_case', outcome: 'failure', errorDetail: err instanceof Error ? err.message : 'unknown', ipAddress: ip });
    return internalError();
  }
}
