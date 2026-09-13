'use client';

import type { ReactNode } from 'react';
import type { TrainingJobStatus } from '@/types/training';

export const card = 'bg-white rounded-[14px] border border-slate-200 shadow-sm p-5';
export const inputCls =
  'h-9 rounded-[10px] border border-slate-300 bg-white px-3 text-sm text-[#1C2A3A] placeholder:text-slate-400 focus:border-[#B45600] focus:outline-none disabled:bg-slate-50';
export const textareaCls =
  'rounded-[10px] border border-slate-300 bg-white px-3 py-2 text-sm text-[#1C2A3A] placeholder:text-slate-400 focus:border-[#B45600] focus:outline-none';
export const primaryBtn =
  'inline-flex items-center justify-center h-9 px-4 rounded-[10px] bg-[#16263B] text-white text-sm font-medium hover:bg-[#0F1D2E] disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
export const secondaryBtn =
  'inline-flex items-center justify-center h-9 px-3 rounded-[10px] border border-slate-300 bg-white text-sm font-medium text-[#1C2A3A] hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
export const dangerBtn =
  'inline-flex items-center justify-center h-9 px-3 rounded-[10px] border border-red-200 bg-white text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
export const th = 'py-2 pr-4 text-left text-xs font-medium uppercase tracking-wide text-slate-500';
export const td = 'py-2 pr-4 text-sm text-[#1C2A3A] align-top';

const STATUS_STYLES: Record<TrainingJobStatus, string> = {
  queued: 'bg-slate-100 text-slate-700 border-slate-200',
  running: 'bg-amber-50 text-amber-800 border-amber-200',
  done: 'bg-green-50 text-green-700 border-green-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

export function StatusBadge({ status }: { status: TrainingJobStatus }) {
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLES[status]}`}>
      {status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />}
      {status}
    </span>
  );
}

const TONES: Record<string, string> = {
  Low: 'bg-green-50 text-green-700 border-green-200',
  Lower: 'bg-green-50 text-green-700 border-green-200',
  Approve: 'bg-green-50 text-green-700 border-green-200',
  Medium: 'bg-amber-50 text-amber-800 border-amber-200',
  Moderate: 'bg-amber-50 text-amber-800 border-amber-200',
  Conditional: 'bg-amber-50 text-amber-800 border-amber-200',
  High: 'bg-red-50 text-red-700 border-red-200',
  Critical: 'bg-red-50 text-red-700 border-red-200',
  Deny: 'bg-red-50 text-red-700 border-red-200',
};

export function Tone({ value }: { value: string }) {
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${TONES[value] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
      {value}
    </span>
  );
}

export function Notice({ error, notice, onClose }: { error: string | null; notice: string | null; onClose?: () => void }) {
  if (!error && !notice) return null;
  return (
    <div className={`flex items-start justify-between gap-3 rounded-[10px] border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
      <span>{error ?? notice}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="text-xs font-medium opacity-70 hover:opacity-100">Dismiss</button>
      )}
    </div>
  );
}

export function Section({ title, hint, actions, children }: { title: string; hint?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#16263B]">{title}</h2>
          {hint && <p className="text-xs text-slate-500 mt-1 max-w-2xl">{hint}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-tabular text-[#1C2A3A] text-right">{value}</dd>
    </div>
  );
}

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}

export function BucketTable({ title, rows }: { title: string; rows: Record<string, { n: number; bad: number; repaid_late: number; bad_rate: number | null }> }) {
  const entries = Object.entries(rows);
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{title}</h3>
      {entries.length === 0 ? (
        <Empty>No data.</Empty>
      ) : (
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className={th}>Bucket</th>
              <th className={th}>Loans</th>
              <th className={th}>Bad</th>
              <th className={th}>Late</th>
              <th className={th}>Bad rate</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([k, v]) => (
              <tr key={k} className="border-b border-slate-100 last:border-0">
                <td className={td}>{k || '—'}</td>
                <td className={`${td} font-tabular`}>{v.n}</td>
                <td className={`${td} font-tabular`}>{v.bad}</td>
                <td className={`${td} font-tabular`}>{v.repaid_late}</td>
                <td className={`${td} font-tabular`}>{v.bad_rate === null ? '—' : `${v.bad_rate}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
