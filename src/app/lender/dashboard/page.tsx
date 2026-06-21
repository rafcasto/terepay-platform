import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAdminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import { loanPurposeLabel } from '@/lib/constants/loan-purposes';
import ConsoleIcon, { type ConsoleIconName } from '@/components/lender/ConsoleIcon';
import ConsolePill, { type PillTone } from '@/components/lender/ConsolePill';

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
};

const KPI_TONE: Record<string, [string, string]> = {
  brand: ['bg-[var(--orange-50)]', 'text-[var(--orange-700)]'],
  info: ['bg-[var(--info-50)]', 'text-[var(--info-700)]'],
  warning: ['bg-[var(--warning-50)]', 'text-[var(--warning-700)]'],
  success: ['bg-[var(--success-50)]', 'text-[var(--success-700)]'],
};

export default async function LenderDashboardPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) redirect('/auth/login');

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded) redirect('/auth/login');

  const lenderUid: string = decoded.uid;
  const { counts, totalDisbursed, avgDecisionDays, approvalRate, decisionCount, pending, myApps } =
    await getDashboardData(lenderUid);

  const totalActive =
    (counts.pending_review ?? 0) +
    (counts.under_assessment ?? 0) +
    (counts.waiting_for_docs ?? 0) +
    (counts.credit_check ?? 0);

  const STAT_CARDS: { label: string; value: string | number; sub: string; icon: ConsoleIconName; tone: string }[] = [
    { label: 'Active pipeline', value: totalActive, sub: 'Pending + in assessment', icon: 'inbox', tone: 'brand' },
    {
      label: 'Avg. decision time',
      value: avgDecisionDays != null ? `${avgDecisionDays}d` : '—',
      sub: `Based on ${decisionCount} decided`,
      icon: 'clock',
      tone: 'info',
    },
    {
      label: 'Approval rate',
      value: approvalRate != null ? `${approvalRate}%` : '—',
      sub: 'Approved vs. decided',
      icon: 'trending',
      tone: 'success',
    },
    {
      label: 'Total disbursed',
      value: fmt(totalDisbursed),
      sub: 'Disbursed + active + repaid',
      icon: 'wallet',
      tone: 'warning',
    },
  ];

  const PIPELINE_STATUSES = ['pending_review', 'under_assessment', 'waiting_for_docs', 'credit_check', 'approved', 'declined', 'disbursed', 'active', 'closed_repaid'];

  return (
    <div className="mx-auto max-w-[1240px] px-6 pb-14 pt-6 sm:px-[26px]">
      {/* Page head */}
      <div className="mb-[18px]">
        <h1 className="m-0 font-display text-2xl font-bold tracking-[-0.01em] text-[var(--text-strong)]">
          Overview
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Pipeline health & activity across the TerePay platform.</p>
      </div>

      {/* KPI cards */}
      <div className="mb-[18px] grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        {STAT_CARDS.map((s) => {
          const [bg, fg] = KPI_TONE[s.tone];
          return (
            <div
              key={s.label}
              className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white p-[18px] shadow-[var(--shadow-xs)]"
            >
              <div className="mb-[11px] flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-medium text-[var(--text-muted)]">{s.label}</span>
                <span className={`flex h-[34px] w-[34px] items-center justify-center rounded-[9px] ${bg} ${fg}`}>
                  <ConsoleIcon name={s.icon} size={18} />
                </span>
              </div>
              <div className="font-display text-[27px] font-bold leading-none tracking-[-0.02em] text-[var(--text-strong)]">
                {s.value}
              </div>
              <div className="mt-[7px] text-[12.5px] text-[var(--text-muted)]">{s.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Pipeline breakdown */}
      <div className="mb-[18px] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white shadow-[var(--shadow-xs)]">
        <div className="border-b border-[var(--border-subtle)] px-5 py-[15px]">
          <h2 className="m-0 font-display text-[15px] font-semibold text-[var(--text-strong)]">Pipeline breakdown</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 md:grid-cols-4">
          {PIPELINE_STATUSES.map((s) => (
            <div key={s} className="flex items-center justify-between gap-2 rounded-[10px] bg-[var(--surface-sunken)] px-3 py-2.5">
              <ConsolePill tone={STATUS_TONE[s] ?? 'neutral'}>{STATUS_LABELS[s] ?? s}</ConsolePill>
              <span className="ml-1 font-display text-sm font-bold text-[var(--text-strong)]">{counts[s] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pending review queue */}
      <div className="mb-[18px] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white shadow-[var(--shadow-xs)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-[15px]">
          <h2 className="m-0 font-display text-[15px] font-semibold text-[var(--text-strong)]">Pending review · oldest first</h2>
          <Link href="/lender/applications" className="shrink-0 text-sm font-semibold text-[var(--orange-700)] hover:underline">
            View all →
          </Link>
        </div>
        {pending.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">No applications pending review.</p>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {pending.map((app) => {
              const timeline = app.timeline as Record<string, { _seconds: number }> | undefined;
              const days = daysSince(timeline?.submittedAt ?? null);
              const overdue = days >= 2;
              const ld = app.loanDetails as { requestedAmount?: number; loanPurpose?: string } | undefined;
              return (
                <li
                  key={app.id as string}
                  className="flex flex-col gap-2 px-5 py-3.5 transition-colors hover:bg-[var(--orange-50)] sm:flex-row sm:items-center sm:justify-between sm:gap-0"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium text-[var(--text-strong)]">
                      {(app.referenceNumber as string) ?? (app.id as string)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                      {fmt(ld?.requestedAmount ?? 0)} · {loanPurposeLabel(ld?.loanPurpose)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {overdue ? (
                      <ConsolePill tone="danger" dot>{days}d overdue</ConsolePill>
                    ) : (
                      <ConsolePill tone="success" dot>{days}d pending</ConsolePill>
                    )}
                    <Link
                      href={`/lender/applications/${app.id as string}`}
                      className="text-xs font-semibold text-[var(--orange-700)] hover:underline"
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

      {/* My active assessments */}
      {myApps.length > 0 && (
        <div className="mb-[18px] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white shadow-[var(--shadow-xs)]">
          <div className="border-b border-[var(--border-subtle)] px-5 py-[15px]">
            <h2 className="m-0 font-display text-[15px] font-semibold text-[var(--text-strong)]">My active assessments</h2>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {myApps.map((app) => {
              const ld = app.loanDetails as { requestedAmount?: number } | undefined;
              const status = app.status as string;
              return (
                <li
                  key={app.id as string}
                  className="flex flex-col gap-2 px-5 py-3.5 transition-colors hover:bg-[var(--orange-50)] sm:flex-row sm:items-center sm:justify-between sm:gap-0"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium text-[var(--text-strong)]">
                      {(app.referenceNumber as string) ?? (app.id as string)}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">{fmt(ld?.requestedAmount ?? 0)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <ConsolePill tone={STATUS_TONE[status] ?? 'neutral'} dot>{STATUS_LABELS[status] ?? status}</ConsolePill>
                    <Link
                      href={`/lender/applications/${app.id as string}`}
                      className="text-xs font-semibold text-[var(--orange-700)] hover:underline"
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

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { href: '/lender/applications', label: 'Application worklist', desc: 'View and manage all applications', icon: 'inbox' as ConsoleIconName },
          { href: '/lender/benchmarks', label: 'Benchmark catalog', desc: 'Manage expense benchmarks', icon: 'sliders' as ConsoleIconName },
          { href: '/lender/portfolio', label: 'Portfolio', desc: 'View active loans', icon: 'wallet' as ConsoleIconName },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="group rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white p-4 shadow-[var(--shadow-xs)] transition-all hover:border-[var(--orange-400)] hover:shadow-[var(--shadow-sm)]"
          >
            <div className="mb-2 flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-[var(--orange-50)] text-[var(--orange-700)]">
              <ConsoleIcon name={l.icon} size={18} />
            </div>
            <p className="font-display font-semibold text-[var(--text-strong)] group-hover:text-[var(--orange-700)]">{l.label}</p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{l.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
