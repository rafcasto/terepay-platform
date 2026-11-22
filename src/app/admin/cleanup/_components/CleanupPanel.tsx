'use client';

import { useEffect, useState } from 'react';
import { fmtDate } from '@/lib/loan/format';
import type { CleanupApplication, CleanupBorrower } from '@/lib/admin/cleanup';

const CONFIRM_PHRASE = 'DELETE DATA';

type Tab = 'borrowers' | 'applications';

type RunResult = {
  borrowers: { uid: string; email: string | null; applications: number; authUserDeleted: boolean }[];
  applications: { applicationId: string; status: string }[];
  refused: { id: string; kind: 'borrower' | 'application'; reason: string }[];
};

const fmtNzd = (n: number) =>
  new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(n);

function StatusBadge({ status, live }: { status: string; live?: boolean }) {
  const cls = live
    ? 'bg-emerald-100 text-emerald-700'
    : status === 'declined' || status === 'rejected' || status === 'offer_declined'
      ? 'bg-red-100 text-red-600'
      : status === 'closed_repaid'
        ? 'bg-slate-200 text-slate-700'
        : 'bg-slate-100 text-slate-500';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function CleanupPanel() {
  const [tab, setTab] = useState<Tab>('borrowers');
  const [borrowers, setBorrowers] = useState<CleanupBorrower[]>([]);
  const [applications, setApplications] = useState<CleanupApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set());
  const [includeLive, setIncludeLive] = useState(false);

  const [confirming, setConfirming] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch('/api/admin/cleanup')
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error?.message ?? `Server error ${r.status}`);
        return json;
      })
      .then((json) => {
        setBorrowers(json.data?.borrowers ?? []);
        setApplications(json.data?.applications ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load data'))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot data fetch on mount
  useEffect(() => { load(); }, []);

  const q = filter.trim().toLowerCase();
  const visibleBorrowers = q
    ? borrowers.filter((b) =>
        [b.email, b.firstName, b.lastName, b.customerId ?? ''].join(' ').toLowerCase().includes(q),
      )
    : borrowers;
  const visibleApps = q
    ? applications.filter((a) =>
        [a.referenceNumber ?? '', a.applicantEmail ?? '', a.applicantName ?? '', a.offlineCustomerId ?? '', a.status]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    : applications;

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const selectedBorrowerRows = borrowers.filter((b) => selectedUsers.has(b.uid));
  const selectedAppRows = applications.filter((a) => selectedApps.has(a.id));
  const selectedCount = selectedUsers.size + selectedApps.size;
  const liveSelected =
    selectedBorrowerRows.some((b) => b.liveLoanCount > 0) || selectedAppRows.some((a) => a.isLive);
  const cascadedApps = selectedBorrowerRows.reduce((n, b) => n + b.applicationCount, 0);

  const run = async () => {
    if (confirmInput !== CONFIRM_PHRASE || selectedCount === 0) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/admin/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-cleanup-confirmation': CONFIRM_PHRASE },
        body: JSON.stringify({
          userIds: Array.from(selectedUsers),
          applicationIds: Array.from(selectedApps),
          includeLiveLoans: includeLive,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error?.message ?? 'Cleanup failed');
      setResult(json.data as RunResult);
      setSelectedUsers(new Set());
      setSelectedApps(new Set());
      setConfirming(false);
      setConfirmInput('');
      setIncludeLive(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setRunning(false);
    }
  };

  const th = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500';
  const td = 'px-3 py-2.5 text-sm text-slate-700 align-top';

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {result && (
        <div className="tp-card p-4 space-y-2">
          <p className="text-sm font-semibold text-[#16263B]">
            Deleted {result.borrowers.length} borrower{result.borrowers.length === 1 ? '' : 's'} and{' '}
            {result.applications.length + result.borrowers.reduce((n, b) => n + b.applications, 0)} application
            {result.applications.length + result.borrowers.reduce((n, b) => n + b.applications, 0) === 1 ? '' : 's'}.
          </p>
          {result.borrowers.some((b) => !b.authUserDeleted) && (
            <p className="text-xs text-slate-500">
              Some borrowers had no Firebase Auth account (already removed) — their Firestore data was deleted.
            </p>
          )}
          {result.refused.length > 0 && (
            <ul className="space-y-1">
              {result.refused.map((r) => (
                <li key={`${r.kind}-${r.id}`} className="text-xs text-amber-700">
                  Skipped {r.kind} <span className="font-mono">{r.id}</span>: {r.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
          {(['borrowers', 'applications'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t ? 'bg-[#16263B] text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t === 'borrowers' ? `Borrowers (${borrowers.length})` : `Applications (${applications.length})`}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by email, name, customer ID or reference…"
          className="flex-1 min-w-[240px] rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
        />
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          Refresh
        </button>
      </div>

      {/* Selection bar */}
      {selectedCount > 0 && !confirming && (
        <div className="tp-card p-4 flex flex-wrap items-center gap-4 bg-[#FEF7E9] border-[#F59A1E]/30">
          <span className="text-sm font-medium text-[#16263B]">
            {selectedUsers.size > 0 && `${selectedUsers.size} borrower${selectedUsers.size === 1 ? '' : 's'}`}
            {selectedUsers.size > 0 && selectedApps.size > 0 && ' · '}
            {selectedApps.size > 0 && `${selectedApps.size} application${selectedApps.size === 1 ? '' : 's'}`}
            {cascadedApps > 0 && (
              <span className="ml-1 font-normal text-slate-500">
                (+ {cascadedApps} application{cascadedApps === 1 ? '' : 's'} owned by selected borrowers)
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedUsers(new Set());
              setSelectedApps(new Set());
            }}
            className="text-sm text-slate-500 hover:underline"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            Delete selected…
          </button>
        </div>
      )}

      {confirming && (
        <div className="tp-card p-5 border-red-200 space-y-4">
          <div>
            <p className="text-sm font-semibold text-red-700">This cannot be undone.</p>
            <p className="mt-1 text-sm text-slate-600">
              You are about to permanently delete{' '}
              {selectedUsers.size > 0 && (
                <>
                  <strong>{selectedUsers.size}</strong> borrower account{selectedUsers.size === 1 ? '' : 's'} (with{' '}
                  {cascadedApps} application{cascadedApps === 1 ? '' : 's'}, their loan records, assessments, profile
                  data and sign-in account)
                </>
              )}
              {selectedUsers.size > 0 && selectedApps.size > 0 && ' and '}
              {selectedApps.size > 0 && (
                <>
                  <strong>{selectedApps.size}</strong> application{selectedApps.size === 1 ? '' : 's'} (with their loan
                  records and assessments)
                </>
              )}
              . KYC files in Google Drive and audit logs are kept.
            </p>
          </div>

          <ul className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-slate-50 p-3 text-xs font-mono text-slate-600 space-y-0.5">
            {selectedBorrowerRows.map((b) => (
              <li key={b.uid}>
                borrower · {b.email} {b.customerId ? `· ${b.customerId}` : ''}
                {b.liveLoanCount > 0 && <span className="ml-1 text-red-600">· LIVE LOAN</span>}
              </li>
            ))}
            {selectedAppRows.map((a) => (
              <li key={a.id}>
                application · {a.referenceNumber ?? a.id} · {a.status}
                {a.isLive && <span className="ml-1 text-red-600">· LIVE</span>}
              </li>
            ))}
          </ul>

          {liveSelected && (
            <label className="flex items-start gap-2 text-sm text-red-700">
              <input
                type="checkbox"
                checked={includeLive}
                onChange={(e) => setIncludeLive(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span>
                Include live loans. The selection contains disbursed, accepted or active loans; deleting them removes
                the loan and its repayment history. Any live loan left unticked is skipped.
              </span>
            </label>
          )}

          <label className="block text-sm text-slate-700">
            Type <span className="font-mono font-semibold">{CONFIRM_PHRASE}</span> to confirm
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              autoComplete="off"
              className="mt-1 w-full max-w-xs rounded-lg border border-gray-200 px-3 py-1.5 font-mono text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={run}
              disabled={running || confirmInput !== CONFIRM_PHRASE}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {running ? 'Deleting…' : 'Delete permanently'}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setConfirmInput('');
              }}
              disabled={running}
              className="text-sm text-slate-500 hover:underline disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tables */}
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : tab === 'borrowers' ? (
        <div className="tp-card overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-slate-50">
              <tr>
                <th className={`${th} w-8`}>
                  <input
                    type="checkbox"
                    aria-label="Select all visible borrowers"
                    checked={visibleBorrowers.length > 0 && visibleBorrowers.every((b) => selectedUsers.has(b.uid))}
                    onChange={(e) =>
                      setSelectedUsers((prev) => {
                        const next = new Set(prev);
                        visibleBorrowers.forEach((b) => (e.target.checked ? next.add(b.uid) : next.delete(b.uid)));
                        return next;
                      })
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </th>
                <th className={th}>Borrower</th>
                <th className={th}>Customer ID</th>
                <th className={th}>Status</th>
                <th className={th}>Applications</th>
                <th className={th}>Created</th>
                <th className={th}>Last login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleBorrowers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-400">
                    No borrowers match.
                  </td>
                </tr>
              )}
              {visibleBorrowers.map((b) => (
                <tr key={b.uid} className={selectedUsers.has(b.uid) ? 'bg-[#FEF7E9]/60' : undefined}>
                  <td className={td}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${b.email}`}
                      checked={selectedUsers.has(b.uid)}
                      onChange={() => setSelectedUsers((prev) => toggle(prev, b.uid))}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </td>
                  <td className={td}>
                    <div className="font-medium text-[#16263B]">
                      {`${b.firstName} ${b.lastName}`.trim() || '—'}
                    </div>
                    <div className="text-xs text-slate-500">{b.email}</div>
                    <div className="text-[10px] font-mono text-slate-400">{b.uid}</div>
                  </td>
                  <td className={`${td} font-mono text-xs`}>{b.customerId ?? '—'}</td>
                  <td className={td}>
                    <StatusBadge status={b.status} />
                    {!b.profileComplete && (
                      <span className="ml-1 text-[11px] text-slate-400">incomplete profile</span>
                    )}
                  </td>
                  <td className={td}>
                    {b.applicationCount}
                    {b.liveLoanCount > 0 && (
                      <span className="ml-1 inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                        {b.liveLoanCount} live
                      </span>
                    )}
                  </td>
                  <td className={`${td} text-xs`}>{b.createdAt ? fmtDate(new Date(b.createdAt)) : '—'}</td>
                  <td className={`${td} text-xs`}>{b.lastLoginAt ? fmtDate(new Date(b.lastLoginAt)) : 'never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tp-card overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-slate-50">
              <tr>
                <th className={`${th} w-8`}>
                  <input
                    type="checkbox"
                    aria-label="Select all visible applications"
                    checked={visibleApps.length > 0 && visibleApps.every((a) => selectedApps.has(a.id))}
                    onChange={(e) =>
                      setSelectedApps((prev) => {
                        const next = new Set(prev);
                        visibleApps.forEach((a) => (e.target.checked ? next.add(a.id) : next.delete(a.id)));
                        return next;
                      })
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </th>
                <th className={th}>Reference</th>
                <th className={th}>Applicant</th>
                <th className={th}>Status</th>
                <th className={th}>Amount</th>
                <th className={th}>Collection</th>
                <th className={th}>Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleApps.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-400">
                    No applications match.
                  </td>
                </tr>
              )}
              {visibleApps.map((a) => (
                <tr key={a.id} className={selectedApps.has(a.id) ? 'bg-[#FEF7E9]/60' : undefined}>
                  <td className={td}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${a.referenceNumber ?? a.id}`}
                      checked={selectedApps.has(a.id)}
                      onChange={() => setSelectedApps((prev) => toggle(prev, a.id))}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </td>
                  <td className={td}>
                    <div className="font-mono text-xs font-medium text-[#16263B]">{a.referenceNumber ?? '—'}</div>
                    <div className="text-[10px] font-mono text-slate-400">{a.id}</div>
                  </td>
                  <td className={td}>
                    <div className="text-sm">{a.applicantName ?? '—'}</div>
                    <div className="text-xs text-slate-500">{a.applicantEmail ?? a.applicantId}</div>
                    {a.offlineCustomerId && (
                      <div className="text-[10px] font-mono text-slate-400">{a.offlineCustomerId}</div>
                    )}
                  </td>
                  <td className={td}>
                    <StatusBadge status={a.status} live={a.isLive} />
                  </td>
                  <td className={`${td} font-mono text-xs`}>
                    {a.requestedAmount !== null ? fmtNzd(a.requestedAmount) : '—'}
                  </td>
                  <td className={`${td} text-xs`}>
                    {a.isLive ? (a.collectionMode === 'qippay' ? 'Qippay' : 'Manual') : '—'}
                  </td>
                  <td className={`${td} text-xs`}>{a.createdAt ? fmtDate(new Date(a.createdAt)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
