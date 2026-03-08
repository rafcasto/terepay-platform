import { cookies } from 'next/headers';
import { adminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import Link from 'next/link';
import Badge from '@/components/shared/Badge';
import type { ApplicationStatus } from '@/types/application';

async function getDashboardData(uid: string) {
  const [userSnap, appsSnap] = await Promise.all([
    adminDb.collection('users').doc(uid).get(),
    adminDb
      .collection('loanApplications')
      .where('applicantId', '==', uid)
      .orderBy('timeline.createdAt', 'desc')
      .limit(5)
      .get(),
  ]);

  return {
    user: userSnap.data(),
    recentApplications: appsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

const STATUS_VARIANT: Record<ApplicationStatus, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  draft: 'default',
  submitted: 'info',
  under_review: 'warning',
  approved: 'success',
  rejected: 'error',
  funded: 'success',
  completed: 'success',
};

export default async function ApplicantDashboard() {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;

  if (!session) return null; // middleware handles redirect

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded) return null;

  const { user, recentApplications } = await getDashboardData(decoded.uid);

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Welcome back, {user?.firstName ?? 'there'}!
        </h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">Here&apos;s an overview of your loan activity.</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Link
          href="/applicant/apply"
          className="bg-indigo-600 text-white rounded-xl p-4 sm:p-5 hover:bg-indigo-700 transition-colors"
        >
          <p className="text-xs sm:text-sm font-medium opacity-80">Ready to borrow?</p>
          <p className="text-base sm:text-lg font-semibold mt-1">Apply for a Loan →</p>
        </Link>
        <Link
          href="/applicant/applications"
          className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 hover:border-indigo-300 transition-colors"
        >
          <p className="text-xs sm:text-sm text-gray-500">Track progress</p>
          <p className="text-base sm:text-lg font-semibold text-gray-900 mt-1">My Applications</p>
        </Link>
        <Link
          href="/applicant/profile"
          className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 hover:border-indigo-300 transition-colors"
        >
          <p className="text-xs sm:text-sm text-gray-500">Keep info current</p>
          <p className="text-base sm:text-lg font-semibold text-gray-900 mt-1">Update Profile</p>
        </Link>
      </div>

      {/* Recent applications */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="font-semibold text-gray-900">Recent Applications</h2>
          <Link href="/applicant/applications" className="text-sm text-indigo-600 hover:text-indigo-500 shrink-0 ml-4">
            View all
          </Link>
        </div>
        {recentApplications.length === 0 ? (
          <div className="px-4 sm:px-6 py-10 text-center text-gray-500">
            <p>You haven&apos;t submitted any applications yet.</p>
            <Link href="/applicant/apply" className="mt-2 inline-block text-indigo-600 hover:text-indigo-500 text-sm font-medium">
              Start your first application →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentApplications.map((app) => {
              const a = app as Record<string, unknown>;
              const loanDetails = a.loanDetails as Record<string, unknown>;
              const status = a.status as ApplicationStatus;
              return (
                <li key={app.id} className="px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      ${(loanDetails?.requestedAmount as number)?.toLocaleString() ?? '—'} loan
                    </p>
                    <p className="text-xs text-gray-500 capitalize truncate">
                      {(loanDetails?.loanPurpose as string)?.replace('_', ' ') ?? '—'}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[status] ?? 'default'}>
                    {status?.replace('_', ' ')}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
