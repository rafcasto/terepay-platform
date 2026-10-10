import { randomUUID } from 'crypto';
import { Redis } from '@upstash/redis';
import { AppError } from '@/lib/utils/api-error';
import type {
  TrainingJob,
  TrainingJobStatus,
  TrainingJobType,
  TrainingState,
  TrainingWorkerHeartbeat,
} from '@/types/training';

const KEYS = {
  queue: 'training:queue',
  jobs: 'training:jobs',
  job: (id: string) => `training:job:${id}`,
  worker: 'training:worker',
  state: 'training:state',
} as const;

/** Heartbeats older than this mean the Pi worker is offline. */
export const WORKER_STALE_MS = 90_000;
const LIST_LIMIT = 50;

let client: Redis | null | undefined;

function getRedis(): Redis {
  if (client === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    client = url && token ? new Redis({ url, token }) : null;
  }
  if (!client) {
    throw new AppError('CONFIG_ERROR', 503, 'Training queue is not configured (Upstash Redis)');
  }
  return client;
}

const STATUSES: TrainingJobStatus[] = ['queued', 'running', 'done', 'failed', 'cancelled'];

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

/** Normalise the raw hash the worker and this module write into a typed record. */
function toJob(raw: Record<string, unknown> | null): TrainingJob | null {
  if (!raw || typeof raw.id !== 'string' || typeof raw.type !== 'string') return null;
  const status = STATUSES.includes(raw.status as TrainingJobStatus) ? (raw.status as TrainingJobStatus) : 'queued';
  return {
    id: raw.id,
    type: raw.type as TrainingJobType,
    status,
    payload: parseJson<Record<string, unknown>>(raw.payload) ?? {},
    createdAt: toNumber(raw.createdAt) ?? 0,
    createdBy: typeof raw.createdBy === 'string' ? raw.createdBy : '',
    startedAt: toNumber(raw.startedAt),
    endedAt: toNumber(raw.endedAt),
    worker: typeof raw.worker === 'string' ? raw.worker : undefined,
    progress: typeof raw.progress === 'string' ? raw.progress : undefined,
    log: typeof raw.log === 'string' ? raw.log : undefined,
    result: raw.result === undefined ? undefined : parseJson<unknown>(raw.result),
    error: typeof raw.error === 'string' ? raw.error : undefined,
    cancel: toNumber(raw.cancel),
  };
}

export async function enqueueTrainingJob(input: {
  type: TrainingJobType;
  payload: Record<string, unknown>;
  createdBy: string;
}): Promise<TrainingJob> {
  const redis = getRedis();
  const createdAt = Date.now();
  const stamp = new Date(createdAt).toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const id = `${stamp}-${randomUUID().slice(0, 8)}`;
  const job: TrainingJob = { id, type: input.type, status: 'queued', payload: input.payload, createdAt, createdBy: input.createdBy };

  await redis.hset(KEYS.job(id), {
    id,
    type: job.type,
    status: job.status,
    payload: JSON.stringify(job.payload),
    createdAt,
    createdBy: job.createdBy,
  });
  await redis.zadd(KEYS.jobs, { score: createdAt, member: id });
  await redis.lpush(KEYS.queue, id);
  return job;
}

export async function getTrainingJob(id: string): Promise<TrainingJob | null> {
  const raw = await getRedis().hgetall<Record<string, unknown>>(KEYS.job(id));
  return toJob(raw);
}

export async function listTrainingJobs(limit = LIST_LIMIT): Promise<TrainingJob[]> {
  const redis = getRedis();
  const ids = await redis.zrange<string[]>(KEYS.jobs, 0, Math.max(0, limit - 1), { rev: true });
  if (ids.length === 0) return [];
  const pipeline = redis.pipeline();
  for (const id of ids) pipeline.hgetall<Record<string, unknown>>(KEYS.job(id));
  const rows = await pipeline.exec<(Record<string, unknown> | null)[]>();
  return rows
    .map((row) => toJob(row))
    .filter((j): j is TrainingJob => j !== null)
    // Listing is for humans: keep the log out of it (fetched per job).
    .map((j) => ({ ...j, log: undefined }));
}

/**
 * Cancel a job. Queued jobs are removed from the queue immediately; running
 * jobs get a cancel flag the worker checks between steps (spawned processes
 * are killed).
 */
export async function cancelTrainingJob(id: string): Promise<TrainingJob | null> {
  const redis = getRedis();
  const job = await getTrainingJob(id);
  if (!job) return null;
  if (job.status === 'queued') {
    await redis.lrem(KEYS.queue, 0, id);
    await redis.hset(KEYS.job(id), { status: 'cancelled', cancel: 1, endedAt: Date.now() });
  } else if (job.status === 'running') {
    await redis.hset(KEYS.job(id), { cancel: 1 });
  }
  return getTrainingJob(id);
}

export async function getQueueLength(): Promise<number> {
  return getRedis().llen(KEYS.queue);
}

export async function getWorkerHeartbeat(): Promise<TrainingWorkerHeartbeat | null> {
  const raw = await getRedis().get<unknown>(KEYS.worker);
  return parseJson<TrainingWorkerHeartbeat>(raw);
}

export async function getTrainingState(): Promise<TrainingState | null> {
  const raw = await getRedis().get<unknown>(KEYS.state);
  return parseJson<TrainingState>(raw);
}

export function isTrainingQueueConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}
