import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { cancelTrainingJob, getTrainingJob } from '@/lib/training/queue';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const JOB_ID = /^[A-Za-z0-9-]{8,64}$/;

// GET /api/admin/training/jobs/[id] — full job record including log tail and result.
export async function GET(request: NextRequest, { params }: RouteParams): Promise<Response> {
  try {
    const auth = await withAuth(request, ['admin']);
    const allowed = await checkRateLimit(defaultLimiter, auth.uid);
    if (!allowed) throw new AppError('RATE_LIMITED', 429, 'Too many requests.');

    const { id } = await params;
    if (!JOB_ID.test(id)) throw new AppError('VALIDATION_ERROR', 422, 'Invalid job id');

    const job = await getTrainingJob(id);
    if (!job) throw new AppError('NOT_FOUND', 404, 'Job not found');

    return NextResponse.json({ data: job });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error('[admin/training/jobs/[id] GET]', err);
    return internalError();
  }
}

// DELETE /api/admin/training/jobs/[id] — cancel a queued or running job.
export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const ip = getClientIp(request);
  let uid = 'unknown';
  let jobId = 'unknown';

  try {
    const auth = await withAuth(request, ['admin']);
    uid = auth.uid;
    const allowed = await checkRateLimit(defaultLimiter, auth.uid);
    if (!allowed) throw new AppError('RATE_LIMITED', 429, 'Too many requests.');

    const { id } = await params;
    if (!JOB_ID.test(id)) throw new AppError('VALIDATION_ERROR', 422, 'Invalid job id');
    jobId = id;

    const job = await cancelTrainingJob(id);
    if (!job) throw new AppError('NOT_FOUND', 404, 'Job not found');

    await auditLog({
      userId: auth.uid,
      action: 'admin_training_job_cancelled',
      targetId: id,
      targetType: 'training_job',
      outcome: 'success',
      changes: { type: job.type, status: job.status },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    return NextResponse.json({ data: job });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);

    console.error('[admin/training/jobs/[id] DELETE]', err);
    await auditLog({
      userId: uid,
      action: 'admin_training_job_cancelled',
      targetId: jobId,
      targetType: 'training_job',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
    });
    return internalError();
  }
}
