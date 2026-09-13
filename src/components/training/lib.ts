import type { TrainingJob, TrainingRpcOp } from '@/types/training';

type ApiError = { error?: { message?: string; details?: unknown } };

export async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as ApiError;
    return body.error?.message ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { data: T };
  return body.data;
}

export async function apiSend<T>(url: string, method: 'POST' | 'DELETE' | 'PATCH', payload?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: payload === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { data: T };
  return body.data;
}

/** Ask the worker for console data (cases, labels, gold, backtest, exams, settings). */
export function rpc<T>(op: TrainingRpcOp, args: Record<string, unknown> = {}): Promise<T> {
  return apiSend<T>('/api/training/rpc', 'POST', { op, ...args });
}

export function enqueueJob(payload: Record<string, unknown>): Promise<TrainingJob> {
  return apiSend<TrainingJob>('/api/training/jobs', 'POST', payload);
}

export function fmtTime(ms?: number | null): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland', hour12: false });
}

export function fmtDuration(job: TrainingJob): string {
  const start = job.startedAt ?? job.createdAt;
  const end = job.endedAt ?? (job.status === 'running' ? Date.now() : undefined);
  if (!start || !end) return '—';
  const s = Math.max(0, Math.round((end - start) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function fmtSize(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} kB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `$${n.toLocaleString('en-NZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function pct(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

export function describePayload(job: TrainingJob): string {
  const p = job.payload;
  switch (job.type) {
    case 'import_batch':
    case 'import_outcomes':
      return `${String(p.driveName ?? p.driveId ?? '')}${p.replace === false ? ' (keep existing)' : ''}`;
    case 'finetune':
      return p.outName ? `→ ${String(p.outName)}` : '';
    case 'exam':
      return `${String(p.model ?? '')}, ${String(p.n ?? '')} cases`;
    case 'regenerate_synthetic':
      return `n=${String(p.n ?? '')}, seed=${String(p.seed ?? '')}`;
    default:
      return '';
  }
}

/** Human labels for the engine's judgement keys. */
export function judgementLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}
