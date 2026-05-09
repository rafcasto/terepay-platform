import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getAdminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import type { LoanApplication } from '@/types/application';
import ApplicationActions from './ApplicationActions';
import AddNoteForm from './AddNoteForm';
import DecisionForm from './DecisionForm';
import ExistingCustomerToggle from './ExistingCustomerToggle';
import { loanPurposeLabel } from '@/lib/constants/loan-purposes';
import { computeApplicationFee } from '@/lib/constants/fees';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  under_assessment: 'Under Assessment',
  waiting_for_docs: 'Waiting for Docs',
  credit_check: 'Credit Check',
  approved: 'Approved',
  disbursed: 'Disbursed',
  active: 'Active',
  closed_repaid: 'Repaid',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  expired: 'Expired',
};

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending_review: 'bg-amber-100 text-amber-800',
  under_assessment: 'bg-blue-100 text-blue-800',
  waiting_for_docs: 'bg-orange-100 text-orange-800',
  credit_check: 'bg-purple-100 text-purple-800',
  approved: 'bg-green-100 text-green-700',
  disbursed: 'bg-emerald-100 text-emerald-700',
  active: 'bg-teal-100 text-teal-700',
  closed_repaid: 'bg-gray-100 text-gray-600',
  declined: 'bg-red-100 text-red-700',
  withdrawn: 'bg-gray-100 text-gray-500',
  expired: 'bg-gray-100 text-gray-500',
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

const fmtTs = (ts?: { _seconds?: number; toDate?: () => Date } | null) => {
  if (!ts) return '—';
  let d: Date;
  if (typeof ts.toDate === 'function') d = ts.toDate();
  else if (ts._seconds) d = new Date(ts._seconds * 1000);
  else return '—';
  return new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
};

export default async function LenderApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get('__session')?.value;
  if (!token) redirect('/auth/login');

  const decoded = await verifySessionOrIdToken(token).catch(() => null);
  if (!decoded || decoded.role !== 'lender') redirect('/auth/login');

  const db = getAdminDb();
  const snap = await db.collection('loanApplications').doc(id).get();
  if (!snap.exists) notFound();

  const app = { applicationId: snap.id, ...snap.data() } as LoanApplication;
  const status = app.status;
  const pi = app.personalInfo;
  const emp = app.employment;
  const ld = app.loanDetails;
  const expenses = app.livingExpenses;
  const debts = app.existingDebts;
  const notes = app.internalNotes ?? [];
  const docs = app.documents ?? [];
  const decision = app.decision;
  const timeline = app.timeline as Record<string, unknown>;
  const docRequest = app.documentRequest as { requiredDocuments?: string[]; message?: string; requestedAt?: unknown } | undefined;

  const isAssigned = app.assignedLenderId === decoded.uid;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">

        {/* Header */}
        <div>
          <Link href="/lender/applications" className="text-sm text-indigo-600 hover:underline">
            ← Applications Queue
          </Link>
          <div className="flex items-start justify-between gap-4 mt-2">
            <div>
              <h1 className="text-xl font-bold text-gray-900 font-mono">
                {app.referenceNumber ?? id}
              </h1>
              {pi && (
                <p className="text-gray-600 text-sm mt-0.5">
                  {pi.firstName} {pi.lastName} · {pi.email} · {pi.phone}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-600'}`}>
                {STATUS_LABELS[status] ?? status}
              </span>
              {app.affordabilityStatus === 'complete' && (
                <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-200 font-medium">
                  Affordability ✓
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Claim / disburse actions */}
        <ApplicationActions
          applicationId={id}
          status={status}
          approvedAmount={ld?.approvedAmount}
          applicationFee={ld?.applicationFee}
        />

        {/* Loan Summary */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Loan Details</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center mb-4 bg-indigo-50 rounded-xl p-4">
            <div>
              <p className="text-xs text-indigo-500 font-medium">Requested</p>
              <p className="font-bold text-indigo-900">{fmt(ld?.requestedAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-indigo-500 font-medium">Rate</p>
              <p className="font-bold text-indigo-900">4.7% / 8 wks</p>
            </div>
            <div>
              <p className="text-xs text-indigo-500 font-medium">Repayments</p>
              <p className="font-bold text-indigo-900">4 × fortnightly</p>
            </div>
            <div>
              <p className="text-xs text-indigo-500 font-medium">Application Fee</p>
              {ld?.applicationFee !== undefined ? (
                <p className="font-bold text-indigo-900">{fmt(ld.applicationFee)}</p>
              ) : (
                <>
                  <p className="font-bold text-indigo-900">
                    {fmt(computeApplicationFee(app.isExistingCustomer))}
                  </p>
                  <p className="text-[10px] text-indigo-500 font-medium uppercase tracking-wide">
                    Estimated
                  </p>
                </>
              )}
            </div>
            <div>
              <p className="text-xs text-indigo-500 font-medium">Purpose</p>
              <p className="font-bold text-indigo-900 text-sm">{loanPurposeLabel(ld?.loanPurpose)}</p>
            </div>
          </div>
          {ld?.purposeDescription && (
            <p className="text-sm text-gray-600 mt-2">{ld.purposeDescription}</p>
          )}
        </section>

        {/* Personal Info */}
        {pi && (
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Personal Information</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Date of Birth" value={pi.dateOfBirth} />
              <Field label="Address" value={`${pi.address}, ${pi.city} ${pi.postCode}`} />
              <Field label="Time at Address" value={pi.timeAtAddress} />
              <Field label="Housing Status" value={pi.housingStatus} />
              <Field label="Visa Status" value={pi.visaStatus?.replace(/_/g, ' ')} />
              {pi.visaExpiryDate && <Field label="Visa Expiry" value={pi.visaExpiryDate} />}
              <Field label="Household" value={pi.householdType?.replace(/_/g, ' ')} />
              <Field label="Children" value={pi.numberOfChildren} />
              <Field label="Dependents" value={pi.numberOfDependents} />
              <ExistingCustomerToggle
                applicationId={id}
                initialValue={Boolean(app.isExistingCustomer)}
              />
            </dl>
          </section>
        )}

        {/* Employment */}
        {emp && (
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Employment</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Employer" value={emp.employerName} />
              <Field label="Occupation" value={emp.occupation} />
              <Field label="Status" value={emp?.employmentStatus?.replace(/_/g, ' ')} />
              <Field label="Hours/Week" value={emp.hoursPerWeek} />
              <Field label="Time at Employer" value={emp.timeAtEmployer} />
              <Field label="Salary (after tax)" value={fmt(emp.income?.salaryAfterTax)} />
              <Field label="WINZ" value={fmt(emp.income?.winz)} />
              <Field label="Other Income" value={fmt(emp.income?.otherIncome)} />
            </dl>
          </section>
        )}

        {/* Living Expenses Summary */}
        {expenses && (
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Stated Living Expenses (Fortnightly)</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {expenses.nonDiscretionary && Object.entries(expenses.nonDiscretionary)
                .filter(([, v]) => v > 0)
                .map(([k, v]) => <Field key={k} label={k.replace(/([A-Z])/g, ' $1').trim()} value={fmt(v)} />)}
              {expenses.bnpl && (
                <>
                  {expenses.bnpl.afterpay > 0 && <Field label="Afterpay" value={fmt(expenses.bnpl.afterpay)} />}
                  {expenses.bnpl.klarna > 0 && <Field label="Klarna" value={fmt(expenses.bnpl.klarna)} />}
                  {expenses.bnpl.zip > 0 && <Field label="Zip" value={fmt(expenses.bnpl.zip)} />}
                </>
              )}
            </dl>
          </section>
        )}

        {/* Existing Debts */}
        {debts && (
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Existing Debts</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(Object.entries(debts) as [string, { totalOwed: number; fortnightlyPayment: number }][])
                .filter(([k, v]) => k !== 'debtPurposeDescription' && !Array.isArray(v) && v?.totalOwed > 0)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs font-medium text-gray-500 uppercase">{k.replace(/([A-Z])/g, ' $1').trim()}</dt>
                    <dd className="text-sm text-gray-900 mt-0.5">Owed: {fmt(v.totalOwed)}</dd>
                    <dd className="text-xs text-gray-500">Fortnightly: {fmt(v.fortnightlyPayment)}</dd>
                  </div>
                ))}
            </dl>
          </section>
        )}

        {/* Assessment Checklist */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Affordability Assessment</h2>
            {isAssigned && ['under_assessment', 'waiting_for_docs', 'credit_check'].includes(status) && (
              <Link
                href={`/lender/applications/${id}/affordability`}
                className="text-sm text-indigo-600 hover:underline font-medium"
              >
                {app.affordabilityStatus === 'complete' ? 'Re-assess →' : 'Start Assessment →'}
              </Link>
            )}
            {app.affordabilityStatus === 'complete' && (
              <a
                href={`/api/applications/${id}/affordability/pdf`}
                download
                className="inline-flex items-center gap-1.5 text-sm text-white bg-orange-600 hover:bg-orange-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                </svg>
                Download Assessment PDF
              </a>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div className={`rounded-lg p-3 ${app.affordabilityStatus === 'complete' ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
              <p className="font-medium">Status</p>
              <p className="mt-0.5 capitalize">{app.affordabilityStatus?.replace(/_/g, ' ') ?? 'Not started'}</p>
            </div>
            <div className="rounded-lg p-3 bg-gray-50 text-gray-600">
              <p className="font-medium text-gray-500 text-xs">Assessments</p>
              <p className="mt-0.5 font-semibold text-gray-900">{app.affordabilityAssessmentIds?.length ?? 0}</p>
            </div>
          </div>
        </section>

        {/* Documents */}
        {(docs.length > 0 || docRequest) && (
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Documents</h2>
            {docRequest?.requiredDocuments && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4 text-sm text-orange-800">
                <p className="font-medium mb-1">Required Documents Requested:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {docRequest.requiredDocuments.map((d) => <li key={d}>{d}</li>)}
                </ul>
                {docRequest.message && <p className="mt-2 text-orange-700 text-xs">{docRequest.message}</p>}
              </div>
            )}
            {docs.length > 0 ? (
              <ul className="space-y-2">
                {docs.map((doc) => (
                  <li key={doc.documentId} className="flex items-center justify-between gap-3 text-sm bg-gray-50 rounded-lg p-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{doc.fileName}</p>
                      <p className="text-xs text-gray-400">{doc.type} · Uploaded {fmtTs(doc.uploadedAt as Parameters<typeof fmtTs>[0])}</p>
                    </div>
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
            ) : (
              <p className="text-sm text-gray-400">No documents uploaded yet.</p>
            )}
          </section>
        )}

        {/* Decision */}
        {decision ? (
          <section className={`rounded-xl border p-5 ${decision.action === 'approved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <h2 className={`font-semibold mb-3 ${decision.action === 'approved' ? 'text-green-800' : 'text-red-800'}`}>
              {decision.action === 'approved' ? '✓ Approved' : '✗ Declined'}
            </h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              {decision.approvedAmount && <Field label="Approved Amount" value={fmt(decision.approvedAmount)} />}
              <Field label="Decided At" value={fmtTs(decision.decidedAt as Parameters<typeof fmtTs>[0])} />
              <div className="col-span-2"><Field label="Rationale" value={decision.rationale} /></div>
              {decision.declineReasons && decision.declineReasons.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-xs font-medium text-gray-500 uppercase mb-1">Decline Reasons</dt>
                  <ul className="list-disc list-inside text-sm text-red-700 space-y-0.5">
                    {decision.declineReasons.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                </div>
              )}
            </dl>
          </section>
        ) : isAssigned && ['under_assessment', 'waiting_for_docs', 'credit_check'].includes(status) ? (
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Make Decision</h2>
            <DecisionForm
              applicationId={id}
              affordabilityStatus={app.affordabilityStatus}
              requestedAmount={ld?.requestedAmount ?? 0}
              assessedAmount={ld?.assessedAmount}
            />
          </section>
        ) : null}

        {/* Internal Notes */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Internal Notes ({notes.length})</h2>
          {notes.length > 0 && (
            <ul className="space-y-3 mb-4">
              {[...notes].reverse().map((note) => (
                <li key={note.noteId} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-700">{note.lenderName}</span>
                    <span className="text-xs text-gray-400">{fmtTs(note.createdAt as Parameters<typeof fmtTs>[0])}</span>
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.text}</p>
                </li>
              ))}
            </ul>
          )}
          {isAssigned && (
            <AddNoteForm applicationId={id} />
          )}
        </section>

        {/* Timeline */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Timeline</h2>
          <div className="space-y-2">
            {Object.entries(timeline ?? {}).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span className="text-gray-800 font-mono text-xs">
                  {fmtTs(val as Parameters<typeof fmtTs>[0])}
                </span>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
