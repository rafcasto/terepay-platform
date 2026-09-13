import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { withAuth } from '@/lib/auth/middleware';
import { adminTrainingJobSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import {
  enqueueTrainingJob,
  getQueueLength,
  getTrainingState,
  getWorkerHeartbeat,
  isTrainingQueueConfigured,
  listTrainingJobs,
  WORKER_STALE_MS,
} from '@/lib/training/queue';
import { resolveTrainingEntry } from '@/lib/training/drive';
import type { TrainingJobType } from '@/types/training';

export const dynamic = 'force-dynamic';

// GET /api/admin/training/jobs — job list + worker heartbeat + worker-published state.
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const auth = await withAuth(request, ['admin']);
    const allowed = await checkRateLimit(defaultLimiter, auth.uid);
    if (!allowed) throw new AppError('RATE_LIMITED', 429, 'Too many requests.');

    if (!isTrainingQueueConfigured()) {
      return NextResponse.json({
        data: { configured: false, jobs: [], queueLength: 0, worker: null, workerOnline: false, state: null },
      });
    }

    const [jobs, queueLength, worker, state] = await Promise.all([
      listTrainingJobs(),
      getQueueLength(),
      getWorkerHeartbeat(),
      getTrainingState(),
    ]);
    const workerOnline = worker !== null && Date.now() - worker.at < WORKER_STALE_MS;

    return NextResponse.json({
      data: {
        configured: true,
        driveFolderId: process.env.GOOGLE_DRIVE_TRAINING_FOLDER_ID ?? null,
        jobs,
        queueLength,
        worker,
        workerOnline,
        state,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error('[admin/training/jobs GET]', err);
    return internalError();
  }
}

// POST /api/admin/training/jobs — queue a job for the Pi worker.
export async function POST(request: NextRequest): Promise<Response> {
  const ip = getClientIp(request);
  let uid = 'unknown';
  let type: TrainingJobType | 'unknown' = 'unknown';

  try {
    const auth = await withAuth(request, ['admin']);
    uid = auth.uid;
    const allowed = await checkRateLimit(defaultLimiter, auth.uid);
    if (!allowed) throw new AppError('RATE_LIMITED', 429, 'Too many requests.');

    const body = await request.json();
    const input = adminTrainingJobSchema.parse(body);
    type = input.type;

    // Everything the worker needs, and nothing it should not trust the client for.
    let payload: Record<string, unknown>;
    switch (input.type) {
      case 'import_batch':
      case 'import_outcomes': {
        const entry = await resolveTrainingEntry(input.driveId);
        if (input.type === 'import_outcomes' && entry.kind !== 'csv') {
          throw new AppError('VALIDATION_ERROR', 422, 'Outcomes import needs a .csv file');
        }
        if (input.type === 'import_batch' && entry.kind === 'other') {
          throw new AppError('VALIDATION_ERROR', 422, 'Select a folder, a .zip batch or a .csv file');
        }
        payload = {
          driveId: entry.id,
          driveName: entry.name,
          driveKind: entry.kind,
          ...(input.type === 'import_batch' ? { replace: input.replace } : {}),
        };
        break;
      }
      case 'finetune':
        payload = input.outName ? { outName: input.outName } : {};
        break;
      case 'exam':
        payload = { model: input.model, n: input.n };
        break;
      case 'regenerate_synthetic':
        payload = { n: input.n, seed: input.seed };
        break;
      default:
        payload = {};
    }

    const job = await enqueueTrainingJob({ type: input.type, payload, createdBy: auth.email });

    await auditLog({
      userId: auth.uid,
      action: 'admin_training_job_queued',
      targetId: job.id,
      targetType: 'training_job',
      outcome: 'success',
      changes: { type: job.type, payload },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    return NextResponse.json({ data: job }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);

    console.error('[admin/training/jobs POST]', err);
    await auditLog({
      userId: uid,
      action: 'admin_training_job_queued',
      targetType: 'training_job',
      outcome: 'failure',
      changes: { type },
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
    });
    return internalError();
  }
}
