import { cookies } from 'next/headers';
import Link from 'next/link';
import { adminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import Badge from '@/components/shared/Badge';
import type { ApplicationStatus } from '@/types/application';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

const STATUS_VARIANT: Record<ApplicationStatus, BadgeVariant> = {
  draft: 'default',
  submitted: 'info',
  under_review: 'warning',
  approved: 'success',
  rejected: 'error',
  funded: 'success',
  completed: 'success',
};

async function getStats() {
  const snap = await adminDb
    .collection('applications')
    .where('status', 'in', ['submitted', 'under_review', 'approved', 'rejected', 'funded', 'completed'])
    .get();

  const counts: Record<string, number> = {
    submitted: 0,
    under_review: 0,
    approved: 0,
    rejected: 0,
    funded: 0,
    completed: 0,
  };
  let totalRequested = 0;

  snap.docs.forEach((d) => {
    const data = d.data();
    counts[data.status] = (counts[data.status] ?? 0) + 1;
    totalRequested += data.loanDetails?.requestedAmount ?? 0;
  });

  return { counts, total: snap.size, totalRequested };
}

async function getRecentApplications() {
  const snap = await adminDb
    .collection('applications')
    .where('status', 'in', ['submitted', 'under_review'])
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

export default async function LenderDashboardPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) return null;

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded) return null;

  const [{ counts, total, totalRequested }, recent] = await Promise.all([
    getStats(),
    getRecentApplications(),
  ]);

  const STAT_CARDS = [
    { label: 'Total Applications', value: total },
    { label: 'Awaiting Review', value: counts.submitted + counts.under_review },
    { label: 'Approved', value: counts.approved + counts.funded },
    { label: 'Total Requested', value: fmt(totalRequested) },
  ];

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Lender Dashboard</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">Overview of all loan applications.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {STAT_CARDS.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">{s.label}</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pending Applications */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Pending Review</h2>
          <Link href="/lender/applications" className="text-sm text-[#F5A523] hover:underline shrink-0 ml-4">
            View all →
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="px-4 sm:px-6 py-8 text-sm text-gray-400 text-center">No applications awaiting review.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {recent.map((app) => {
              const a = app as Record<string, unknown>;
              const status = a.status as ApplicationStatus;
              return (
                <li key={app.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">#{a.applicationNumber as string}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {fmt((a.loanDetails as { requestedAmount?: number })?.requestedAmount ?? 0)} ·{' '}
                      {(a.loanDetails as { loanPurpose?: string })?.loanPurpose}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={STATUS_VARIANT[status]}>{status.replace('_', ' ')}</Badge>
                    <Link
                      href={`/lender/applications/${app.id}`}
                      className="text-xs text-[#F5A523] hover:underline"
                    >
                      Review →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
