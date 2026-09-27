import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { withAuth } from '@/lib/auth/middleware';
import { adminCreditAssessmentModelSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import {
  getCreditAssessmentModelSettings,
  setCreditAssessmentModel,
} from '@/lib/admin/credit-assessment-settings';
import {
  getTrainingState,
  getWorkerHeartbeat,
  isTrainingQueueConfigured,
  WORKER_STALE_MS,
} from '@/lib/training/queue';
import { isSameAssessmentModel, isValidAssessmentModel } from '@/lib/assessment/model';

export const dynamic = 'force-dynamic';

const AUDIT_ACTION = 'admin_update_credit_assessment_model';
const AUDIT_TARGET = { targetId: 'creditAssessment', targetType: 'systemConfig' } as const;

interface InstalledModel {
  name: string;
  sizeGb: number | null;
  modified: string | null;
}

interface WorkerModels {
  queueConfigured: boolean;
  workerOnline: boolean;
  models: InstalledModel[];
  /** Epoch ms the worker last published its model list, if ever. */
  publishedAt: number | null;
}

/**
 * The models installed in Ollama on the assessment machine, as last published
 * by the worker (`training:state`). Worker-supplied, so every entry is checked
 * before it is offered as a choice.
 */
async function loadWorkerModels(): Promise<WorkerModels> {
  if (!isTrainingQueueConfigured()) {
    return { queueConfigured: false, workerOnline: false, models: [], publishedAt: null };
  }
  const [state, beat] = await Promise.all([getTrainingState(), getWorkerHeartbeat()]);
  const raw: unknown[] = Array.isArray(state?.models) ? state.models : [];
  const models: InstalledModel[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const m = entry as { name?: unknown; size_gb?: unknown; modified?: unknown };
    if (!isValidAssessmentModel(m.name)) continue;
    models.push({
      name: m.name,
      sizeGb: typeof m.size_gb === 'number' ? m.size_gb : null,
      modified: typeof m.modified === 'string' ? m.modified.slice(0, 40) : null,
    });
  }
  return {
    queueConfigured: true,
    workerOnline: beat !== null && Date.now() - beat.at < WORKER_STALE_MS,
    models,
    publishedAt: typeof state?.updatedAt === 'number' ? state.updatedAt : null,
  };
}

function toMillis(v: unknown): number | null {
  return v && typeof (v as { toMillis?: () => number }).toMillis === 'function'
    ? (v as { toMillis: () => number }).toMillis()
    : null;
}

async function buildResponse(worker: WorkerModels) {
  const settings = await getCreditAssessmentModelSettings();
  const selected = settings.model;
  return {
    model: selected,
    /** False when the selected model is no longer installed on the assessment machine. */
    modelInstalled: selected === null ? null : worker.models.some((m) => isSameAssessmentModel(m.name, selected)),
    updatedAt: toMillis(settings.updatedAt),
    updatedBy: settings.updatedBy ?? null,
    queueConfigured: worker.queueConfigured,
    workerOnline: worker.workerOnline,
    availableModels: worker.models,
    modelsPublishedAt: worker.publishedAt,
  };
}

// GET /api/admin/credit-assessment — the selected model + the models installed on the worker
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const auth = await withAuth(request, ['admin']);
    const allowed = await checkRateLimit(defaultLimiter, auth.uid);
    if (!allowed) throw new AppError('RATE_LIMITED', 429, 'Too many requests.');

    return NextResponse.json({ data: await buildResponse(await loadWorkerModels()) });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error('[admin/credit-assessment GET]', err);
    return internalError();
  }
}

// PATCH /api/admin/credit-assessment — choose the model used for AI credit assessments (admin only)
export async function PATCH(request: NextRequest): Promise<Response> {
  const ip = getClientIp(request);
  let uid = 'unknown';

  try {
    const allowed = await checkRateLimit(defaultLimiter, ip);
    if (!allowed) {
      return errorResponse(new AppError('RATE_LIMITED', 429, 'Too many requests.'));
    }

    const auth = await withAuth(request, ['admin']);
    uid = auth.uid;

    const body = await request.json();
    const { model } = adminCreditAssessmentModelSchema.parse(body);

    const worker = await loadWorkerModels();

    // Only a model the worker reports as installed can be selected, so
    // assessments are never pointed at something that does not exist.
    // Reverting to the worker default (null) is always allowed.
    let resolved: string | null = null;
    if (model !== null) {
      if (worker.models.length === 0) {
        throw new AppError(
          'MODEL_LIST_UNAVAILABLE',
          503,
          'The assessment worker has not reported its installed models yet. Start the worker and try again.',
        );
      }
      const match = worker.models.find((m) => isSameAssessmentModel(m.name, model));
      if (!match) {
        throw new AppError('VALIDATION_ERROR', 422, 'That model is not installed on the assessment machine.');
      }
      resolved = match.name;
    }

    const previous = (await getCreditAssessmentModelSettings()).model;
    await setCreditAssessmentModel(resolved, uid);

    await auditLog({
      userId: uid,
      action: AUDIT_ACTION,
      ...AUDIT_TARGET,
      outcome: 'success',
      changes: { from: previous ?? 'worker_default', to: resolved ?? 'worker_default' },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    return NextResponse.json({ data: await buildResponse(worker) });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(
        new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors),
      );
    }
    if (err instanceof AppError) {
      await auditLog({
        userId: uid,
        action: AUDIT_ACTION,
        ...AUDIT_TARGET,
        outcome: 'failure',
        errorDetail: err.code,
        ipAddress: ip,
      });
      return errorResponse(err);
    }

    console.error('[admin/credit-assessment PATCH]', err);
    await auditLog({
      userId: uid,
      action: AUDIT_ACTION,
      ...AUDIT_TARGET,
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
    });
    return internalError();
  }
}
