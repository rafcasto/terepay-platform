import { randomUUID } from 'crypto';
import { Redis } from '@upstash/redis';
import { AppError } from '@/lib/utils/api-error';
import { getWorkerHeartbeat, WORKER_STALE_MS } from '@/lib/training/queue';
import type {
  CreditAssessmentJob,
  CreditAssessmentJobStatus,
  CreditAssessmentPayload,
  CreditAssessmentResult,
} from '@/types/credit-assessment';

/**
 * Assessment jobs share the Upstash database and the Pi worker with model
 * training, but use their own queue so a lender waiting on a decision is never
 * stuck behind a fine-tune. The worker drains `assessment:queue` first.
 */
const KEYS = {
  queue: 'assessment:queue',
  job: (id: string) => `assessment:job:${id}`,
} as const;

/** A job older than this without a result is treated as lost. */
export const ASSESSMENT_JOB_TTL_S = 7 * 24 * 3600;

let client: Redis | null | undefined;

function getRedis(): Redis {
  if (client === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    client = url && token ? new Redis({ url, token }) : null;
  }
  if (!client) {
    throw new AppError('CONFIG_ERROR', 503, 'The assessment queue is not configured (Upstash Redis)');
  }
  return client;
}

export function isAssessmentQueueConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

const STATUSES: CreditAssessmentJobStatus[] = ['queued', 'running', 'done', 'failed', 'cancelled'];

function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v !== '' && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

function parseJson<T>(v: unknown): T | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }
  return v as T;
}

function toJob(raw: Record<string, unknown> | null): CreditAssessmentJob | null {
  if (!raw || typeof raw.id !== 'string' || typeof raw.applicationId !== 'string') return null;
  const status = STATUSES.includes(raw.status as CreditAssessmentJobStatus)
    ? (raw.status as CreditAssessmentJobStatus)
    : 'queued';
  return {
    id: raw.id,
    type: 'assess_application',
    applicationId: raw.applicationId,
    status,
    payload: parseJson<CreditAssessmentPayload>(raw.payload),
    createdAt: toNumber(raw.createdAt) ?? 0,
    createdBy: typeof raw.createdBy === 'string' ? raw.createdBy : '',
    startedAt: toNumber(raw.startedAt),
    endedAt: toNumber(raw.endedAt),
    worker: typeof raw.worker === 'string' ? raw.worker : undefined,
    progress: typeof raw.progress === 'string' ? raw.progress : undefined,
    log: typeof raw.log === 'string' ? raw.log : undefined,
    result: raw.result === undefined ? undefined : parseJson<CreditAssessmentResult>(raw.result),
    error: typeof raw.error === 'string' ? raw.error : undefined,
  };
}

export async function enqueueAssessmentJob(input: {
  applicationId: string;
  payload: CreditAssessmentPayload;
  createdBy: string;
}): Promise<CreditAssessmentJob> {
  const redis = getRedis();
  const createdAt = Date.now();
  const stamp = new Date(createdAt).toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const id = `${stamp}-${randomUUID().slice(0, 8)}`;
  const job: CreditAssessmentJob = {
    id,
    type: 'assess_application',
    applicationId: input.applicationId,
    status: 'queued',
    payload: input.payload,
    createdAt,
    createdBy: input.createdBy,
  };

  await redis.hset(KEYS.job(id), {
    id,
    type: job.type,
    applicationId: job.applicationId,
    status: job.status,
    payload: JSON.stringify(job.payload),
    createdAt,
    createdBy: job.createdBy,
  });
  await redis.expire(KEYS.job(id), ASSESSMENT_JOB_TTL_S);
  await redis.lpush(KEYS.queue, id);
  return job;
}

export async function getAssessmentJob(id: string): Promise<CreditAssessmentJob | null> {
  if (!/^[0-9]{14}-[0-9a-f]{8}$/.test(id)) return null;
  const raw = await getRedis().hgetall<Record<string, unknown>>(KEYS.job(id));
  return toJob(raw);
}

export async function getAssessmentQueueLength(): Promise<number> {
  return getRedis().llen(KEYS.queue);
}

/** The Pi worker heartbeats on `training:worker`; it serves both queues. */
export async function isAssessmentWorkerOnline(): Promise<boolean> {
  const beat = await getWorkerHeartbeat();
  return beat !== null && Date.now() - beat.at < WORKER_STALE_MS;
}
