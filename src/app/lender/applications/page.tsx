import { cookies } from 'next/headers';
import Link from 'next/link';
import { adminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import Badge from '@/components/shared/Badge';
import type { ApplicationStatus } from '@/types/application';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending_review: 'info',
  under_assessment: 'warning',
  waiting_for_docs: 'warning',
  credit_check: 'info',
  approved: 'success',
  loan_accepted: 'success',
  awaiting_payment_consent: 'warning',
  offer_declined: 'default',
  disbursed: 'success',
  active: 'success',
  closed_repaid: 'default',
  declined: 'error',
  withdrawn: 'default',
  expired: 'default',
  // legacy
  submitted: 'info',
  under_review: 'warning',
  rejected: 'error',
  funded: 'success',
  completed: 'success',
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

const ALL_STATUSES = [
  'pending_review', 'under_assessment', 'waiting_for_docs', 'credit_check',
  'approved', 'loan_accepted', 'awaiting_payment_consent',
  'disbursed', 'active', 'closed_repaid', 'declined', 'withdrawn',
  // Firestore admin SDK supports up to 30 'in' values.
];

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', minimumFractionDigits: 0 }).format(n);

const fmtDate = (ts?: { toDate?: () => Date } | null) => {
  if (!ts?.toDate) return '—';
  return new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium' }).format(ts.toDate());
};

function daysPending(submittedAt?: { toDate?: () => Date } | null): number | null {
  if (!submittedAt?.toDate) return null;
  const ms = Date.now() - submittedAt.toDate().getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export default async function LenderApplicationsPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) return null;

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded || decoded.role !== 'lender') return null;

  const snap = await adminDb
    .collection('loanApplications')
    .where('status', 'in', ALL_STATUSES)
    .orderBy('timeline.submittedAt', 'asc') // oldest first per requirements
    .get();

  const applications = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const pending = applications.filter((a) => {
    const s = (a as Record<string, unknown>).status as string;
    return s === 'pending_review';
  });
  const inProgress = applications.filter((a) => {
    const s = (a as Record<string, unknown>).status as string;
    return ['under_assessment', 'waiting_for_docs', 'credit_check', 'loan_accepted', 'awaiting_payment_consent'].includes(s);
  });
  const decided = applications.filter((a) => {
    const s = (a as Record<string, unknown>).status as string;
    return ['approved', 'disbursed', 'active', 'closed_repaid', 'declined', 'withdrawn'].includes(s);
  });

  const sections = [
    { title: '⏳ Pending Review', apps: pending },
    { title: '🔍 In Progress', apps: inProgress },
    { title: '✅ Decided', apps: decided },
  ];

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
          <p className="text-gray-500 mt-1 text-sm">{applications.length} total application{applications.length !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="/lender/applications/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#F5A523] text-white text-sm font-medium rounded-lg hover:bg-[#E08B00] transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Application
        </Link>
      </div>

      {sections.map(({ title, apps }) => (
        <div key={title} className="mb-8">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">{title}</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {apps.length === 0 ? (
              <p className="px-6 py-8 text-sm text-gray-400 text-center">No applications in this category.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Reference</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Applicant</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Submitted</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Days Pending</th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {apps.map((app) => {
                    const a = app as Record<string, unknown>;
                    const status = a.status as string;
                    const ld = a.loanDetails as { requestedAmount?: number; loanPurpose?: string } | undefined;
                    const pi = a.personalInfo as { firstName?: string; lastName?: string } | undefined;
                    const days = daysPending(a['timeline'] ? (a['timeline'] as Record<string, unknown>).submittedAt as { toDate?: () => Date } : null);
                    const isOverdue = days !== null && days > 2 && status === 'pending_review';

                    return (
                      <tr key={app.id} className={`hover:bg-gray-50 transition-colors ${isOverdue ? 'bg-amber-50' : ''}`}>
                        <td className="px-4 sm:px-6 py-4 font-mono text-xs text-gray-700">
                          {(a.referenceNumber as string) ?? `#${app.id.slice(0, 8)}`}
                          {isOverdue && (
                            <span className="ml-2 text-amber-600 text-xs font-medium">⚠ Overdue</span>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-gray-700 hidden sm:table-cell">
                          {pi ? `${pi.firstName ?? ''} ${pi.lastName ?? ''}`.trim() : '—'}
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-gray-700 font-medium">
                          {fmt(ld?.requestedAmount ?? 0)}
                        </td>
                        <td className="px-4 sm:px-6 py-4">
                          <Badge variant={STATUS_VARIANT[status] ?? 'default'}>
                            {STATUS_LABEL[status] ?? status}
                          </Badge>
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-gray-500 hidden md:table-cell">
                          {fmtDate((a['timeline'] as Record<string, unknown>)?.submittedAt as { toDate?: () => Date } | null)}
                        </td>
                        <td className="px-4 sm:px-6 py-4 hidden md:table-cell">
                          {days !== null ? (
                            <span className={days > 2 && status === 'pending_review' ? 'text-amber-600 font-medium' : 'text-gray-500'}>
                              {days}d
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-right">
                          <Link
                            href={`/lender/applications/${app.id}`}
                            className="text-indigo-600 hover:underline font-medium text-sm"
                          >
                            {status === 'pending_review' ? 'Review →' : 'View →'}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

