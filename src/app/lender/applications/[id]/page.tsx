import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getAdminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import type { LoanApplication } from '@/types/application';
import type { ScheduledPayment } from '@/types/application';
import ConsoleIcon, { type ConsoleIconName } from '@/components/lender/ConsoleIcon';
import ConsolePill, { type PillTone } from '@/components/lender/ConsolePill';
import ApplicationActions from './ApplicationActions';
import AddNoteForm from './AddNoteForm';
import DecisionForm from './DecisionForm';
import ExistingCustomerToggle from './ExistingCustomerToggle';
import ScheduledPaymentsPanel from './ScheduledPaymentsPanel';
import { loanPurposeLabel } from '@/lib/constants/loan-purposes';
import { computeApplicationFee } from '@/lib/constants/fees';
import { reconcileConsent } from '@/lib/qippay/reconcile-consent';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  under_assessment: 'Under Assessment',
  waiting_for_docs: 'Waiting for Docs',
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
};

const STATUS_TONE: Record<string, PillTone> = {
  draft: 'neutral',
  pending_review: 'info',
  under_assessment: 'warning',
  waiting_for_docs: 'warning',
  credit_check: 'info',
  approved: 'success',
  loan_accepted: 'success',
  awaiting_payment_consent: 'warning',
  offer_declined: 'neutral',
  disbursed: 'success',
  active: 'success',
  closed_repaid: 'neutral',
  declined: 'danger',
  withdrawn: 'neutral',
  expired: 'neutral',
};

function Section({
  title,
  icon,
  action,
  children,
  className = '',
}: {
  title: string;
  icon?: ConsoleIconName;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white p-5 shadow-[var(--shadow-xs)] ${className}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-[var(--text-strong)]">
          {icon && (
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--orange-50)] text-[var(--orange-700)]">
              <ConsoleIcon name={icon} size={16} />
            </span>
          )}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm text-[var(--text-body)]">{value ?? '—'}</dd>
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

const PAYMENT_STATUSES = new Set(['disbursed', 'active', 'closed_repaid']);

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
  let snap = await db.collection('loanApplications').doc(id).get();
  if (!snap.exists) notFound();

  let app = { applicationId: snap.id, ...snap.data() } as LoanApplication;

  // If a SetPay mandate is in flight, reconcile against Qippay before
  // rendering so the lender sees the up-to-date authorisation state.
  if (app.status === 'awaiting_payment_consent') {
    const pc = app.paymentConsent;
    const nonTerminal =
      pc && pc.status !== 'active' && pc.status !== 'failed' &&
      pc.status !== 'expired' && pc.status !== 'cancelled';
    if (nonTerminal) {
      const reconciled = await reconcileConsent({
        applicationId: id,
        caller: 'lender',
        callerUid: decoded.uid,
      }).catch(() => null);
      if (reconciled?.status === 'active') {
        snap = await db.collection('loanApplications').doc(id).get();
        app = { applicationId: snap.id, ...snap.data() } as LoanApplication;
      }
    }
  }

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

  // Scheduled payments for repayment tracking (populated at disbursement)
  const scheduledPayments = (app.scheduledPayments ?? []) as ScheduledPayment[];

  const isAssigned = app.assignedLenderId === decoded.uid;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-5">
        {/* Header */}
        <div>
          <Link
            href="/lender/applications"
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--orange-700)]"
          >
            <ConsoleIcon name="chevLeft" size={16} />
            Applications Queue
          </Link>
          <div className="mt-2 flex items-start justify-between gap-4">
            <div>
              <h1 className="font-mono text-xl font-bold tracking-tight text-[var(--text-strong)]">
                {app.referenceNumber ?? id}
              </h1>
              {pi && (
                <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                  {pi.firstName} {pi.lastName} · {pi.email} · {pi.phone}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ConsolePill tone={STATUS_TONE[status] ?? 'neutral'} dot>
                {STATUS_LABELS[status] ?? status}
              </ConsolePill>
              {app.affordabilityStatus === 'complete' && (
                <ConsolePill tone="success">Affordability ✓</ConsolePill>
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
          paymentConsent={
            app.paymentConsent
              ? {
                  status: app.paymentConsent.status,
                  mandateId: app.paymentConsent.mandateId,
                  activatedAt: fmtTs(
                    app.paymentConsent.activatedAt as unknown as {
                      _seconds?: number;
                      toDate?: () => Date;
                    } | null,
                  ),
                }
              : undefined
          }
        />

        {/* Loan Summary */}
        <Section title="Loan Details" icon="wallet">
          <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--border-subtle)] sm:grid-cols-5">
            <div className="bg-[var(--slate-50)] p-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Requested</p>
              <p className="mt-1 font-mono font-bold tabular-nums text-[var(--text-strong)]">{fmt(ld?.requestedAmount)}</p>
            </div>
            <div className="bg-[var(--slate-50)] p-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Rate</p>
              <p className="mt-1 font-semibold text-[var(--text-strong)]">4.7% / 8 wks</p>
            </div>
            <div className="bg-[var(--slate-50)] p-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Repayments</p>
              <p className="mt-1 font-semibold text-[var(--text-strong)]">4 × fortnightly</p>
            </div>
            <div className="bg-[var(--slate-50)] p-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Application Fee</p>
              {ld?.applicationFee !== undefined ? (
                <p className="mt-1 font-mono font-bold tabular-nums text-[var(--text-strong)]">{fmt(ld.applicationFee)}</p>
              ) : (
                <>
                  <p className="mt-1 font-mono font-bold tabular-nums text-[var(--text-strong)]">
                    {fmt(computeApplicationFee(app.isExistingCustomer))}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                    Estimated
                  </p>
                </>
              )}
            </div>
            <div className="col-span-2 bg-[var(--slate-50)] p-4 text-center sm:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Purpose</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-strong)]">{loanPurposeLabel(ld?.loanPurpose)}</p>
            </div>
          </div>
          {ld?.purposeDescription && (
            <p className="text-sm text-[var(--text-body)]">{ld.purposeDescription}</p>
          )}
          <p className="mt-3 text-xs text-[var(--text-muted)]">All loans are charged interest (see rate above).</p>
        </Section>

        {/* Scheduled Repayments — visible once loan is disbursed */}
        {PAYMENT_STATUSES.has(status) && (
          <ScheduledPaymentsPanel
            applicationId={id}
            scheduledPayments={scheduledPayments}
          />
        )}

        {/* Personal Info */}
        {pi && (
          <Section title="Personal Information" icon="user">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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
          </Section>
        )}

        {/* Employment */}
        {emp && (
          <Section title="Employment" icon="users">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Employer" value={emp.employerName} />
              <Field label="Occupation" value={emp.occupation} />
              <Field label="Status" value={emp?.employmentStatus?.replace(/_/g, ' ')} />
              <Field label="Hours/Week" value={emp.hoursPerWeek} />
              <Field label="Time at Employer" value={emp.timeAtEmployer} />
              <Field label="Salary (after tax)" value={fmt(emp.income?.salaryAfterTax)} />
              <Field label="WINZ" value={fmt(emp.income?.winz)} />
              <Field label="Other Income" value={fmt(emp.income?.otherIncome)} />
            </dl>
          </Section>
        )}

        {/* Living Expenses Summary */}
        {expenses && (
          <Section title="Stated Living Expenses (Fortnightly)" icon="sliders">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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
          </Section>
        )}

        {/* Existing Debts */}
        {debts && (
          <Section title="Existing Debts" icon="trending">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {(Object.entries(debts) as [string, { totalOwed: number; fortnightlyPayment: number }][])
                .filter(([k, v]) => k !== 'debtPurposeDescription' && !Array.isArray(v) && v?.totalOwed > 0)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{k.replace(/([A-Z])/g, ' $1').trim()}</dt>
                    <dd className="mt-1 text-sm text-[var(--text-body)]">Owed: {fmt(v.totalOwed)}</dd>
                    <dd className="text-xs text-[var(--text-muted)]">Fortnightly: {fmt(v.fortnightlyPayment)}</dd>
                  </div>
                ))}
            </dl>
          </Section>
        )}

        {/* Affordability Assessment */}
        <Section
          title="Affordability Assessment"
          icon="shield"
          action={
            <div className="flex items-center gap-3">
              {isAssigned && ['under_assessment', 'waiting_for_docs', 'credit_check'].includes(status) && (
                <Link
                  href={`/lender/applications/${id}/affordability`}
                  className="text-sm font-semibold text-[var(--orange-700)] hover:underline"
                >
                  {app.affordabilityStatus === 'complete' ? 'Re-assess →' : 'Start Assessment →'}
                </Link>
              )}
              {app.affordabilityStatus === 'complete' && (
                <a
                  href={`/api/applications/${id}/affordability/pdf`}
                  download
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-[var(--orange-500)] px-3 py-1.5 text-sm font-semibold text-[var(--ink-900)] transition-[filter] hover:brightness-105"
                >
                  <ConsoleIcon name="download" size={16} />
                  Assessment PDF
                </a>
              )}
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div
              className={`rounded-[var(--radius-md)] p-3 ${
                app.affordabilityStatus === 'complete'
                  ? 'bg-[var(--success-50)] text-[var(--success-700)]'
                  : 'bg-[var(--slate-50)] text-[var(--text-muted)]'
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] opacity-80">Status</p>
              <p className="mt-0.5 font-semibold capitalize">{app.affordabilityStatus?.replace(/_/g, ' ') ?? 'Not started'}</p>
            </div>
            <div className="rounded-[var(--radius-md)] bg-[var(--slate-50)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Assessments</p>
              <p className="mt-0.5 font-semibold text-[var(--text-strong)]">{app.affordabilityAssessmentIds?.length ?? 0}</p>
            </div>
          </div>
        </Section>

        {/* Credit & Identity Checks — MOCKED: no credit-bureau endpoint/component
            exists yet. Rendered disabled and greyed out per design intent. */}
        <section className="relative overflow-hidden rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] bg-[var(--slate-50)] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-[var(--text-muted)]">
              <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--slate-100)] text-[var(--slate-400)]">
                <ConsoleIcon name="shield" size={16} />
              </span>
              Credit &amp; Identity Checks
            </h2>
            <ConsolePill tone="neutral">Not connected</ConsolePill>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3" aria-hidden="true">
            {[
              { label: 'Credit Bureau (Centrix)', value: 'Not run' },
              { label: 'Identity Verification', value: 'Not run' },
              { label: 'Bank Transaction Analysis', value: 'Not run' },
              { label: 'AML / PEP Screening', value: 'Not run' },
            ].map((c) => (
              <div key={c.label} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white/60 p-3 opacity-60">
                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{c.label}</p>
                <p className="mt-0.5 font-semibold text-[var(--slate-400)]">{c.value}</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="mt-4 inline-flex cursor-not-allowed items-center gap-1.5 rounded-[10px] border border-[var(--border-default)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text-muted)] opacity-60"
          >
            <ConsoleIcon name="search" size={16} />
            Run checks
          </button>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Credit-bureau and identity integrations are not yet connected. This panel is a placeholder.
          </p>
        </section>

        {/* Documents */}
        {(docs.length > 0 || docRequest) && (
          <Section title="Documents" icon="inbox">
            {docRequest?.requiredDocuments && (
              <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--warning-700)]/20 bg-[var(--warning-50)] p-3 text-sm text-[var(--warning-700)]">
                <p className="mb-1 font-semibold">Required Documents Requested:</p>
                <ul className="list-inside list-disc space-y-0.5">
                  {docRequest.requiredDocuments.map((d) => <li key={d}>{d}</li>)}
                </ul>
                {docRequest.message && <p className="mt-2 text-xs">{docRequest.message}</p>}
              </div>
            )}
            {docs.length > 0 ? (
              <ul className="space-y-2">
                {docs.map((doc) => (
                  <li key={doc.documentId} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--slate-50)] p-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--text-body)]">{doc.fileName}</p>
                      <p className="text-xs text-[var(--text-muted)]">{doc.type} · Uploaded {fmtTs(doc.uploadedAt as Parameters<typeof fmtTs>[0])}</p>
                    </div>
                    <ConsolePill
                      tone={
                        doc.status === 'accepted' ? 'success' :
                        doc.status === 'rejected' ? 'danger' : 'neutral'
                      }
                    >
                      {doc.status}
                    </ConsolePill>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">No documents uploaded yet.</p>
            )}
          </Section>
        )}

        {/* Applicant declined the offer */}
        {status === 'offer_declined' && app.applicantRejection && (
          <section className="rounded-[var(--radius-lg)] border border-[var(--warning-700)]/25 bg-[var(--warning-50)] p-5 shadow-[var(--shadow-xs)]">
            <h2 className="mb-3 flex items-center gap-2 font-display text-[15px] font-bold text-[var(--warning-700)]">
              <ConsoleIcon name="alert" size={16} />
              Applicant Declined Offer
            </h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Field
                label="Declined At"
                value={fmtTs(app.applicantRejection.rejectedAt as Parameters<typeof fmtTs>[0])}
              />
              <div className="col-span-2">
                <Field label="Reason" value={app.applicantRejection.reason || 'No reason provided'} />
              </div>
            </dl>
          </section>
        )}

        {/* Decision */}
        {decision ? (
          <section
            className={`rounded-[var(--radius-lg)] border p-5 shadow-[var(--shadow-xs)] ${
              decision.action === 'approved'
                ? 'border-[var(--success-700)]/25 bg-[var(--success-50)]'
                : 'border-[var(--danger-700)]/25 bg-[var(--danger-50)]'
            }`}
          >
            <h2
              className={`mb-3 font-display text-[15px] font-bold ${
                decision.action === 'approved' ? 'text-[var(--success-700)]' : 'text-[var(--danger-700)]'
              }`}
            >
              {decision.action === 'approved' ? 'Approved' : 'Declined'}
            </h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              {decision.approvedAmount && <Field label="Approved Amount" value={fmt(decision.approvedAmount)} />}
              <Field label="Decided At" value={fmtTs(decision.decidedAt as Parameters<typeof fmtTs>[0])} />
              <div className="col-span-2"><Field label="Rationale" value={decision.rationale} /></div>
              {decision.declineReasons && decision.declineReasons.length > 0 && (
                <div className="col-span-2">
                  <dt className="mb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Decline Reasons</dt>
                  <ul className="list-inside list-disc space-y-0.5 text-sm text-[var(--danger-700)]">
                    {decision.declineReasons.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                </div>
              )}
            </dl>
          </section>
        ) : isAssigned && ['under_assessment', 'waiting_for_docs', 'credit_check'].includes(status) ? (
          <Section title="Make Decision" icon="shield">
            <DecisionForm
              applicationId={id}
              affordabilityStatus={app.affordabilityStatus}
              requestedAmount={ld?.requestedAmount ?? 0}
              assessedAmount={ld?.assessedAmount}
            />
          </Section>
        ) : null}

        {/* Internal Notes */}
        <Section title={`Internal Notes (${notes.length})`} icon="user">
          {notes.length > 0 && (
            <ul className="mb-4 space-y-3">
              {[...notes].reverse().map((note) => (
                <li key={note.noteId} className="rounded-[var(--radius-md)] bg-[var(--slate-50)] p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--text-body)]">{note.lenderName}</span>
                    <span className="text-xs text-[var(--text-muted)]">{fmtTs(note.createdAt as Parameters<typeof fmtTs>[0])}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-[var(--text-body)]">{note.text}</p>
                </li>
              ))}
            </ul>
          )}
          {isAssigned && (
            <AddNoteForm applicationId={id} />
          )}
        </Section>

        {/* Timeline */}
        <Section title="Timeline" icon="clock">
          <div className="space-y-2">
            {Object.entries(timeline ?? {}).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="capitalize text-[var(--text-muted)]">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span className="font-mono text-xs text-[var(--text-body)]">
                  {fmtTs(val as Parameters<typeof fmtTs>[0])}
                </span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
