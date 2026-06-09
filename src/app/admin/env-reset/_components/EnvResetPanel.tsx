'use client';

import { useState } from 'react';

const COLLECTIONS_WIPED = [
  'loanApplications',
  'loans',
  'payments',
  'auditLogs',
  'offlineCustomers',
  'notifications',
  'benchmarks',
];

const COLLECTIONS_KEPT = [
  'users (admin only)',
  'siteSettings',
  'adminConfig',
  'emailTemplates',
];

const CONFIRM_PHRASE = 'RESET ENVIRONMENT';

type ResetSummary = Record<string, number>;

export default function EnvResetPanel() {
  const [confirmInput, setConfirmInput] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ResetSummary | null>(null);

  const confirmed = confirmInput === CONFIRM_PHRASE;

  const handleReset = async () => {
    if (!confirmed) return;

    setRunning(true);
    setError(null);
    setSummary(null);

    try {
      const res = await fetch('/api/admin/env-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-reset-confirmation': CONFIRM_PHRASE,
        },
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.error?.message ?? 'Reset failed');
      }

      setSummary(json.data.summary);
      setConfirmInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* What will happen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="tp-card p-5">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-3">
            Will be deleted
          </p>
          <ul className="space-y-1.5">
            {[...COLLECTIONS_WIPED, 'All non-admin Firebase Auth accounts'].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                <svg className="h-3.5 w-3.5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="font-mono text-xs">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="tp-card p-5">
          <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-3">
            Will be preserved
          </p>
          <ul className="space-y-1.5">
            {[...COLLECTIONS_KEPT, 'All admin Firebase Auth accounts'].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                <svg className="h-3.5 w-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span className="font-mono text-xs">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Result summary */}
      {summary && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5">
          <p className="text-sm font-semibold text-green-800 mb-3">Reset complete</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(summary).map(([key, count]) => (
              <div key={key} className="bg-white rounded-lg px-3 py-2.5">
                <p className="text-xs text-slate-500 font-mono">{key}</p>
                <p className="font-tabular text-lg font-semibold text-[#16263B]">{count.toLocaleString()}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-green-700 mt-3">
            The environment has been reset. Admin accounts and configuration are intact.
          </p>
        </div>
      )}

      {/* Confirmation + trigger */}
      <div className="tp-card p-6">
        <p className="text-sm font-semibold text-[#16263B] mb-1">Confirm reset</p>
        <p className="text-xs text-slate-500 mb-4">
          Type <span className="font-mono font-semibold text-red-600">{CONFIRM_PHRASE}</span> below to enable the reset button.
        </p>

        <input
          type="text"
          value={confirmInput}
          onChange={(e) => setConfirmInput(e.target.value)}
          placeholder={CONFIRM_PHRASE}
          disabled={running}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-300 disabled:bg-slate-50 disabled:text-slate-400 mb-4"
        />

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleReset}
          disabled={!confirmed || running}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Resetting…
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              Reset Environment
            </>
          )}
        </button>
      </div>
    </div>
  );
}
