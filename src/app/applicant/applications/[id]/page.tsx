import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAdminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import type { LoanApplication, AnyApplicationStatus, PaymentConsent } from '@/types/application';
import { reconcileConsent } from '@/lib/qippay/reconcile-consent';
import { toDisplayState } from '@/lib/loan/status-display';
import { Card, Icons } from '@/components/ui';
import ScreenInReview from '@/components/applicant/screens/ScreenInReview';
import ScreenApproved from '@/components/applicant/screens/ScreenApproved';
import ScreenRejected from '@/components/applicant/screens/ScreenRejected';
import ScreenActive from '@/components/applicant/screens/ScreenActive';
import ScreenPaid from '@/components/applicant/screens/ScreenPaid';
import ScreenDraft from '@/components/applicant/screens/ScreenDraft';

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
  if (!session) return null;

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded) return null;

  const db = getAdminDb();

  let snap = await db.collection('loanApplications').doc(id).get();
  if (!snap.exists) snap = await db.collection('applications').doc(id).get();
  if (!snap.exists) notFound();

  const app = { applicationId: snap.id, ...snap.data() } as LoanApplication & Record<string, unknown>;
  const status = app.status as AnyApplicationStatus;

  // Ownership: own application OR lender-created application claimed via customerId
  const userDoc = await db.collection('users').doc(decoded.uid).get();
  const userCustomerId: string | undefined = userDoc.data()?.customerId;
  const isOwner =
    app.applicantId === decoded.uid ||
    (userCustomerId !== undefined && (app as Record<string, unknown>).offlineCustomerId === userCustomerId);
  if (!isOwner) notFound();

  // SetPay reconcile (user may have approved at their bank in another tab).
  // Rate-limited upstream to one call per 10s — cheap.
  if (status === 'awaiting_payment_consent') {
    const pc = app.paymentConsent as PaymentConsent | undefined;
    const nonTerminal =
      pc && pc.status !== 'active' && pc.status !== 'failed' &&
      pc.status !== 'expired' && pc.status !== 'cancelled';
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

  const display = toDisplayState(status);

  // Drafts have their own minimal screen
  const isDraft = status === 'draft';

  let screen: React.ReactNode;
  if (isDraft) {
    screen = <ScreenDraft app={app} applicationId={id} />;
  } else if (display === 'review') {
    screen = <ScreenInReview app={app} status={status} applicationId={id} />;
  } else if (display === 'approved') {
    screen = <ScreenApproved app={app} status={status} applicationId={id} isExistingCustomer={isExistingCustomer} />;
  } else if (display === 'rejected') {
    screen = <ScreenRejected app={app} status={status} applicationId={id} />;
  } else if (display === 'active') {
    screen = <ScreenActive app={app} status={status} applicationId={id} />;
  } else if (display === 'paid') {
    screen = <ScreenPaid app={app} applicationId={id} />;
  } else {
    screen = <ScreenInReview app={app} status={status} applicationId={id} />;
  }

  return (
    <div className="max-w-[540px] mx-auto px-4 pt-4 pb-20 space-y-5 screen-in">
      <Link
        href="/applicant/dashboard"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-text transition-colors"
      >
        <Icons.ArrowLeft size={16} /> Dashboard
      </Link>

      {justSubmitted && (
        <Card className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
            <Icons.CheckCircle size={24} />
          </div>
          <h1 className="text-lg font-bold text-text">
            Application submitted{(app.personalInfo?.firstName as string | undefined) ? `, ${app.personalInfo!.firstName}` : ''}!
          </h1>
          <p className="mt-1 text-sm text-muted">
            Your application is now with our team. We&apos;ll keep you updated every step of the way.
          </p>
          {app.referenceNumber && (
            <span className="mt-3 inline-block text-xs font-mono text-accent-2 bg-accent-soft rounded-lg px-3 py-1.5">
              Reference: {app.referenceNumber as string}
            </span>
          )}
        </Card>
      )}

      {screen}
    </div>
  );
}
