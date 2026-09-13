'use client';

import { useEffect, useState } from 'react';
import type {
  TrainingDriveEntry,
  TrainingJob,
  TrainingJobStatus,
  TrainingState,
  TrainingWorkerHeartbeat,
} from '@/types/training';
import { TRAINING_JOB_LABELS } from '@/types/training';

type Overview = {
  configured: boolean;
  driveFolderId: string | null;
  jobs: TrainingJob[];
  queueLength: number;
  worker: TrainingWorkerHeartbeat | null;
  workerOnline: boolean;
  state: TrainingState | null;
};

type ApiError = { error?: { message?: string } };

const STATUS_STYLES: Record<TrainingJobStatus, string> = {
  queued: 'bg-slate-100 text-slate-700 border-slate-200',
  running: 'bg-amber-50 text-amber-800 border-amber-200',
  done: 'bg-green-50 text-green-700 border-green-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

function StatusBadge({ status }: { status: TrainingJobStatus }) {
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[status]}`}>
      {status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />}
      {status}
    </span>
  );
}

function fmtTime(ms?: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland', hour12: false });
}

function fmtDuration(job: TrainingJob): string {
  const start = job.startedAt ?? job.createdAt;
  const end = job.endedAt ?? (job.status === 'running' ? Date.now() : undefined);
  if (!start || !end) return '—';
  const s = Math.max(0, Math.round((end - start) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function fmtSize(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} kB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function describePayload(job: TrainingJob): string {
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

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as ApiError;
    return body.error?.message ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

const inputCls =
  'h-9 rounded-[10px] border border-slate-300 bg-white px-3 text-sm text-[#1C2A3A] placeholder:text-slate-400 focus:border-[#B45600] focus:outline-none';
const primaryBtn =
  'inline-flex items-center justify-center h-9 px-4 rounded-[10px] bg-[#16263B] text-white text-sm font-medium hover:bg-[#0F1D2E] disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
const secondaryBtn =
  'inline-flex items-center justify-center h-9 px-3 rounded-[10px] border border-slate-300 bg-white text-sm font-medium text-[#1C2A3A] hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
const card = 'bg-white rounded-[14px] border border-slate-200 shadow-sm p-5';

export default function TrainingConsole() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [files, setFiles] = useState<TrainingDriveEntry[] | null>(null);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<TrainingJob | null>(null);

  const [replaceExisting, setReplaceExisting] = useState(true);
  const [outName, setOutName] = useState('');
  const [examModel, setExamModel] = useState('');
  const [examN, setExamN] = useState(12);
  const [synthN, setSynthN] = useState(200);
  const [synthSeed, setSynthSeed] = useState(11);

  const loadOverview = async () => {
    const res = await fetch('/api/admin/training/jobs', { cache: 'no-store' });
    if (!res.ok) {
      setError(await readError(res));
      return;
    }
    const body = (await res.json()) as { data: Overview };
    setOverview(body.data);
    setError(null);
  };

  const loadFiles = async () => {
    setFilesError(null);
    const res = await fetch('/api/admin/training/files', { cache: 'no-store' });
    if (!res.ok) {
      setFilesError(await readError(res));
      setFiles([]);
      return;
    }
    const body = (await res.json()) as { data: { entries: TrainingDriveEntry[] } };
    setFiles(body.data.entries);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot data fetch on mount
    loadOverview().catch(() => setError('Could not reach the server'));
    loadFiles().catch(() => setFilesError('Could not list the Drive folder'));
  }, []);

  // Poll faster while something is queued or running.
  const active = overview?.jobs.some((j) => j.status === 'queued' || j.status === 'running') ?? false;
  useEffect(() => {
    const id = setInterval(() => {
      loadOverview().catch(() => undefined);
    }, active ? 5000 : 20000);
    return () => clearInterval(id);
  }, [active]);

  // Keep the open job detail fresh while it runs.
  useEffect(() => {
    if (!selected || (selected.status !== 'running' && selected.status !== 'queued')) return;
    const id = setInterval(async () => {
      const res = await fetch(`/api/admin/training/jobs/${selected.id}`, { cache: 'no-store' });
      if (res.ok) {
        const body = (await res.json()) as { data: TrainingJob };
        setSelected(body.data);
      }
    }, 4000);
    return () => clearInterval(id);
  }, [selected]);

  const enqueue = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/training/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      const body = (await res.json()) as { data: TrainingJob };
      setNotice(`${TRAINING_JOB_LABELS[body.data.type]} queued (${body.data.id})`);
      await loadOverview();
    } finally {
      setBusy(false);
    }
  };

  const openJob = async (job: TrainingJob) => {
    setSelected(job);
    const res = await fetch(`/api/admin/training/jobs/${job.id}`, { cache: 'no-store' });
    if (res.ok) {
      const body = (await res.json()) as { data: TrainingJob };
      setSelected(body.data);
    }
  };

  const cancelJob = async (job: TrainingJob) => {
    if (!window.confirm(`Cancel ${TRAINING_JOB_LABELS[job.type]} ${job.id}?`)) return;
    const res = await fetch(`/api/admin/training/jobs/${job.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setError(await readError(res));
      return;
    }
    const body = (await res.json()) as { data: TrainingJob };
    setSelected((cur) => (cur?.id === job.id ? body.data : cur));
    await loadOverview();
  };

  if (overview && !overview.configured) {
    return (
      <div className={card}>
        <h2 className="font-display text-lg font-semibold text-[#16263B]">Training queue not configured</h2>
        <p className="text-sm text-slate-600 mt-2">
          Set <code className="font-mono text-xs">UPSTASH_REDIS_REST_URL</code>,{' '}
          <code className="font-mono text-xs">UPSTASH_REDIS_REST_TOKEN</code> and{' '}
          <code className="font-mono text-xs">GOOGLE_DRIVE_TRAINING_FOLDER_ID</code> in the Vercel environment, then
          start the worker on the assessment machine. See docs/MODEL_TRAINING.md.
        </p>
      </div>
    );
  }

  const worker = overview?.worker ?? null;
  const online = overview?.workerOnline ?? false;
  const state = overview?.state ?? null;
  const models = state?.models ?? [];
  const canRun = online && !busy;
  const driveUrl = overview?.driveFolderId ? `https://drive.google.com/drive/folders/${overview.driveFolderId}` : null;

  return (
    <div className="space-y-6">
      {(error || notice) && (
        <div
          className={`rounded-[10px] border px-4 py-3 text-sm ${
            error ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'
          }`}
        >
          {error ?? notice}
        </div>
      )}

      {/* Worker + data status */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className={card}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#16263B]">Assessment worker</h2>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${
                online ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`} />
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Host</dt><dd className="text-[#1C2A3A]">{worker?.host ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Last seen</dt><dd className="text-[#1C2A3A]">{fmtTime(worker?.at)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Drive access</dt><dd className="text-[#1C2A3A]">{worker ? (worker.drive ? 'Configured' : 'Missing') : '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Queued</dt><dd className="text-[#1C2A3A] font-tabular">{overview?.queueLength ?? 0}</dd></div>
          </dl>
          {!online && (
            <p className="mt-3 text-xs text-slate-500">
              Start it on the assessment machine: <code className="font-mono">systemctl --user start terepay-worker</code>
            </p>
          )}
        </div>

        <div className={card}>
          <h2 className="text-sm font-semibold text-[#16263B]">Cases and dataset</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Real cases imported</dt><dd className="font-tabular text-[#1C2A3A]">{state?.dataset.real_cases ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">With officer label</dt><dd className="font-tabular text-[#1C2A3A]">{state?.dataset.real ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Training examples</dt><dd className="font-tabular text-[#1C2A3A]">{state?.dataset.stats?.examples ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Dataset built</dt><dd className="text-[#1C2A3A]">{state?.dataset.stats?.built_at ? fmtTime(Date.parse(state.dataset.stats.built_at)) : 'never'}</dd></div>
          </dl>
        </div>

        <div className={card}>
          <h2 className="text-sm font-semibold text-[#16263B]">Backtest</h2>
          {state?.backtest ? (
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Funded loans with outcome</dt><dd className="font-tabular text-[#1C2A3A]">{state.backtest.with_outcome}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Base bad rate</dt><dd className="font-tabular text-[#1C2A3A]">{state.backtest.base_bad_rate ?? '—'}%</dd></div>
              {Object.entries(state.backtest.by_recommendation).map(([k, v]) => (
                <div key={k} className="flex justify-between"><dt className="text-slate-500">Engine {k}</dt><dd className="font-tabular text-[#1C2A3A]">{v.n} loans, {v.bad_rate ?? '—'}% bad</dd></div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Import cases with outcomes, then run a backtest.</p>
          )}
        </div>
      </section>

      {/* Drive folder */}
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#16263B]">Training data (Google Drive)</h2>
            <p className="text-xs text-slate-500 mt-1">
              Drop a folder per application (statements, payslips, history note) plus an <code className="font-mono">applications.csv</code>,
              or a .zip of the same, into the shared folder. Files never pass through this site; the worker pulls them directly.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {driveUrl && (
              <a href={driveUrl} target="_blank" rel="noopener noreferrer" className={secondaryBtn}>
                Open folder
              </a>
            )}
            <button type="button" onClick={() => loadFiles().catch(() => setFilesError('Could not list the Drive folder'))} className={secondaryBtn}>
              Refresh
            </button>
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-[#1C2A3A]">
          <input type="checkbox" checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          Replace cases that already exist with the same application ID
        </label>

        {filesError && <p className="mt-3 text-sm text-red-700">{filesError}</p>}
        {files === null && !filesError && <p className="mt-3 text-sm text-slate-500">Loading folder…</p>}
        {files !== null && files.length === 0 && !filesError && (
          <p className="mt-3 text-sm text-slate-500">The folder is empty.</p>
        )}
        {files !== null && files.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Size</th>
                  <th className="py-2 pr-4 font-medium">Modified</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4 text-[#1C2A3A]">{f.name}</td>
                    <td className="py-2 pr-4 text-slate-500">{f.kind}</td>
                    <td className="py-2 pr-4 text-slate-500 font-tabular">{fmtSize(f.size)}</td>
                    <td className="py-2 pr-4 text-slate-500">{f.modifiedTime ? fmtTime(Date.parse(f.modifiedTime)) : ''}</td>
                    <td className="py-2 text-right">
                      {(f.kind === 'folder' || f.kind === 'zip') && (
                        <button type="button" disabled={!canRun} onClick={() => enqueue({ type: 'import_batch', driveId: f.id, replace: replaceExisting })} className={secondaryBtn}>
                          Import cases
                        </button>
                      )}
                      {f.kind === 'csv' && (
                        <button type="button" disabled={!canRun} onClick={() => enqueue({ type: 'import_outcomes', driveId: f.id })} className={secondaryBtn}>
                          Import outcomes
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Actions */}
      <section className={card}>
        <h2 className="text-sm font-semibold text-[#16263B]">Run</h2>
        <p className="text-xs text-slate-500 mt-1">Order that makes sense: import → backtest → (label cases on the worker console) → build dataset → fine-tune → exam.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-[10px] border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[#1C2A3A]">Backtest</p>
                <p className="text-xs text-slate-500">Rules engine vs. what actually happened. Instant, no model involved.</p>
              </div>
              <button type="button" disabled={!canRun} onClick={() => enqueue({ type: 'backtest' })} className={primaryBtn}>Run</button>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <div>
                <p className="text-sm font-medium text-[#1C2A3A]">Build dataset</p>
                <p className="text-xs text-slate-500">Synthetic gold + reviewed edits + real labelled cases (×3) → train.jsonl.</p>
              </div>
              <button type="button" disabled={!canRun} onClick={() => enqueue({ type: 'build_dataset' })} className={primaryBtn}>Run</button>
            </div>
            <div className="flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-[#1C2A3A]">Fine-tune</p>
                <p className="text-xs text-slate-500 mb-2">Needs a built dataset and a GPU host configured on the worker ({state?.settings.gpu_mode ?? '—'}{state?.settings.ssh_host_set ? ', SSH host set' : ''}).</p>
                <input value={outName} onChange={(e) => setOutName(e.target.value)} placeholder={state?.settings.ollama_name ?? 'terepay-analyst'} className={`${inputCls} w-full`} />
              </div>
              <button type="button" disabled={!canRun || !state?.dataset.has_train} onClick={() => enqueue({ type: 'finetune', ...(outName ? { outName } : {}) })} className={primaryBtn}>Run</button>
            </div>
          </div>

          <div className="rounded-[10px] border border-slate-200 p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-[#1C2A3A]">Exam</p>
              <p className="text-xs text-slate-500 mb-2">Score a model on held-out cases. Run before and after a fine-tune.</p>
              <div className="flex flex-wrap items-center gap-2">
                <select value={examModel} onChange={(e) => setExamModel(e.target.value)} className={`${inputCls} flex-1 min-w-40`}>
                  <option value="">Select model…</option>
                  {models.map((m) => (
                    <option key={m.name} value={m.name}>{m.name} ({m.size_gb} GB)</option>
                  ))}
                </select>
                <input type="number" min={1} max={200} value={examN} onChange={(e) => setExamN(Number(e.target.value))} className={`${inputCls} w-20`} aria-label="Number of cases" />
                <button type="button" disabled={!canRun || !examModel} onClick={() => enqueue({ type: 'exam', model: examModel, n: examN })} className={primaryBtn}>Run</button>
              </div>
            </div>
            <div className="border-t border-slate-100 pt-3">
              <p className="text-sm font-medium text-[#1C2A3A]">Regenerate synthetic cases</p>
              <p className="text-xs text-slate-500 mb-2">Rebuilds the synthetic set and gold answers. Existing reviews of replaced cases no longer apply.</p>
              <div className="flex flex-wrap items-center gap-2">
                <input type="number" min={10} max={2000} value={synthN} onChange={(e) => setSynthN(Number(e.target.value))} className={`${inputCls} w-24`} aria-label="Number of cases" />
                <input type="number" min={0} value={synthSeed} onChange={(e) => setSynthSeed(Number(e.target.value))} className={`${inputCls} w-24`} aria-label="Seed" />
                <button type="button" disabled={!canRun} onClick={() => enqueue({ type: 'regenerate_synthetic', n: synthN, seed: synthSeed })} className={secondaryBtn}>Run</button>
              </div>
            </div>
            {state?.exams && state.exams.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Latest exams</p>
                <ul className="mt-1 space-y-1 text-xs text-[#1C2A3A]">
                  {state.exams.slice(0, 5).map((e, i) => (
                    <li key={i} className="font-mono truncate">{JSON.stringify(e)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Jobs */}
      <section className={card}>
        <h2 className="text-sm font-semibold text-[#16263B]">Jobs</h2>
        {!overview && <p className="mt-3 text-sm text-slate-500">Loading…</p>}
        {overview && overview.jobs.length === 0 && <p className="mt-3 text-sm text-slate-500">No jobs yet.</p>}
        {overview && overview.jobs.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4 font-medium">Job</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Queued</th>
                  <th className="py-2 pr-4 font-medium">Duration</th>
                  <th className="py-2 pr-4 font-medium">By</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {overview.jobs.map((j) => (
                  <tr key={j.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => openJob(j)}>
                    <td className="py-2 pr-4">
                      <span className="text-[#1C2A3A] font-medium">{TRAINING_JOB_LABELS[j.type]}</span>
                      <span className="block text-xs text-slate-500 truncate max-w-xs">{describePayload(j)}</span>
                    </td>
                    <td className="py-2 pr-4"><StatusBadge status={j.status} /></td>
                    <td className="py-2 pr-4 text-slate-500 whitespace-nowrap">{fmtTime(j.createdAt)}</td>
                    <td className="py-2 pr-4 text-slate-500 font-tabular">{fmtDuration(j)}</td>
                    <td className="py-2 pr-4 text-slate-500 truncate max-w-40">{j.createdBy}</td>
                    <td className="py-2 text-right">
                      {(j.status === 'queued' || j.status === 'running') && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); cancelJob(j); }} className="text-xs font-medium text-red-700 hover:text-red-800">
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Job detail */}
      {selected && (
        <section className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[#16263B]">
                {TRAINING_JOB_LABELS[selected.type]} <span className="font-mono text-xs text-slate-500">{selected.id}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                <StatusBadge status={selected.status} /> · {describePayload(selected)} · started {fmtTime(selected.startedAt)} · {fmtDuration(selected)}
                {selected.worker ? ` · on ${selected.worker}` : ''}
              </p>
            </div>
            <button type="button" onClick={() => setSelected(null)} className={secondaryBtn}>Close</button>
          </div>
          {selected.error && <p className="mt-3 text-sm text-red-700">{selected.error}</p>}
          <pre className="mt-3 max-h-80 overflow-auto rounded-[10px] bg-[#0F1D2E] p-4 text-xs text-slate-200 font-mono whitespace-pre-wrap">
            {selected.log?.trim() || (selected.status === 'queued' ? 'Waiting for the worker…' : 'No log output.')}
          </pre>
          {selected.result !== undefined && selected.result !== null && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-[#1C2A3A]">Result</summary>
              <pre className="mt-2 max-h-96 overflow-auto rounded-[10px] bg-slate-50 border border-slate-200 p-4 text-xs font-mono text-[#1C2A3A]">
                {JSON.stringify(selected.result, null, 2)}
              </pre>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
