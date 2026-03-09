import { cookies } from 'next/headers';
import { adminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import Link from 'next/link';
import Badge from '@/components/shared/Badge';
import type { ApplicationStatus } from '@/types/application';

const STATUS_VARIANT: Record<ApplicationStatus, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  draft: 'default',
  submitted: 'info',
  under_review: 'warning',
  approved: 'success',
  rejected: 'error',
  funded: 'success',
  completed: 'success',
};

export default async function ApplicantApplicationsPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) return null;

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded) return null;

  const snapshot = await adminDb
    .collection('loanApplications')
    .where('applicantId', '==', decoded.uid)
    .orderBy('timeline.createdAt', 'desc')
    .get();

  const applications = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

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
                const status = a.status as ApplicationStatus;
                return (
                  <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      ${(loanDetails?.requestedAmount as number)?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-600 capitalize">
                      {(loanDetails?.loanPurpose as string)?.replace('_', ' ') ?? '—'}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={STATUS_VARIANT[status] ?? 'default'}>
                        {status?.replace('_', ' ')}
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
