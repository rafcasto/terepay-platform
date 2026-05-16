import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import { auditLog } from '@/lib/utils/audit';
import { reconcileConsent } from '@/lib/qippay/reconcile-consent';
import type { PaymentConsent } from '@/types/application';
import PendingPoller from './PendingPoller';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  outcome?: 'success' | 'failure';
  stub?: 'success' | 'failure' | 'pending';
}>;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
};

export default async function ConsentReturnPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) notFound();

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded) notFound();

  const db = getAdminDb();
  const snap = await db.collection('loanApplications').doc(id).get();
  if (!snap.exists) notFound();

  const app = snap.data()!;
  if (app.applicantId !== decoded.uid) notFound();

  const consent = app.paymentConsent as PaymentConsent | undefined;

  await auditLog({
    userId: decoded.uid,
    action: 'payment_consent_returned',
    targetId: id,
    targetType: 'application',
    outcome: 'success',
    changes: {
      mandateId: consent?.mandateId,
      hintedStatus: sp.outcome,
      stubHint: sp.stub,
    },
  });

  // Reconcile state from upstream. Returns the up-to-date status which we
  // can render directly without a second Firestore read.
  const reconciled = consent
    ? await reconcileConsent({
        applicationId: id,
        caller: 'return-page',
        callerUid: decoded.uid,
        stubHint: sp.stub,
      })
    : { status: 'not_started' as const };

  const detailHref = `/applicant/applications/${id}`;

  if (reconciled.status === 'active') {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-emerald-200 p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
            <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Bank authorization complete</h1>
          <p className="text-sm text-gray-500 mb-6">
            Your repayment mandate is now active. Your lender can release the loan funds.
          </p>
          <Link
            href={detailHref}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Back to your application
          </Link>
        </div>
      </div>
    );
  }

  if (
    reconciled.status === 'failed' ||
    reconciled.status === 'expired' ||
    reconciled.status === 'cancelled'
  ) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-red-200 p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Bank authorization not completed</h1>
          <p className="text-sm text-gray-500 mb-6">
            {reconciled.status === 'expired'
              ? 'The verification window expired before your bank confirmed the authorization.'
              : reconciled.status === 'cancelled'
                ? 'The authorization was cancelled before completion.'
                : 'Your bank did not confirm the authorization. You can try again from your application.'}
          </p>
          <Link
            href={detailHref}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Return to your application
          </Link>
        </div>
      </div>
    );
  }

  // Pending — render shell + client poller.
  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-50">
          <span className="h-7 w-7 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Waiting for your bank…</h1>
        <p className="text-sm text-gray-500 mb-6">
          We&apos;re confirming the authorization with your bank. This usually takes only a few seconds.
        </p>
        <PendingPoller applicationId={id} detailHref={detailHref} />
      </div>
    </div>
  );
}
