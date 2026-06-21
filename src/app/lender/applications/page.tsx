import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { adminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import { loanPurposeLabel } from '@/lib/constants/loan-purposes';
import ConsoleIcon, { type ConsoleIconName } from '@/components/lender/ConsoleIcon';
import WorklistTable, { type WorklistRow } from './_components/WorklistTable';

export const dynamic = 'force-dynamic';

const ALL_STATUSES = [
  'pending_review', 'under_assessment', 'waiting_for_docs', 'credit_check',
  'approved', 'loan_accepted', 'awaiting_payment_consent',
  'disbursed', 'active', 'closed_repaid', 'declined', 'withdrawn',
  // Firestore admin SDK supports up to 30 'in' values.
];

type TS = { toDate?: () => Date; _seconds?: number } | null | undefined;

function tsToDate(ts: TS): Date | null {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (typeof ts._seconds === 'number') return new Date(ts._seconds * 1000);
  return null;
}

const fmtDate = (ts: TS) => {
  const d = tsToDate(ts);
  return d ? new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium' }).format(d) : '—';
};

function daysPending(ts: TS): number | null {
  const d = tsToDate(ts);
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// KPI icon container tone → [bg class, fg class]
const KPI_TONE: Record<string, [string, string]> = {
  brand: ['bg-[var(--orange-50)]', 'text-[var(--orange-700)]'],
  info: ['bg-[var(--info-50)]', 'text-[var(--info-700)]'],
  warning: ['bg-[var(--warning-50)]', 'text-[var(--warning-700)]'],
  success: ['bg-[var(--success-50)]', 'text-[var(--success-700)]'],
};

export default async function LenderApplicationsPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) redirect('/auth/login');

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded || decoded.role !== 'lender') redirect('/auth/login');

  const snap = await adminDb
    .collection('loanApplications')
    .where('status', 'in', ALL_STATUSES)
    .orderBy('timeline.submittedAt', 'asc') // oldest first per requirements
    .get();

  const apps = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown>));

  const rows: WorklistRow[] = apps.map((a) => {
    const ld = a.loanDetails as { requestedAmount?: number; loanPurpose?: string } | undefined;
    const pi = a.personalInfo as { firstName?: string; lastName?: string } | undefined;
    const submittedAt = (a.timeline as Record<string, TS> | undefined)?.submittedAt;
    return {
      id: a.id as string,
      reference: (a.referenceNumber as string) ?? `#${(a.id as string).slice(0, 8)}`,
      name: pi ? `${pi.firstName ?? ''} ${pi.lastName ?? ''}`.trim() : '',
      amount: ld?.requestedAmount ?? 0,
      purpose: loanPurposeLabel(ld?.loanPurpose),
      status: a.status as string,
      submittedLabel: fmtDate(submittedAt),
      daysPending: daysPending(submittedAt),
    };
  });

  const countBy = (statuses: string[]) => rows.filter((r) => statuses.includes(r.status)).length;

  const kpis: { label: string; value: number; icon: ConsoleIconName; tone: string }[] = [
    { label: 'Pending review', value: countBy(['pending_review']), icon: 'inbox', tone: 'brand' },
    { label: 'In assessment', value: countBy(['under_assessment', 'waiting_for_docs', 'credit_check']), icon: 'shield', tone: 'info' },
    { label: 'Awaiting authorisation', value: countBy(['loan_accepted', 'awaiting_payment_consent']), icon: 'clock', tone: 'warning' },
    { label: 'Active loans', value: countBy(['disbursed', 'active']), icon: 'wallet', tone: 'success' },
  ];

  const overdue = rows.filter((r) => r.status === 'pending_review' && (r.daysPending ?? 0) > 2).length;

  return (
    <div className="mx-auto max-w-[1480px] px-6 pb-14 pt-6 sm:px-[26px]">
      {/* Page head */}
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 font-display text-2xl font-bold tracking-[-0.01em] text-[var(--text-strong)]">
            Worklist
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {rows.length} application{rows.length !== 1 ? 's' : ''} in the pipeline
            {overdue > 0 && (
              <>
                {' · '}
                <span className="font-semibold text-[var(--text-danger)]">{overdue} overdue</span>
              </>
            )}
          </p>
        </div>
        <Link
          href="/lender/applications/new"
          className="inline-flex h-[38px] items-center gap-2 rounded-[10px] bg-[var(--orange-500)] px-4 font-display text-[13.5px] font-semibold text-[var(--ink-900)] transition-[filter] hover:brightness-105"
        >
          <ConsoleIcon name="plus" size={17} />
          New application
        </Link>
      </div>

      {/* KPI strip */}
      <div className="mb-[18px] grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        {kpis.map((k) => {
          const [bg, fg] = KPI_TONE[k.tone];
          return (
            <div
              key={k.label}
              className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white p-[18px] shadow-[var(--shadow-xs)]"
            >
              <div className="mb-[11px] flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-medium text-[var(--text-muted)]">{k.label}</span>
                <span className={`flex h-[34px] w-[34px] items-center justify-center rounded-[9px] ${bg} ${fg}`}>
                  <ConsoleIcon name={k.icon} size={18} />
                </span>
              </div>
              <div className="font-display text-[27px] font-bold leading-none tracking-[-0.02em] text-[var(--text-strong)]">
                {k.value}
              </div>
            </div>
          );
        })}
      </div>

      <WorklistTable rows={rows} />
    </div>
  );
}
