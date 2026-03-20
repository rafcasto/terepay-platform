import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionOrIdToken, getAdminDb } from '@/lib/firebase/admin';
import { resolveOnboardingStep } from '@/lib/auth/onboarding';
import Link from 'next/link';
import Badge from '@/components/shared/Badge';

async function getDashboardData(uid: string) {
  const db = getAdminDb();
  const [userSnap, appsSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db
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

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  draft: 'default',
  pending_review: 'info',
  under_assessment: 'warning',
  waiting_for_docs: 'warning',
  credit_check: 'info',
  approved: 'success',
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

export default async function ApplicantDashboard() {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;

  if (!session) return null; // middleware handles redirect

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded) return null;

  // Redirect to the first incomplete onboarding step, if any
  const nextOnboardingStep = await resolveOnboardingStep(decoded.uid);
  if (nextOnboardingStep) redirect(nextOnboardingStep);

  const { user, recentApplications } = await getDashboardData(decoded.uid);

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8">
      {/* Email verification banner */}
      {!decoded.email_verified && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
          <div className="flex-1 text-sm">
            <p className="font-medium text-amber-800">Please verify your email address</p>
            <p className="text-amber-700 mt-0.5">
              You won&apos;t be able to submit a loan application until you verify your email.{' '}
              <a href="/applicant/verify-email" className="font-semibold underline underline-offset-2 hover:text-amber-900">
                Verify now →
              </a>
            </p>
          </div>
        </div>
      )}
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
          className="bg-[#F5A523] text-white rounded-xl p-4 sm:p-5 hover:bg-[#E08B00] transition-colors"
        >
          <p className="text-xs sm:text-sm font-medium opacity-80">Ready to borrow?</p>
          <p className="text-base sm:text-lg font-semibold mt-1">Apply for a Loan →</p>
        </Link>
        <Link
          href="/applicant/applications"
          className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 hover:border-[#F5A523]/50 transition-colors"
        >
          <p className="text-xs sm:text-sm text-gray-500">Track progress</p>
          <p className="text-base sm:text-lg font-semibold text-gray-900 mt-1">My Applications</p>
        </Link>
        <Link
          href="/applicant/profile"
          className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 hover:border-[#F5A523]/50 transition-colors"
        >
          <p className="text-xs sm:text-sm text-gray-500">Keep info current</p>
          <p className="text-base sm:text-lg font-semibold text-gray-900 mt-1">Update Profile</p>
        </Link>
      </div>

      {/* Recent applications */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="font-semibold text-gray-900">Recent Applications</h2>
          <Link href="/applicant/applications" className="text-sm text-[#F5A523] hover:text-[#E08B00] shrink-0 ml-4">
            View all
          </Link>
        </div>
        {recentApplications.length === 0 ? (
          <div className="px-4 sm:px-6 py-10 text-center text-gray-500">
            <p>You haven&apos;t submitted any applications yet.</p>
            <Link href="/applicant/apply" className="mt-2 inline-block text-[#F5A523] hover:text-[#E08B00] text-sm font-medium">
              Start your first application →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentApplications.map((app) => {
              const a = app as Record<string, unknown>;
              const loanDetails = a.loanDetails as Record<string, unknown>;
              const status = a.status as string;
              return (
                <li key={app.id} className="px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      ${(loanDetails?.requestedAmount as number)?.toLocaleString() ?? '—'} loan
                    </p>
                    <p className="text-xs text-gray-500 capitalize truncate">
                      {(loanDetails?.loanPurpose as string)?.replace(/_/g, ' ') ?? '—'}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[status] ?? 'default'}>
                    {STATUS_LABELS[status] ?? status?.replace(/_/g, ' ')}
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
