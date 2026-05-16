import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAdminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import type { LoanApplication, AnyApplicationStatus } from '@/types/application';
import SubmitButton from './SubmitButton';
import AcceptOfferButton from './_components/AcceptOfferButton';
import RejectOfferButton from './_components/RejectOfferButton';
import InitiatePaymentConsentCard from './_components/InitiatePaymentConsentCard';
import { loanPurposeLabel } from '@/lib/constants/loan-purposes';
import { computeApplicationFee } from '@/lib/constants/fees';

export const dynamic = 'force-dynamic';

// Status → user-friendly banner configuration
const STATUS_BANNERS: Record<string, { bg: string; text: string; message: string }> = {
  draft: { bg: 'bg-gray-100 border-gray-200', text: 'text-gray-700', message: 'Your application is saved as a draft. Submit when ready.' },
  pending_review: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', message: 'Your application has been submitted and is queued for review.' },
  under_assessment: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', message: 'A lender is currently assessing your application. No action needed.' },
  waiting_for_docs: { bg: 'bg-orange-50 border-orange-300', text: 'text-orange-800', message: 'Additional documents have been requested. Please upload them below.' },
  credit_check: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-800', message: 'Your application is undergoing a credit check. This may take 1–2 business days.' },
  approved: { bg: 'bg-green-50 border-green-300', text: 'text-green-800', message: '🎉 Congratulations! Your loan application has been approved. Please review the terms below and accept your loan offer.' },
  loan_accepted: { bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-800', message: '✅ You have accepted your loan offer. Funds will be disbursed shortly.' },
  awaiting_payment_consent: { bg: 'bg-amber-50 border-amber-300', text: 'text-amber-800', message: '✅ Loan accepted. One last step — authorise your repayments with your bank to release the funds.' },
  offer_declined: { bg: 'bg-gray-100 border-gray-300', text: 'text-gray-700', message: 'You declined this loan offer. To apply again, submit a new application.' },
  disbursed: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', message: 'Your loan has been disbursed. Please check your bank account.' },
  active: { bg: 'bg-teal-50 border-teal-200', text: 'text-teal-800', message: 'Your loan is active. Repayments are scheduled fortnightly.' },
  closed_repaid: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-700', message: 'Your loan has been fully repaid. Thank you!' },
  declined: { bg: 'bg-red-50 border-red-300', text: 'text-red-800', message: 'Unfortunately, your application was not approved at this time.' },
  withdrawn: { bg: 'bg-gray-100 border-gray-200', text: 'text-gray-600', message: 'This application has been withdrawn.' },
  expired: { bg: 'bg-gray-100 border-gray-200', text: 'text-gray-600', message: 'This application has expired.' },
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  under_assessment: 'Under Assessment',
  waiting_for_docs: 'Documents Requested',
  credit_check: 'Credit Check',
  approved: 'Approved',
  loan_accepted: 'Loan Accepted',
  awaiting_payment_consent: 'Awaiting Bank Authorisation',
  offer_declined: 'Offer Declined',
  disbursed: 'Disbursed',
  active: 'Active',
  closed_repaid: 'Repaid',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  expired: 'Expired',
  // legacy
  submitted: 'Submitted',
  under_review: 'Under Review',
  funded: 'Funded',
  completed: 'Completed',
  rejected: 'Declined',
};

const PROGRESS_STEPS = [
  { label: 'Application Submitted', description: 'Your application has been received and queued for review.' },
  { label: 'Lender Review', description: 'A lender picks up your application and begins the assessment.' },
  { label: 'Credit & Income Check', description: 'Income, expenses, and credit are verified before a decision.' },
  { label: 'Decision', description: 'You are notified of the loan outcome, typically within 1–2 business days.' },
  { label: 'Funds Disbursed', description: 'Funds are transferred directly to your bank account.' },
];

// Number of steps fully completed (green tick) for each status.
// The step at index `completedCount` is the current active one.
const STATUS_COMPLETED_COUNT: Record<string, number> = {
  draft: 0, pending_review: 1, under_assessment: 1, waiting_for_docs: 1,
  credit_check: 2, approved: 4, loan_accepted: 4, awaiting_payment_consent: 4, offer_declined: 4,
  disbursed: 5, active: 5, closed_repaid: 5, declined: 3, withdrawn: 1, expired: 1,
  submitted: 1, under_review: 1, funded: 5, completed: 5, rejected: 3,
};

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 break-words">{value ?? '—'}</dd>
    </div>
  );
}

const fmt = (n?: number) =>
  n !== undefined
    ? new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(n)
    : '—';

const fmtDate = (ts?: { _seconds?: number; toDate?: () => Date } | null) => {
  if (!ts) return '—';
  let d: Date;
  if (typeof ts.toDate === 'function') d = ts.toDate();
  else if (ts._seconds) d = new Date(ts._seconds * 1000);
  else return '—';
  return new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
};

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

  // Try new loanApplications collection first, fall back to legacy
  let snap = await db.collection('loanApplications').doc(id).get();
  if (!snap.exists) snap = await db.collection('applications').doc(id).get();
  if (!snap.exists) notFound();

  const app = { applicationId: snap.id, ...snap.data() } as LoanApplication & Record<string, unknown>;
  const status = app.status as AnyApplicationStatus;

  // Ownership check: own application OR lender-created application claimed via customerId
  const userDoc = await db.collection('users').doc(decoded.uid).get();
  const userCustomerId: string | undefined = userDoc.data()?.customerId;

  const isOwner =
    app.applicantId === decoded.uid ||
    (userCustomerId !== undefined && (app as Record<string, unknown>).offlineCustomerId === userCustomerId);

  if (!isOwner) notFound();

  const banner = STATUS_BANNERS[status] ?? STATUS_BANNERS.pending_review;
  const ld = app.loanDetails;
  const pi = app.personalInfo;
  const emp = app.employment;
  const decision = app.decision;
  const repayment = app.repaymentSchedule;
  const docRequest = app.documentRequest as { requiredDocuments?: string[]; message?: string } | undefined;
  const documents = app.documents ?? [];
  const timeline = app.timeline as Record<string, { _seconds?: number; toDate?: () => Date }> | undefined;

  const completedCount = STATUS_COMPLETED_COUNT[status as string] ?? 1;
  const isDeclined = status === 'declined' || status === 'rejected' || status === 'offer_declined';
  const isOfferDeclined = status === 'offer_declined';
  const isAllDone = completedCount >= PROGRESS_STEPS.length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">

      {/* Dashboard link */}
      <Link href="/applicant/dashboard" className="text-sm text-indigo-600 hover:underline">
        ← Dashboard
      </Link>

      {/* Success card — only shown immediately after submission */}
      {justSubmitted && (
        <div className="bg-white rounded-2xl border border-green-200 p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
            <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">
            Application Submitted{pi?.firstName ? `, ${pi.firstName}` : ''}!
          </h1>
          <p className="text-sm text-gray-500 mb-3">
            Your application is now with our team. We&apos;ll keep you updated every step of the way.
          </p>
          {app.referenceNumber && (
            <span className="inline-block text-xs font-mono text-indigo-600 bg-indigo-50 rounded-lg px-3 py-1.5">
              Reference: {app.referenceNumber as string}
            </span>
          )}
        </div>
      )}

      {/* Loan Progress Timeline — always visible, reflects current status */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Loan Progress</h2>
        <ol className="space-y-0">
          {PROGRESS_STEPS.map((step, i) => {
            const isDone = i < completedCount;
            const isCurrent = !isAllDone && !isDeclined && i === completedCount;
            const isDeclinedStep = isDeclined && i === completedCount;
            const isLast = i === PROGRESS_STEPS.length - 1;
            return (
              <li key={step.label} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                    isDone ? 'border-green-500 bg-green-500'
                    : isCurrent ? 'border-[#F5A523] bg-[#FEF7E9]'
                    : isDeclinedStep ? 'border-red-400 bg-red-50'
                    : 'border-gray-200 bg-white'
                  }`}>
                    {isDone ? (
                      <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    ) : isDeclinedStep ? (
                      <svg className="h-3.5 w-3.5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <span className={`text-xs font-bold ${isCurrent ? 'text-[#F5A523]' : 'text-gray-300'}`}>{i + 1}</span>
                    )}
                  </div>
                  {!isLast && (
                    <div className={`mt-0.5 mb-0.5 w-0.5 flex-1 min-h-[16px] ${isDone ? 'bg-green-200' : 'bg-gray-100'}`} />
                  )}
                </div>
                <div className={isLast ? 'pb-0' : 'pb-4'}>
                  <p className={`text-sm font-semibold ${
                    isDone ? 'text-green-700' : isCurrent ? 'text-[#E08B00]' : isDeclinedStep ? 'text-red-600' : 'text-gray-400'
                  }`}>
                    {isDeclinedStep ? (isOfferDeclined ? 'Offer Declined' : 'Application Declined') : step.label}
                  </p>
                  <p className={`text-xs mt-0.5 leading-relaxed ${
                    isDone || isCurrent ? 'text-gray-500' : isDeclinedStep ? 'text-red-400' : 'text-gray-300'
                  }`}>
                    {isDeclinedStep
                      ? isOfferDeclined
                        ? 'You declined this loan offer.'
                        : 'Your application was not approved at this time.'
                      : step.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Application{' '}
            <span className="font-mono text-indigo-700">
              {app.referenceNumber ?? `#${id.slice(0, 8)}`}
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Submitted {fmtDate(timeline?.submittedAt ?? null)}
          </p>
        </div>
        <span className="shrink-0 text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-700">
          {STATUS_LABELS[status] ?? status}
        </span>
      </div>

      {/* Status Banner */}
      <div className={`rounded-xl border p-4 text-sm font-medium ${banner.bg} ${banner.text}`}>
        {banner.message}
        {status === 'approved' && (
          <div className="mt-4 flex flex-wrap gap-3">
            <AcceptOfferButton applicationId={id} />
            <RejectOfferButton applicationId={id} />
          </div>
        )}
      </div>

      {/* Payment consent (Qippay SetPay mandate) action card */}
      {status === 'awaiting_payment_consent' && (
        <InitiatePaymentConsentCard
          applicationId={id}
          paymentConsent={
            app.paymentConsent
              ? {
                  status: app.paymentConsent.status,
                  hostedUrl: app.paymentConsent.hostedUrl,
                  installments: app.paymentConsent.scheduleSummary?.installments?.map((i) => ({
                    dueDate: i.dueDate,
                    amountCents: i.amountCents,
                  })),
                }
              : undefined
          }
        />
      )}

      {/* Document Request Banner */}
      {status === 'waiting_for_docs' && docRequest?.requiredDocuments && (
        <div className="bg-orange-50 border border-orange-300 rounded-xl p-4 text-sm text-orange-800">
          <p className="font-semibold mb-2">Documents Required:</p>
          <ul className="list-disc list-inside space-y-1">
            {docRequest.requiredDocuments.map((doc) => (
              <li key={doc}>{doc}</li>
            ))}
          </ul>
          {docRequest.message && <p className="mt-2 text-orange-700">{docRequest.message}</p>}
          <p className="mt-3 text-xs text-orange-600">
            Please contact your lender or upload documents through the TerePay portal.
          </p>
        </div>
      )}

      {/* Loan Summary */}
      {(() => {
        const PRE_APPROVAL_STATUSES = new Set([
          'draft',
          'pending_review',
          'under_assessment',
          'waiting_for_docs',
          'credit_check',
          'submitted',
          'under_review',
        ]);
        const APPROVED_STATUSES = new Set(['approved', 'loan_accepted', 'awaiting_payment_consent']);
        const DISBURSED_STATUSES = new Set([
          'disbursed',
          'active',
          'closed_repaid',
          'funded',
          'completed',
        ]);
        const HIDE_STATUSES = new Set(['declined', 'withdrawn', 'expired', 'rejected', 'offer_declined']);

        const isExistingCustomer =
          (app as Record<string, unknown>).isExistingCustomer === true ||
          userDoc.data()?.isExistingCustomer === true;
        const estimatedFee = computeApplicationFee(isExistingCustomer);
        const requested = ld?.requestedAmount ?? 0;
        const approved = ld?.approvedAmount;
        const fee =
          (ld as Record<string, unknown>)?.applicationFee != null
            ? ((ld as Record<string, unknown>).applicationFee as number)
            : estimatedFee;
        const disbursed = (ld as Record<string, unknown>)?.disbursedAmount as number | undefined;

        let estimateRow: { label: string; value: string; caption?: string } | null = null;
        if (DISBURSED_STATUSES.has(status as string) && disbursed != null) {
          estimateRow = { label: 'Loan Disbursement Amount', value: fmt(disbursed) };
        } else if (APPROVED_STATUSES.has(status as string) && typeof approved === 'number') {
          estimateRow = {
            label: 'Estimated Loan Disbursement',
            value: fmt(approved - fee),
            caption: `Approved ${fmt(approved)} less ${fmt(fee)} application fee.`,
          };
        } else if (PRE_APPROVAL_STATUSES.has(status as string)) {
          estimateRow = {
            label: 'Estimated Loan Disbursement',
            value: fmt(requested - estimatedFee),
            caption: `Final amount may differ. A ${fmt(estimatedFee)} application fee is deducted from the requested amount at disbursement.`,
          };
        } else if (HIDE_STATUSES.has(status as string)) {
          estimateRow = null;
        }

        const approvedValue =
          ld?.approvedAmount != null && ld.approvedAmount < (ld.requestedAmount ?? 0)
            ? `${fmt(ld.approvedAmount)} (less than requested)`
            : fmt(ld?.approvedAmount);

        return (
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Loan Details</h2>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Requested Amount" value={fmt(ld?.requestedAmount)} />
              <Field label="Purpose" value={loanPurposeLabel(ld?.loanPurpose)} />
              <Field label="Interest Rate" value="4.7% (8 weeks)" />
              <Field label="Repayments" value="4 × fortnightly" />
              {ld?.approvedAmount && <Field label="Approved Amount" value={approvedValue} />}
              {(ld as Record<string, unknown>)?.applicationFee != null && (
                <Field label="Application Fee" value={fmt((ld as Record<string, unknown>).applicationFee as number)} />
              )}
              {ld?.fortnightlyPayment && <Field label="Fortnightly Payment" value={fmt(ld.fortnightlyPayment)} />}
              {ld?.totalRepayment && <Field label="Total Repayment" value={fmt(ld.totalRepayment)} />}
            </dl>
            {estimateRow && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {estimateRow.label}
                  </dt>
                  <dd className="text-base font-semibold text-gray-900">{estimateRow.value}</dd>
                </div>
                {estimateRow.caption && (
                  <p className="mt-1 text-xs text-gray-500">{estimateRow.caption}</p>
                )}
              </div>
            )}
          </section>
        );
      })()}

      {/* Approval / Decline Decision */}
      {decision && (
        <section className={`rounded-xl border p-5 ${
          decision.action === 'approved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <h2 className={`font-semibold mb-3 ${decision.action === 'approved' ? 'text-green-800' : 'text-red-800'}`}>
            {decision.action === 'approved' ? '✓ Loan Approved' : '✗ Application Declined'}
          </h2>
          {decision.action === 'approved' && (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Approved Amount" value={fmt(decision.approvedAmount)} />
            </dl>
          )}
          {decision.action === 'declined' && decision.declineReasons && decision.declineReasons.length > 0 && (
            <div>
              <p className="text-xs font-medium text-red-600 mb-1">Reasons:</p>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-0.5">
                {decision.declineReasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Repayment Schedule */}
      {repayment && repayment.installments && repayment.installments.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Repayment Schedule</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-2 text-left font-medium text-gray-500">#</th>
                  <th className="py-2 text-left font-medium text-gray-500">Due Date</th>
                  <th className="py-2 text-right font-medium text-gray-500">Amount</th>
                  <th className="py-2 text-right font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {repayment.installments.map((ins) => (
                  <tr key={ins.installmentNumber} className="border-b border-gray-50">
                    <td className="py-2 text-gray-500">{ins.installmentNumber}</td>
                    <td className="py-2 text-gray-700">{ins.dueDate}</td>
                    <td className="py-2 text-right font-medium text-gray-900">{fmt(ins.amount)}</td>
                    <td className="py-2 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        ins.status === 'paid' ? 'bg-green-100 text-green-700' :
                        ins.status === 'overdue' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {ins.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td colSpan={2} className="py-2 font-medium text-gray-700 text-xs">Total Repayment</td>
                  <td className="py-2 text-right font-bold text-gray-900 text-xs">{fmt(repayment.totalRepayment)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Uploaded Documents</h2>
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li key={doc.documentId} className="flex items-center justify-between text-sm gap-3">
                <span className="text-gray-700 truncate">{doc.fileName}</span>
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                  doc.status === 'accepted' ? 'bg-green-100 text-green-700' :
                  doc.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {doc.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Personal Info Summary */}
      {pi && (
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Personal Information</h2>
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Name" value={`${pi.firstName} ${pi.lastName}`} />
            <Field label="Date of Birth" value={pi.dateOfBirth} />
            <Field label="Email" value={pi.email} />
            <Field label="Phone" value={pi.phone} />
            <Field label="Address" value={`${pi.address}, ${pi.city} ${pi.postCode}`} />
            <Field label="Visa Status" value={pi.visaStatus?.replace(/_/g, ' ')} />
          </dl>
        </section>
      )}

      {/* Employment Summary */}
      {emp && (
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Employment</h2>
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Employer" value={emp.employerName} />
            <Field label="Occupation" value={emp.occupation} />
            <Field label="Status" value={emp.employmentStatus?.replace(/_/g, ' ')} />
            <Field label="Hours/Week" value={emp.hoursPerWeek} />
          </dl>
        </section>
      )}

      {/* Draft Actions */}
      {status === 'draft' && (
        <div className="flex gap-3">
          <Link
            href={`/applicant/apply`}
            className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Continue Application
          </Link>
          <SubmitButton id={id} />
        </div>
      )}

      {/* Back to Dashboard */}
      <Link
        href="/applicant/dashboard"
        className="block w-full py-3 px-4 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl text-center hover:bg-gray-50 transition-colors"
      >
        ← Back to Dashboard
      </Link>
    </div>
  );
}

