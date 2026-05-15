import { cookies } from 'next/headers';
import { getAdminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import Link from 'next/link';
import Badge from '@/components/shared/Badge';
import { loanPurposeLabel } from '@/lib/constants/loan-purposes';

export const dynamic = 'force-dynamic';

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  draft: 'default',
  pending_review: 'info',
  under_assessment: 'warning',
  waiting_for_docs: 'warning',
  credit_check: 'info',
  approved: 'success',
  loan_accepted: 'success',
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

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  under_assessment: 'Under Assessment',
  waiting_for_docs: 'Documents Requested',
  credit_check: 'Credit Check',
  approved: 'Approved',
  loan_accepted: 'Loan Accepted',
  offer_declined: 'Offer Declined',
  disbursed: 'Disbursed',
  active: 'Active',
  closed_repaid: 'Repaid',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  expired: 'Expired',
  submitted: 'Submitted',
  under_review: 'Under Review',
  rejected: 'Declined',
  funded: 'Funded',
  completed: 'Completed',
};

export default async function ApplicantApplicationsPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) return null;

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded) return null;

  const db = getAdminDb();

  // Fetch the user document to check for an offline customer link
  const userSnap = await db.collection('users').doc(decoded.uid).get();
  const customerId: string | undefined = userSnap.data()?.customerId;

  // Run both queries in parallel: own applications + offline-customer applications
  const [ownSnap, offlineSnap] = await Promise.all([
    db
      .collection('loanApplications')
      .where('applicantId', '==', decoded.uid)
      .orderBy('timeline.createdAt', 'desc')
      .get(),
    customerId
      ? db
          .collection('loanApplications')
          .where('offlineCustomerId', '==', customerId)
          .orderBy('timeline.createdAt', 'desc')
          .get()
      : Promise.resolve(null),
  ]);

  // Merge and deduplicate by document ID, preserving most-recent-first order
  const seen = new Set<string>();
  const merged: Array<{ id: string } & Record<string, unknown>> = [];

  for (const snap of [ownSnap, offlineSnap]) {
    if (!snap) continue;
    for (const d of snap.docs) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        merged.push({ id: d.id, ...d.data() });
      }
    }
  }

  // Sort by createdAt descending (Firestore timestamps)
  merged.sort((a, b) => {
    const ta = (a.timeline as Record<string, unknown>)?.createdAt as { _seconds?: number } | undefined;
    const tb = (b.timeline as Record<string, unknown>)?.createdAt as { _seconds?: number } | undefined;
    return (tb?._seconds ?? 0) - (ta?._seconds ?? 0);
  });

  const applications = merged;

  return (
    <div className="p-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Applications</h1>
          <p className="text-gray-500 mt-1">Track the status of all your loan applications.</p>
        </div>
        <Link
          href="/applicant/apply"
          className="bg-[#F5A523] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#E08B00] transition-colors"
        >
          New Application
        </Link>
      </div>

      {applications.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-16 text-center">
          <p className="text-gray-500 mb-3">No applications yet.</p>
          <Link href="/applicant/apply" className="text-[#F5A523] font-medium hover:text-[#E08B00]">
            Apply for your first loan →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purpose</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {applications.map((app) => {
                const a = app as Record<string, unknown>;
                const loanDetails = a.loanDetails as Record<string, unknown>;
                const status = a.status as string;
                return (
                  <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      ${(loanDetails?.requestedAmount as number)?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {loanPurposeLabel(loanDetails?.loanPurpose as string | undefined)}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={STATUS_VARIANT[status] ?? 'default'}>
                        {STATUS_LABELS[status] ?? status?.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/applicant/applications/${app.id}`}
                        className="text-[#F5A523] hover:text-[#E08B00] font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
