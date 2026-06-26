import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionOrIdToken, getAdminDb } from '@/lib/firebase/admin';
import { resolveOnboardingStep } from '@/lib/auth/onboarding';
import { toDisplayState, type LoanDisplayState } from '@/lib/loan/status-display';
import { toDate } from '@/lib/loan/format';
import {
  deriveLoanSummary,
  isLiveLoanStatus,
  isClosedLoanStatus,
} from '@/lib/loan/active-loan';
import type { LoanApplication } from '@/types/application';
import LoanHero, { type DashboardHeroData } from './_components/LoanHero';
import LoanCalculatorCard from './_components/LoanCalculatorCard';
import QuickActions from './_components/QuickActions';

function getGreeting(): string {
  const hour = new Date().getUTCHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

type RecentApp = LoanApplication & { id: string };

async function getDashboardData(uid: string) {
  const db = getAdminDb();
  const [userSnap, appsSnap, loansSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('loanApplications').where('applicantId', '==', uid).limit(20).get(),
    db.collection('loans').where('applicantId', '==', uid).get(),
  ]);

  // Most recent active / delinquent loan (from the dedicated loans collection,
  // when present). The application document remains the source of truth for the
  // repayment schedule and balance — see derivation below.
  const loanDoc = loansSnap.docs
    .map((d) => d.data())
    .find((l) => l.status === 'active' || l.status === 'delinquent' || l.status === 'closed_repaid');

  // Most recent application (any status), to drive review/approved/rejected and
  // — crucially — the disbursed/active loan hero.
  const allApps = appsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as RecentApp))
    .sort((a, b) => {
      const ad = toDate(a.timeline?.createdAt as Parameters<typeof toDate>[0])?.getTime() ?? 0;
      const bd = toDate(b.timeline?.createdAt as Parameters<typeof toDate>[0])?.getTime() ?? 0;
      return bd - ad;
    });
  const recentApp = allApps[0];

  return {
    user: userSnap.data(),
    loanDoc,
    recentApp,
  };
}

export default async function ApplicantDashboard() {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) redirect('/auth/login');

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded) redirect('/auth/login');

  const nextOnboardingStep = await resolveOnboardingStep(decoded.uid);
  if (nextOnboardingStep) redirect(nextOnboardingStep);

  const { user, loanDoc, recentApp } = await getDashboardData(decoded.uid);

  let state: LoanDisplayState = 'new';
  let heroData: DashboardHeroData = { state: 'new' };

  if (recentApp && (isLiveLoanStatus(recentApp.status) || isClosedLoanStatus(recentApp.status))) {
    // Derive the live loan from the application — the source of truth for the
    // schedule and balance (scheduledPayments is kept current by the Qippay
    // webhook). This makes a disbursed loan show its real remaining balance and
    // stops the dashboard from inviting a second loan while one is outstanding.
    const summary = deriveLoanSummary(recentApp);
    const fullyPaid = isClosedLoanStatus(recentApp.status) || summary.isFullyPaid;
    state = fullyPaid ? 'paid' : 'active';
    heroData = {
      state,
      loan: {
        remainingBalance: summary.remainingBalance,
        totalPaid: summary.totalPaid,
        nextPaymentDate: summary.nextPaymentDate ?? new Date().toISOString(),
        isDelinquent: !fullyPaid && summary.isDelinquent,
      },
    };
  } else if (loanDoc) {
    // Fallback: a dedicated loans-collection record with no live application
    // (e.g. seeded data).
    if (loanDoc.status === 'closed_repaid') {
      state = 'paid';
    } else {
      state = 'active';
    }
    const rawDate = loanDoc.nextPaymentDate as { toDate?: () => Date } | undefined;
    const nextPaymentDate =
      rawDate && typeof rawDate.toDate === 'function'
        ? (rawDate.toDate() as Date).toISOString()
        : new Date().toISOString();
    heroData = {
      state,
      loan: {
        remainingBalance: loanDoc.remainingBalance as number,
        totalPaid: loanDoc.totalPaid as number,
        nextPaymentDate,
        isDelinquent: loanDoc.status === 'delinquent',
      },
    };
  } else if (recentApp?.status) {
    state = toDisplayState(recentApp.status);
    heroData = {
      state,
      application: {
        id: recentApp.id,
        referenceNumber: recentApp.referenceNumber,
        requestedAmount: recentApp.loanDetails?.requestedAmount,
        approvedAmount: recentApp.loanDetails?.approvedAmount,
        submittedAt: toDate(recentApp.timeline?.submittedAt as Parameters<typeof toDate>[0])?.toISOString() ?? null,
      },
    };
  }

  const greeting = getGreeting();
  const firstName = (user?.firstName as string | undefined) ?? null;

  return (
    <div className="px-4 sm:px-5 pt-6 pb-20 max-w-[540px] mx-auto space-y-5">
      <div>
        <p className="text-sm text-muted">{greeting} 👋</p>
        <h1 className="mt-0.5 text-[26px] font-bold tracking-tight text-text">
          Welcome back{firstName ? `, ${firstName}` : ''}
        </h1>
      </div>

      <LoanHero data={heroData} firstName={firstName} />

      {/* The loan calculator only invites a new loan when the borrower has no
          outstanding loan. While a loan is active it stays hidden so a second
          loan can't be started until the current one is fully repaid. */}
      {state === 'new' && <LoanCalculatorCard />}

      <QuickActions state={state} pendingAppId={recentApp?.id ?? null} />

      <p className="pt-2 text-center text-[12.5px] text-muted">
        Need help? Email{' '}
        <a href="mailto:support@terepay.co.nz" className="font-semibold text-accent-2 hover:underline">
          support@terepay.co.nz
        </a>
      </p>
    </div>
  );
}
