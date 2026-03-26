import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionOrIdToken, getAdminDb } from '@/lib/firebase/admin';
import { resolveOnboardingStep } from '@/lib/auth/onboarding';
import ActiveLoanCard, { type ActiveLoanData } from './_components/ActiveLoanCard';
import QuickActions from './_components/QuickActions';

const PENDING_STATUSES = new Set([
  'pending_review',
  'under_assessment',
  'waiting_for_docs',
  'credit_check',
  'approved',
  'disbursed',
]);

function getGreeting(): string {
  const hour = new Date().getUTCHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

async function getDashboardData(uid: string) {
  const db = getAdminDb();
  const [userSnap, appsSnap, loansSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db
      .collection('loanApplications')
      .where('applicantId', '==', uid)
      .limit(10)
      .get(),
    db
      .collection('loans')
      .where('applicantId', '==', uid)
      .get(),
  ]);

  // Find most recent active/delinquent loan
  const loanDoc = loansSnap.docs
    .map((d) => d.data())
    .find((l) => l.status === 'active' || l.status === 'delinquent');

  let activeLoan: ActiveLoanData = null;
  if (loanDoc) {
    const rawDate = loanDoc.nextPaymentDate;
    const nextPaymentDate =
      rawDate && typeof rawDate.toDate === 'function'
        ? (rawDate.toDate() as Date).toISOString()
        : new Date().toISOString();

    activeLoan = {
      status: loanDoc.status as 'active' | 'delinquent',
      remainingBalance: loanDoc.remainingBalance as number,
      totalPaid: loanDoc.totalPaid as number,
      nextPaymentDate,
    };
  }

  const hasPendingApp = appsSnap.docs.some((d) =>
    PENDING_STATUSES.has(d.data().status as string),
  );

  return {
    user: userSnap.data(),
    activeLoan,
    hasPendingApp,
  };
}

export default async function ApplicantDashboard() {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;

  if (!session) return null; // middleware handles redirect

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded) return null;

  // Redirect to the first incomplete onboarding step, if any
  const nextOnboardingStep = await resolveOnboardingStep(decoded.uid);
  if (nextOnboardingStep) redirect(nextOnboardingStep);

  const { user, activeLoan, hasPendingApp } = await getDashboardData(decoded.uid);

  const greeting = getGreeting();

  return (
    <div className="px-4 pt-6 pb-10 max-w-lg mx-auto">
      {/* Greeting */}
      <p className="text-sm text-gray-500">{greeting} 👋</p>
      <h1 className="text-2xl font-bold text-gray-900 mt-0.5 mb-6">
        Welcome back, {user?.firstName ?? 'there'}
      </h1>

      {/* Loan status card */}
      <ActiveLoanCard activeLoan={activeLoan} hasPendingApp={hasPendingApp} />

      {/* Quick actions */}
      <QuickActions />
    </div>
  );
}
