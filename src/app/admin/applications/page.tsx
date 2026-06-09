'use client';

import { useState, useEffect } from 'react';

interface Application {
  id: string;
  applicantId: string;
  applicantEmail?: string;
  status: string;
  requestedAmount?: number;
  assignedLenderId?: string;
  submittedAt?: number;
}

interface Lender {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
}

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetLender, setTargetLender] = useState('');
  const [reassigning, setReassigning] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/applications').then((r) => r.json()),
      fetch('/api/admin/users').then((r) => r.json()),
    ])
      .then(([appsJson, lendersJson]) => {
        setApplications(appsJson.data ?? []);
        setLenders((lendersJson.data ?? []).filter((l: Lender) => l.status === 'active'));
      })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === applications.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(applications.map((a) => a.id)));
    }
  };

  const handleReassign = async () => {
    if (selected.size === 0) { setError('Select at least one application.'); return; }
    if (!targetLender) { setError('Select a target lender.'); return; }

    setReassigning(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/applications/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationIds: Array.from(selected),
          targetLenderId: targetLender,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Reassign failed');
      setSuccess(`${json.data.updated} application${json.data.updated !== 1 ? 's' : ''} reassigned.`);
      setSelected(new Set());
      setTimeout(() => setSuccess(null), 4000);
      // Refresh
      fetch('/api/admin/applications')
        .then((r) => r.json())
        .then((j) => setApplications(j.data ?? []));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setReassigning(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: 'bg-slate-100 text-slate-500',
      pending_review: 'bg-blue-100 text-blue-700',
      under_assessment: 'bg-amber-100 text-amber-700',
      approved: 'bg-green-100 text-green-700',
      declined: 'bg-red-100 text-red-600',
      disbursed: 'bg-emerald-100 text-emerald-700',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-slate-100 text-slate-500'}`}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold text-[#16263B]">Applications</h1>
        <p className="text-sm text-slate-500 mt-1">Bulk reassign loan applications to a lender.</p>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
      {success && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-4 tp-card p-4 flex items-center gap-4 bg-[#FEF7E9] border-[#F59A1E]/30">
          <span className="text-sm font-medium text-[#16263B]">
            {selected.size} selected
          </span>
          <select
            value={targetLender}
            onChange={(e) => setTargetLender(e.target.value)}
            className="flex-1 max-w-xs rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
          >
            <option value="">Select target lender…</option>
            {lenders.map((l) => (
              <option key={l.uid} value={l.uid}>
                {l.firstName} {l.lastName} ({l.email})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleReassign}
            disabled={reassigning || !targetLender}
            className="inline-flex items-center gap-2 rounded-lg bg-[#F5A523] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#E08B00] transition-colors disabled:opacity-60"
          >
            {reassigning ? 'Reassigning...' : 'Reassign'}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Clear
          </button>
        </div>
      )}

      <div className="tp-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="h-6 w-6 animate-spin text-[#F08000]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
        ) : applications.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">No applications found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === applications.length && applications.length > 0}
                    onChange={toggleAll}
                    className="rounded border-gray-300 text-[#F5A523] focus:ring-[#F5A523]"
                  />
                </th>
                {['Application ID', 'Status', 'Amount', 'Assigned Lender', 'Submitted'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {applications.map((app) => {
                const assignedLender = lenders.find((l) => l.uid === app.assignedLenderId);
                return (
                  <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(app.id)}
                        onChange={() => toggleSelect(app.id)}
                        className="rounded border-gray-300 text-[#F5A523] focus:ring-[#F5A523]"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{app.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3">{statusBadge(app.status)}</td>
                    <td className="px-4 py-3 font-tabular text-[#1C2A3A]">
                      {app.requestedAmount != null
                        ? `$${app.requestedAmount.toLocaleString('en-NZ', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {assignedLender
                        ? `${assignedLender.firstName} ${assignedLender.lastName}`
                        : <span className="text-slate-400 italic">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs font-tabular">
                      {app.submittedAt
                        ? new Date(app.submittedAt).toLocaleDateString('en-NZ')
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
