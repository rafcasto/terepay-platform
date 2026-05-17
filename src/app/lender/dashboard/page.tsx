import { cookies } from 'next/headers';
import Link from 'next/link';
import { getAdminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import { loanPurposeLabel } from '@/lib/constants/loan-purposes';

export const dynamic = 'force-dynamic';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', minimumFractionDigits: 0 }).format(n);

function daysSince(ts: { _seconds: number } | null): number {
  if (!ts) return 0;
  return Math.floor((Date.now() - ts._seconds * 1000) / (1000 * 60 * 60 * 24));
}

async function getDashboardData(lenderUid: string) {
  const db = getAdminDb();

  // All active applications (explicit in query avoids not-in index requirements)
  const ACTIVE_STATUSES = [
    'pending_review', 'under_assessment', 'waiting_for_docs', 'credit_check',
    'approved', 'loan_accepted', 'awaiting_payment_consent',
    'declined', 'disbursed', 'active', 'closed_repaid',
  ];
  const snap = await db
    .collection('loanApplications')
    .where('status', 'in', ACTIVE_STATUSES)
    .orderBy('timeline.submittedAt', 'desc')
    .limit(200)
    .get();

  const apps = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));

  const counts: Record<string, number> = {};
  let totalDisbursed = 0;
  let decisionCount = 0;
  let approvalCount = 0;
  let totalDecisionDays = 0;

  for (const a of apps) {
    const status = a.status as string;
    counts[status] = (counts[status] ?? 0) + 1;

    if (status === 'disbursed' || status === 'active' || status === 'closed_repaid') {
      totalDisbursed += (a.loanDetails as { approvedAmount?: number })?.approvedAmount ?? 0;
    }
    if (status === 'approved' || status === 'declined') {
      decisionCount++;
      if (status === 'approved') approvalCount++;
      const timeline = a.timeline as Record<string, { _seconds: number }>;
      if (timeline?.submittedAt && (timeline?.approvedAt || timeline?.declinedAt)) {
        const decidedAt = timeline.approvedAt ?? timeline.declinedAt;
        const days = (decidedAt._seconds - timeline.submittedAt._seconds) / (60 * 60 * 24);
        totalDecisionDays += days;
      }
    }
  }

  const avgDecisionDays = decisionCount > 0 ? Math.round(totalDecisionDays / decisionCount) : null;
  const approvalRate = decisionCount > 0 ? Math.round((approvalCount / decisionCount) * 100) : null;

  // Pending queue (oldest first, assigned to this lender or unassigned)
  const pending = apps
    .filter((a) => a.status === 'pending_review')
    .sort((a, b) => {
      const tA = (a.timeline as Record<string, { _seconds: number }>)?.submittedAt?._seconds ?? 0;
      const tB = (b.timeline as Record<string, { _seconds: number }>)?.submittedAt?._seconds ?? 0;
      return tA - tB;
    })
    .slice(0, 8);

  // My active applications
  const myApps = apps
    .filter((a) => a.assignedLenderId === lenderUid && ['under_assessment', 'waiting_for_docs', 'credit_check', 'awaiting_payment_consent'].includes(a.status as string))
    .slice(0, 8);

  return { counts, totalDisbursed, avgDecisionDays, approvalRate, decisionCount, pending, myApps };
}

const STATUS_LABELS: Record<string, string> = {
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
};

const STATUS_COLOR: Record<string, string> = {
  pending_review: 'bg-amber-100 text-amber-800',
  under_assessment: 'bg-blue-100 text-blue-800',
  waiting_for_docs: 'bg-orange-100 text-orange-800',
  credit_check: 'bg-purple-100 text-purple-800',
  approved: 'bg-green-100 text-green-800',
  loan_accepted: 'bg-emerald-100 text-emerald-700',
  awaiting_payment_consent: 'bg-amber-100 text-amber-800',
  offer_declined: 'bg-amber-100 text-amber-800',
  disbursed: 'bg-emerald-100 text-emerald-800',
  active: 'bg-teal-100 text-teal-800',
  closed_repaid: 'bg-gray-100 text-gray-600',
  declined: 'bg-red-100 text-red-700',
};

export default async function LenderDashboardPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) return null;

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded) return null;

  const lenderUid: string = decoded.uid;
  const { counts, totalDisbursed, avgDecisionDays, approvalRate, decisionCount, pending, myApps } =
    await getDashboardData(lenderUid);

  const totalActive =
    (counts.pending_review ?? 0) +
    (counts.under_assessment ?? 0) +
    (counts.waiting_for_docs ?? 0) +
    (counts.credit_check ?? 0);

  const STAT_CARDS = [
    { label: 'Active Pipeline', value: totalActive, sub: 'Pending + in assessment' },
    {
      label: 'Avg. Decision Time',
      value: avgDecisionDays != null ? `${avgDecisionDays}d` : '—',
      sub: `Based on ${decisionCount} decided`,
    },
    {
      label: 'Approval Rate',
      value: approvalRate != null ? `${approvalRate}%` : '—',
      sub: 'Approved vs. decided',
    },
    {
      label: 'Total Disbursed',
      value: fmt(totalDisbursed),
      sub: 'Disbursed + active + repaid',
    },
  ];

  const PIPELINE_STATUSES = ['pending_review', 'under_assessment', 'waiting_for_docs', 'credit_check'];

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Lender Dashboard</h1>
        <p className="text-gray-500 mt-1 text-sm">Overview of the TerePay LMS pipeline.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {STAT_CARDS.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">{s.label}</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Status Breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Pipeline Breakdown</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {PIPELINE_STATUSES.concat(['approved', 'declined', 'disbursed', 'active', 'closed_repaid']).map((s) => (
            <div key={s} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[s] ?? 'bg-gray-100 text-gray-600'}`}>
                {STATUS_LABELS[s] ?? s}
              </span>
              <span className="text-sm font-bold text-gray-900 ml-2">{counts[s] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Review Queue */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Pending Review (Oldest First)</h2>
          <Link href="/lender/applications" className="text-sm text-indigo-600 hover:underline shrink-0 ml-4">
            View all →
          </Link>
        </div>
        {pending.length === 0 ? (
          <p className="px-4 sm:px-6 py-8 text-sm text-gray-400 text-center">No applications pending review.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {pending.map((app) => {
              const timeline = app.timeline as Record<string, { _seconds: number }> | undefined;
              const days = daysSince(timeline?.submittedAt ?? null);
              const overdue = days >= 2;
              const ld = app.loanDetails as { requestedAmount?: number; loanPurpose?: string } | undefined;
              return (
                <li
                  key={app.id as string}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 font-mono">
                      {(app.referenceNumber as string) ?? (app.id as string)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {fmt(ld?.requestedAmount ?? 0)} · {loanPurposeLabel(ld?.loanPurpose)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-medium ${overdue ? 'text-red-600' : 'text-gray-500'}`}>
                      {overdue ? `⚠ ${days}d overdue` : `${days}d pending`}
                    </span>
                    <Link
                      href={`/lender/applications/${app.id as string}`}
                      className="text-xs text-indigo-600 hover:underline font-medium"
                    >
                      Claim →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* My Active Applications */}
      {myApps.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">My Active Assessments</h2>
          </div>
          <ul className="divide-y divide-gray-50">
            {myApps.map((app) => {
              const ld = app.loanDetails as { requestedAmount?: number } | undefined;
              const status = app.status as string;
              return (
                <li
                  key={app.id as string}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 font-mono">
                      {(app.referenceNumber as string) ?? (app.id as string)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{fmt(ld?.requestedAmount ?? 0)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[status] ?? status}
                    </span>
                    <Link
                      href={`/lender/applications/${app.id as string}`}
                      className="text-xs text-indigo-600 hover:underline font-medium"
                    >
                      View →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { href: '/lender/applications', label: 'Applications Queue', desc: 'View and manage all applications' },
          { href: '/lender/benchmarks', label: 'Benchmark Catalog', desc: 'Manage expense benchmarks' },
          { href: '/lender/portfolio', label: 'Portfolio', desc: 'View active loans' },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-300 hover:shadow-sm transition-all group"
          >
            <p className="font-medium text-gray-900 group-hover:text-indigo-700">{l.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{l.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
