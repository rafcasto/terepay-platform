'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import ConsoleIcon from '@/components/lender/ConsoleIcon';
import ConsolePill, { type PillTone } from '@/components/lender/ConsolePill';

export type WorklistRow = {
  id: string;
  reference: string;
  name: string;
  amount: number;
  purpose: string;
  status: string;
  submittedLabel: string;
  daysPending: number | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending_review: 'Pending Review',
  under_assessment: 'Under Assessment',
  waiting_for_docs: 'Waiting for Docs',
  credit_check: 'Credit Check',
  approved: 'Approved',
  loan_accepted: 'Loan Accepted',
  awaiting_payment_consent: 'Awaiting Bank Authorisation',
  offer_declined: 'Offer Declined',
  disbursed: 'Disbursed',
  active: 'Active',
  closed_repaid: 'Closed — Repaid',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  expired: 'Expired',
  submitted: 'Submitted',
  under_review: 'Under Review',
  rejected: 'Rejected',
  funded: 'Funded',
  completed: 'Completed',
};

const STATUS_TONE: Record<string, PillTone> = {
  pending_review: 'info',
  under_assessment: 'warning',
  waiting_for_docs: 'warning',
  credit_check: 'info',
  approved: 'success',
  loan_accepted: 'success',
  awaiting_payment_consent: 'warning',
  offer_declined: 'neutral',
  disbursed: 'success',
  active: 'success',
  closed_repaid: 'neutral',
  declined: 'danger',
  withdrawn: 'neutral',
  expired: 'neutral',
  submitted: 'info',
  under_review: 'warning',
  rejected: 'danger',
  funded: 'success',
  completed: 'success',
};

// Stage buckets for the segmented filter, mapped from real application status.
type StageKey = 'pending' | 'assessment' | 'approved' | 'active' | 'closed';

const STAGE_OF: Record<string, StageKey> = {
  pending_review: 'pending',
  submitted: 'pending',
  under_assessment: 'assessment',
  waiting_for_docs: 'assessment',
  credit_check: 'assessment',
  under_review: 'assessment',
  approved: 'approved',
  loan_accepted: 'approved',
  awaiting_payment_consent: 'approved',
  disbursed: 'active',
  active: 'active',
  funded: 'active',
  closed_repaid: 'closed',
  completed: 'closed',
  declined: 'closed',
  rejected: 'closed',
  withdrawn: 'closed',
  expired: 'closed',
  offer_declined: 'closed',
};

const STAGES: { key: StageKey; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'assessment', label: 'In assessment' },
  { key: 'approved', label: 'Approved' },
  { key: 'active', label: 'Active' },
  { key: 'closed', label: 'Closed' },
];

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', minimumFractionDigits: 0 }).format(n);

const AV_COLORS = ['#B45600', '#1A5FA8', '#137a43', '#7A3FA0', '#B4231C', '#0F6E6E', '#9A5B00'];

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({ name }: { name: string }) {
  const initials = initialsOf(name);
  const color = AV_COLORS[(initials.charCodeAt(0) + initials.charCodeAt(initials.length - 1)) % AV_COLORS.length];
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-[13px] font-bold text-white"
      style={{ background: color }}
    >
      {initials}
    </span>
  );
}

// SLA-style pill derived from time pending (only meaningful for pending review).
function slaPill(status: string, days: number | null) {
  if (status !== 'pending_review' || days == null) {
    return <span className="text-[var(--text-muted)]">—</span>;
  }
  if (days > 2) return <ConsolePill tone="danger" dot>Overdue</ConsolePill>;
  if (days === 2) return <ConsolePill tone="warning" dot>Due soon</ConsolePill>;
  return <ConsolePill tone="success" dot>On track</ConsolePill>;
}

export default function WorklistTable({ rows }: { rows: WorklistRow[] }) {
  const [filter, setFilter] = useState<'all' | StageKey>('all');

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const s of STAGES) c[s.key] = 0;
    for (const r of rows) {
      const stage = STAGE_OF[r.status];
      if (stage) c[stage] = (c[stage] ?? 0) + 1;
    }
    return c;
  }, [rows]);

  const shown = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => STAGE_OF[r.status] === filter)),
    [rows, filter],
  );

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white shadow-[var(--shadow-xs)]">
      {/* Segmented stage filter */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-[15px]">
        <div className="inline-flex gap-1 rounded-[11px] bg-[var(--surface-sunken)] p-1" role="tablist" aria-label="Filter by stage">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`flex h-[30px] items-center gap-1.5 rounded-lg px-[13px] text-[13px] font-semibold transition-colors ${
              filter === 'all'
                ? 'bg-white text-[var(--text-strong)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'
            }`}
          >
            All <span className={`text-[11px] font-bold ${filter === 'all' ? 'text-[var(--orange-700)]' : 'text-[var(--text-muted)]'}`}>{counts.all}</span>
          </button>
          {STAGES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setFilter(s.key)}
              className={`flex h-[30px] items-center gap-1.5 rounded-lg px-[13px] text-[13px] font-semibold transition-colors ${
                filter === s.key
                  ? 'bg-white text-[var(--text-strong)] shadow-[var(--shadow-sm)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'
              }`}
            >
              {s.label} <span className={`text-[11px] font-bold ${filter === s.key ? 'text-[var(--orange-700)]' : 'text-[var(--text-muted)]'}`}>{counts[s.key]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Dense table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              {['Applicant', 'Reference', 'Amount', 'Purpose', 'Status', 'Submitted', 'SLA', ''].map((h, i) => (
                <th
                  key={h || 'action'}
                  className={`whitespace-nowrap border-b border-[var(--border-default)] bg-[var(--slate-50)] px-5 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.04em] text-[var(--text-muted)] ${
                    i === 2 ? 'text-right' : 'text-left'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">
                  No applications in this stage.
                </td>
              </tr>
            ) : (
              shown.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer border-b border-[var(--border-subtle)] transition-colors last:border-b-0 hover:bg-[var(--orange-50)]"
                  onClick={() => {
                    window.location.href = `/lender/applications/${r.id}`;
                  }}
                >
                  <td className="px-5 py-3 align-middle">
                    <div className="flex items-center gap-[11px]">
                      <Avatar name={r.name} />
                      <div className="min-w-0">
                        <div className="whitespace-nowrap font-semibold text-[var(--text-strong)]">{r.name || '—'}</div>
                        <div className="text-xs text-[var(--text-muted)]">{r.purpose}</div>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 align-middle font-mono text-[var(--text-muted)] tabular-nums">
                    {r.reference}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right align-middle font-mono font-semibold tabular-nums text-[var(--text-strong)]">
                    {fmt(r.amount)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 align-middle text-[var(--text-body)]">{r.purpose}</td>
                  <td className="px-5 py-3 align-middle">
                    <ConsolePill tone={STATUS_TONE[r.status] ?? 'neutral'} dot>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </ConsolePill>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 align-middle text-[var(--text-muted)]">{r.submittedLabel}</td>
                  <td className="px-5 py-3 align-middle">{slaPill(r.status, r.daysPending)}</td>
                  <td className="px-5 py-3 text-right align-middle">
                    <Link
                      href={`/lender/applications/${r.id}`}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Open ${r.reference}`}
                      className="inline-flex text-[var(--text-muted)] hover:text-[var(--orange-700)]"
                    >
                      <ConsoleIcon name="chevRight" size={18} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
