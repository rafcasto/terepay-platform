import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getAdminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import type {
  LoanApplication,
  AnyApplicationStatus,
  PaymentConsent,
  ScheduledPayment,
} from '@/types/application';
import { reconcileConsent } from '@/lib/qippay/reconcile-consent';
import { toDisplayState } from '@/lib/loan/status-display';
import { Card, Icons } from '@/components/ui';
import ScreenDraft from '@/components/applicant/screens/ScreenDraft';
import ScreenInReview from '@/components/applicant/screens/ScreenInReview';
import ScreenApproved from '@/components/applicant/screens/ScreenApproved';
import ScreenRejected from '@/components/applicant/screens/ScreenRejected';
import ScreenActive from '@/components/applicant/screens/ScreenActive';
import ScreenPaid from '@/components/applicant/screens/ScreenPaid';

export const dynamic = 'force-dynamic';

export default async function ApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const justSubmitted = sp.submitted === 'true';

  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) redirect('/auth/login');

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded) redirect('/auth/login');

  const db = getAdminDb();

  // Try the new loanApplications collection first, fall back to legacy.
  let snap = await db.collection('loanApplications').doc(id).get();
  if (!snap.exists) snap = await db.collection('applications').doc(id).get();
  if (!snap.exists) notFound();

  const app = { applicationId: snap.id, ...snap.data() } as LoanApplication & Record<string, unknown>;
  const status = app.status as AnyApplicationStatus;

  // Ownership: own application OR a lender-created application claimed via customerId.
  const userDoc = await db.collection('users').doc(decoded.uid).get();
  const userCustomerId: string | undefined = userDoc.data()?.customerId;
  const isOwner =
    app.applicantId === decoded.uid ||
    (userCustomerId !== undefined &&
      (app as Record<string, unknown>).offlineCustomerId === userCustomerId);
  if (!isOwner) notFound();

  // If a SetPay mandate is in flight, reconcile against Qippay before rendering —
  // the user may have approved at their bank in another tab. The reconciler is
  // internally rate-limited (one upstream call / 10s) so this is cheap.
  if (status === 'awaiting_payment_consent') {
    const pc = app.paymentConsent as PaymentConsent | undefined;
    const nonTerminal =
      pc &&
      pc.status !== 'active' &&
      pc.status !== 'failed' &&
      pc.status !== 'expired' &&
      pc.status !== 'cancelled';
    if (nonTerminal) {
      const reconciled = await reconcileConsent({
        applicationId: id,
        caller: 'applicant',
        callerUid: decoded.uid,
      }).catch(() => null);
      if (reconciled?.status === 'active') {
        snap = await db.collection('loanApplications').doc(id).get();
        Object.assign(app, snap.data() ?? {});
      }
    }
  }

  const isExistingCustomer =
    (app as Record<string, unknown>).isExistingCustomer === true ||
    userDoc.data()?.isExistingCustomer === true;
  const scheduledPayments = ((app.scheduledPayments ?? []) as ScheduledPayment[]);

  const display = toDisplayState(status);
  let screen: React.ReactNode;
  switch (display) {
    case 'draft':
      screen = <ScreenDraft app={app} applicationId={id} />;
      break;
    case 'approved':
      screen = (
        <ScreenApproved
          app={app}
          status={status}
          applicationId={id}
          isExistingCustomer={isExistingCustomer}
        />
      );
      break;
    case 'rejected':
      screen = <ScreenRejected app={app} status={status} applicationId={id} />;
      break;
    case 'active':
      screen = (
        <ScreenActive
          app={app}
          status={status}
          applicationId={id}
          scheduledPayments={scheduledPayments}
        />
      );
      break;
    case 'paid':
      screen = <ScreenPaid app={app} applicationId={id} />;
      break;
    case 'review':
    default:
      screen = <ScreenInReview app={app} status={status} applicationId={id} />;
      break;
  }

  return (
    <div className="max-w-[640px] mx-auto px-4 sm:px-5 pt-6 pb-20 space-y-5 screen-in">
      <Link
        href="/applicant/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text-muted)] hover:text-ink-strong transition-colors"
      >
        <Icons.ArrowLeft size={16} />
        Dashboard
      </Link>

      {justSubmitted && (
        <Card className="border-[color-mix(in_srgb,var(--success-500)_30%,transparent)] bg-success-soft">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-[#0e6b2e]">
              <Icons.Check size={20} strokeWidth={2.5} />
            </span>
            <div>
              <p className="text-sm font-bold text-ink-strong">
                Application submitted
                {app.personalInfo?.firstName ? `, ${app.personalInfo.firstName}` : ''}
              </p>
              <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">
                It&apos;s now with our team. We&apos;ll keep you updated every step of the way
                {app.referenceNumber ? ` — reference ${app.referenceNumber as string}` : ''}.
              </p>
            </div>
          </div>
        </Card>
      )}

      {screen}
    </div>
  );
}
