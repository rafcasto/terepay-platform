import { randomUUID } from 'crypto';
import { Redis } from '@upstash/redis';
import { AppError } from '@/lib/utils/api-error';
import type { TrainingRpcOp } from '@/types/training';

/**
 * Request/reply to the Pi worker over Redis:
 *   LPUSH training:rpc {id, op, args}   →   worker SET training:rpc:<id> {ok, data|error} EX 60
 * The worker pumps this list every second, so a reply normally lands in ~1 s.
 */
const KEY_RPC = 'training:rpc';
const replyKey = (id: string) => `training:rpc:${id}`;

let client: Redis | null | undefined;
function getRedis(): Redis {
  if (client === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    client = url && token ? new Redis({ url, token }) : null;
  }
  if (!client) throw new AppError('CONFIG_ERROR', 503, 'Training queue is not configured (Upstash Redis)');
  return client;
}

type Reply<T> = { ok: true; data: T } | { ok: false; error: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function trainingRpc<T>(op: TrainingRpcOp, args: Record<string, unknown> = {}, timeoutMs = 9000): Promise<T> {
  const redis = getRedis();
  const id = randomUUID();
  await redis.lpush(KEY_RPC, JSON.stringify({ id, op, args, at: Date.now() }));

  const deadline = Date.now() + timeoutMs;
  let wait = 250;
  while (Date.now() < deadline) {
    await sleep(wait);
    wait = Math.min(wait + 100, 700);
    const raw = await redis.get<Reply<T> | string>(replyKey(id));
    if (raw === null || raw === undefined) continue;
    const reply = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Reply<T>;
    await redis.del(replyKey(id)).catch(() => undefined);
    if (reply.ok) return reply.data;
    throw new AppError('WORKER_ERROR', 400, reply.error || 'The worker rejected the request');
  }
  // Nobody answered: take the request back so it does not run later, unobserved.
  await redis.lrem(KEY_RPC, 0, JSON.stringify({ id, op, args })).catch(() => undefined);
  throw new AppError('WORKER_OFFLINE', 503, 'The assessment worker did not respond — is it running?');
}
