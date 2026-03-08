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

const ALL_STATUSES: ApplicationStatus[] = [
  'submitted', 'under_review', 'approved', 'rejected', 'funded', 'completed',
];

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

const fmtDate = (ts?: { toDate?: () => Date } | null) => {
  if (!ts?.toDate) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(ts.toDate());
};

export default async function LenderApplicationsPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) return null;

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded) return null;

  const snap = await adminDb
    .collection('applications')
    .where('status', 'in', ALL_STATUSES)
    .orderBy('createdAt', 'desc')
    .get();

  const applications = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">All Applications</h1>
        <p className="text-gray-500 mt-1">{applications.length} application{applications.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {applications.length === 0 ? (
          <p className="px-6 py-12 text-sm text-gray-400 text-center">No applications yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Application #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Purpose
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Submitted
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {applications.map((app) => {
                const a = app as Record<string, unknown>;
                const status = a.status as ApplicationStatus;
                const ld = a.loanDetails as { requestedAmount?: number; loanPurpose?: string } | undefined;
                return (
                  <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      #{a.applicationNumber as string}
                    </td>
                    <td className="px-6 py-4 text-gray-700">{fmt(ld?.requestedAmount ?? 0)}</td>
                    <td className="px-6 py-4 text-gray-700 capitalize">
                      {ld?.loanPurpose?.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={STATUS_VARIANT[status]}>{status.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {fmtDate(a.submittedAt as { toDate?: () => Date } | null)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/lender/applications/${app.id}`}
                        className="text-indigo-600 hover:underline font-medium"
                      >
                        Review
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
  );
}
