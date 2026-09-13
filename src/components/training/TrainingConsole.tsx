'use client';

import { useEffect, useState } from 'react';
import type { TrainingJob, TrainingState, TrainingWorkerHeartbeat } from '@/types/training';
import { apiGet, fmtTime } from './lib';
import { card, Notice } from './ui';
import CasesTab from './CasesTab';
import BacktestTab from './BacktestTab';
import GoldTab from './GoldTab';
import DatasetTab from './DatasetTab';
import ExamsTab from './ExamsTab';
import JobsTab from './JobsTab';
import SettingsTab from './SettingsTab';

export type Overview = {
  configured: boolean;
  isAdmin: boolean;
  driveFolderId: string | null;
  jobs: TrainingJob[];
  queueLength: number;
  worker: TrainingWorkerHeartbeat | null;
  workerOnline: boolean;
  state: TrainingState | null;
};

export type TabProps = {
  overview: Overview;
  refresh: () => Promise<void>;
  notify: (msg: string) => void;
  fail: (msg: string) => void;
};

type TabKey = 'cases' | 'backtest' | 'gold' | 'dataset' | 'exams' | 'jobs' | 'settings';

const TABS: { key: TabKey; label: string; adminOnly?: boolean }[] = [
  { key: 'cases', label: 'Cases' },
  { key: 'backtest', label: 'Backtest' },
  { key: 'gold', label: 'Gold review' },
  { key: 'dataset', label: 'Dataset & fine-tune' },
  { key: 'exams', label: 'Exams' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'settings', label: 'Settings', adminOnly: true },
];

export default function TrainingConsole() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tab, setTab] = useState<TabKey>('cases');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setOverview(await apiGet<Overview>('/api/training/jobs'));
      setError((e) => (e && e.startsWith('Could not reach') ? null : e));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the server');
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot data fetch on mount
    refresh();
  }, []);

  const active = overview?.jobs.some((j) => j.status === 'queued' || j.status === 'running') ?? false;
  useEffect(() => {
    const id = setInterval(() => { refresh(); }, active ? 5000 : 20000);
    return () => clearInterval(id);
  }, [active]);

  if (overview && !overview.configured) {
    return (
      <div className={card}>
        <h2 className="font-display text-lg font-semibold text-[#16263B]">Training queue not configured</h2>
        <p className="text-sm text-slate-600 mt-2">
          Set <code className="font-mono text-xs">UPSTASH_REDIS_REST_URL</code>, <code className="font-mono text-xs">UPSTASH_REDIS_REST_TOKEN</code> and{' '}
          <code className="font-mono text-xs">GOOGLE_DRIVE_TRAINING_FOLDER_ID</code> in the Vercel environment, then start the worker on the assessment machine.
        </p>
      </div>
    );
  }

  const worker = overview?.worker ?? null;
  const online = overview?.workerOnline ?? false;
  const state = overview?.state ?? null;
  const running = overview?.jobs.find((j) => j.status === 'running');
  const tabProps: TabProps | null = overview
    ? { overview, refresh, notify: (m) => { setNotice(m); setError(null); }, fail: (m) => { setError(m); setNotice(null); } }
    : null;

  return (
    <div className="space-y-5">
      {/* Status bar */}
      <div className={`${card} py-4`}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${online ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`} />
            Worker {online ? 'online' : 'offline'}
          </span>
          <span className="text-slate-500">Host <span className="text-[#1C2A3A]">{worker?.host ?? '—'}</span></span>
          <span className="text-slate-500">Last seen <span className="text-[#1C2A3A]">{fmtTime(worker?.at)}</span></span>
          <span className="text-slate-500">Cases <span className="font-tabular text-[#1C2A3A]">{state?.dataset.real_cases ?? '—'}</span></span>
          <span className="text-slate-500">Labelled <span className="font-tabular text-[#1C2A3A]">{state?.dataset.real ?? '—'}</span></span>
          <span className="text-slate-500">Queued <span className="font-tabular text-[#1C2A3A]">{overview?.queueLength ?? 0}</span></span>
          {running && (
            <span className="text-amber-800">
              Running: {running.type.replace(/_/g, ' ')}{running.progress ? ` — ${running.progress}` : ''}
            </span>
          )}
          {!online && overview && (
            <span className="text-xs text-slate-500">On the assessment machine: <code className="font-mono">systemctl --user start terepay-worker</code></span>
          )}
        </div>
      </div>

      <Notice error={error} notice={notice} onClose={() => { setError(null); setNotice(null); }} />

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex flex-wrap gap-1" aria-label="Training sections">
          {TABS.filter((t) => !t.adminOnly || overview?.isAdmin).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-[#B45600] text-[#B45600]' : 'border-transparent text-slate-500 hover:text-[#1C2A3A] hover:border-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {!tabProps && <p className="text-sm text-slate-500">Loading…</p>}
      {tabProps && tab === 'cases' && <CasesTab {...tabProps} />}
      {tabProps && tab === 'backtest' && <BacktestTab {...tabProps} />}
      {tabProps && tab === 'gold' && <GoldTab {...tabProps} />}
      {tabProps && tab === 'dataset' && <DatasetTab {...tabProps} />}
      {tabProps && tab === 'exams' && <ExamsTab {...tabProps} />}
      {tabProps && tab === 'jobs' && <JobsTab {...tabProps} />}
      {tabProps && tab === 'settings' && overview?.isAdmin && <SettingsTab {...tabProps} />}
    </div>
  );
}
