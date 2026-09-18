'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ConsoleIcon, { type ConsoleIconName } from '@/components/lender/ConsoleIcon';
import ConsolePill, { type PillTone } from '@/components/lender/ConsolePill';
import DisburseForm from '../DisburseForm';
import ExistingCustomerToggle from '../ExistingCustomerToggle';
import ScheduledPaymentsPanel from '../ScheduledPaymentsPanel';
import { Card, Field, SECTION_LABEL } from './Card';
import CommunicationTab from './CommunicationTab';
import DecisionModal, { type DecisionMode } from './DecisionModal';
import DocumentReviewList from './DocumentReviewList';
import DocumentsTab from './DocumentsTab';
import ReviewProgress from './ReviewProgress';
import type { ReportItem, ReviewData, TabKey } from './review-types';

export type { ReportItem, ReviewData } from './review-types';

const ASSESSMENT_STATUSES = ['under_assessment', 'waiting_for_docs', 'credit_check'];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function LoanReview({ data }: { data: ReviewData }) {
  const [tab, setTab] = useState<TabKey>('overview');

  const kycPending = data.kyc.borrowerDocuments.filter((d) => d.status === 'pending').length;

  // Ordered to match the lender's review flow: documents → affordability → KYC → credit → communication.
  const tabs: { key: TabKey; label: string; icon: ConsoleIconName; count?: number; tone?: PillTone }[] = [
    { key: 'overview', label: 'Overview', icon: 'gauge' },
    { key: 'documents', label: 'Documents', icon: 'fileText', count: data.docsPending || undefined, tone: 'warning' },
    { key: 'affordability', label: 'Affordability', icon: 'wallet' },
    { key: 'kyc', label: 'KYC', icon: 'shield', count: kycPending || undefined, tone: 'warning' },
    { key: 'credit', label: 'Credit reports', icon: 'trending' },
    { key: 'communication', label: 'Communication', icon: 'phoneCall', count: data.communications.length || undefined },
  ];

  const showActionBar =
    data.isAssigned && ASSESSMENT_STATUSES.includes(data.status) && !data.decision;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-49px)] max-w-[1280px] flex-col px-4 pb-6 pt-4 sm:px-6">
      {/* Top breadcrumb */}
      <div className="mb-4 flex items-center gap-3 text-sm">
        <Link
          href="/lender/applications"
          className="inline-flex items-center gap-1 font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--orange-700)]"
        >
          <ConsoleIcon name="chevLeft" size={16} />
          Loan review
        </Link>
        <span className="text-[var(--text-muted)]">·</span>
        <span className="text-[var(--text-muted)]">{data.header.name}</span>
      </div>

      {/* Header card */}
      <div className="mb-5 rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white p-5 shadow-[var(--shadow-xs)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--orange-500)] font-display text-base font-bold text-[var(--ink-900)]">
              {data.header.initials}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-lg font-bold text-[var(--text-strong)]">{data.header.name}</h1>
                <ConsolePill tone={data.statusTone} dot>
                  {data.statusLabel}
                </ConsolePill>
                {data.isExistingCustomer ? (
                  <ConsolePill tone="brand">Existing customer</ConsolePill>
                ) : (
                  <ConsolePill tone="warning">New customer</ConsolePill>
                )}
                {data.history.previousCount > 0 && (
                  <ConsolePill tone="info">
                    {data.history.previousCount} previous {data.history.previousCount === 1 ? 'application' : 'applications'}
                  </ConsolePill>
                )}
              </div>
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                <span className="font-mono">{data.header.reference}</span> · Submitted {data.header.submittedLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div>
              <p className={SECTION_LABEL}>Requested</p>
              <p className="font-mono text-lg font-bold tabular-nums text-[var(--text-strong)]">{data.header.requested}</p>
            </div>
            <div className="hidden max-w-[220px] sm:block">
              <p className={SECTION_LABEL}>Purpose</p>
              <p className="text-sm font-semibold text-[var(--text-strong)]">{data.header.purpose}</p>
            </div>
            <div className="flex items-center gap-2">
              {data.header.phone && (
                <a
                  href={`tel:${data.header.phone}`}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--border-default)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)]"
                >
                  <ConsoleIcon name="phoneCall" size={16} />
                  Call
                </a>
              )}
              {data.header.email && (
                <a
                  href={`mailto:${data.header.email}`}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--border-default)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)]"
                >
                  <ConsoleIcon name="mail" size={16} />
                  Email
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
        {/* Sidebar */}
        <aside className="space-y-5">
          <Sidebar data={data} onOpenDocuments={() => setTab('documents')} />
        </aside>

        {/* Main */}
        <main className="min-w-0">
          {/* Tabs */}
          <div className="mb-5 flex flex-wrap gap-1 border-b border-[var(--border-default)]">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                  tab === t.key
                    ? 'border-[var(--orange-500)] text-[var(--text-strong)]'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-body)]'
                }`}
              >
                <ConsoleIcon name={t.icon} size={16} />
                {t.label}
                {t.count != null && (
                  <span
                    className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold ${
                      t.tone === 'warning'
                        ? 'bg-[var(--warning-50)] text-[var(--warning-700)]'
                        : 'bg-[var(--surface-sunken)] text-[var(--text-muted)]'
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="space-y-5">
            {tab === 'overview' && <OverviewTab data={data} onSelect={setTab} />}
            {tab === 'documents' && <DocumentsTab data={data} />}
            {tab === 'affordability' && <AffordabilityTab data={data} />}
            {tab === 'kyc' && <KycTab data={data} />}
            {tab === 'credit' && <CreditCard data={data} full />}
            {tab === 'communication' && <CommunicationTab data={data} />}
          </div>
        </main>
      </div>

      {showActionBar && (
        <ActionBar
          applicationId={data.applicationId}
          affordabilityComplete={data.affordability.complete}
          docsPending={data.docsPending}
          requestedAmount={data.decisionInput.requestedAmount}
          assessedAmount={data.decisionInput.assessedAmount}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
function Sidebar({ data, onOpenDocuments }: { data: ReviewData; onOpenDocuments: () => void }) {
  const s = data.snapshot;
  const surplusColor =
    s.surplusTone === 'pos'
      ? 'text-[var(--success-700)]'
      : s.surplusTone === 'neg'
        ? 'text-[var(--danger-700)]'
        : 'text-[var(--text-strong)]';

  return (
    <>
      {/* Applicant snapshot */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white p-5 shadow-[var(--shadow-xs)]">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-display text-[15px] font-bold text-[var(--text-strong)]">Applicant snapshot</h2>
          {data.isExistingCustomer ? (
            <ConsolePill tone="brand">Existing</ConsolePill>
          ) : (
            <ConsolePill tone="warning">New customer</ConsolePill>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          <SnapItem icon="calendar" label="Date of birth" value={s.dob} />
          <SnapItem icon="mapPin" label="Address" value={s.address} />
          <SnapItem icon="shield" label="Visa status" value={s.visa} />
          <SnapItem icon="briefcase" label="Employer" value={s.employer} />
        </div>

        <p className="mt-4 text-xs text-[var(--text-muted)]">
          As declared by the applicant — verify in the affordability assessment.
        </p>

        <dl className="mt-4 space-y-2.5 border-t border-[var(--border-subtle)] pt-4">
          <div className="flex items-center justify-between">
            <dt className="text-sm text-[var(--text-muted)]">Monthly net income</dt>
            <dd className="font-mono text-sm font-semibold tabular-nums text-[var(--text-strong)]">{s.monthlyIncome}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-sm text-[var(--text-muted)]">Monthly expenses</dt>
            <dd className="font-mono text-sm font-semibold tabular-nums text-[var(--text-strong)]">{s.monthlyExpenses}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2.5">
            <dt className="text-sm font-semibold text-[var(--text-body)]">Monthly surplus</dt>
            <dd className={`font-mono text-sm font-bold tabular-nums ${surplusColor}`}>{s.monthlySurplus}</dd>
          </div>
        </dl>

        <div className="mt-4">
          {data.affordability.complete ? (
            <ConsolePill tone="success" dot>Affordability assessed</ConsolePill>
          ) : (
            <ConsolePill tone="warning" dot>Affordability not yet assessed</ConsolePill>
          )}
        </div>
      </section>

      {/* Documents */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white p-5 shadow-[var(--shadow-xs)]">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-display text-[15px] font-bold text-[var(--text-strong)]">Documents</h2>
          <span className="text-xs font-semibold text-[var(--text-muted)]">
            {data.docsVerified}/{data.docsTotal} accepted
          </span>
        </div>
        {data.documents.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No documents uploaded yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {data.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] ${
                      d.status === 'accepted'
                        ? 'bg-[var(--success-50)] text-[var(--success-700)]'
                        : d.status === 'rejected'
                          ? 'bg-[var(--danger-50)] text-[var(--danger-700)]'
                          : 'bg-[var(--slate-100)] text-[var(--text-muted)]'
                    }`}
                  >
                    <ConsoleIcon name={d.status === 'accepted' ? 'check' : d.status === 'rejected' ? 'x' : 'fileText'} size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--text-body)]">{d.title}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">{d.subtitle}</p>
                  </div>
                </div>
                <a
                  href={d.viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-[8px] border border-[var(--border-default)] bg-white px-2 py-1 text-xs font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)]"
                >
                  <ConsoleIcon name="search" size={14} />
                  View
                </a>
              </li>
            ))}
          </ul>
        )}
        {data.docsPending > 0 && (
          <button
            type="button"
            onClick={onOpenDocuments}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-[var(--orange-500)] px-3 py-2 text-sm font-semibold text-[var(--ink-900)] transition-[filter] hover:brightness-105"
          >
            Review {data.docsPending} pending {data.docsPending === 1 ? 'document' : 'documents'}
            <ConsoleIcon name="chevRight" size={16} />
          </button>
        )}
      </section>
    </>
  );
}

function SnapItem({ icon, label, value }: { icon: ConsoleIconName; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-[var(--text-muted)]">
        <ConsoleIcon name={icon} size={15} />
      </span>
      <div className="min-w-0">
        <p className={SECTION_LABEL}>{label}</p>
        <p className="mt-0.5 break-words text-[13px] font-medium text-[var(--text-body)]">{value}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
function OverviewTab({ data, onSelect }: { data: ReviewData; onSelect: (tab: TabKey) => void }) {
  const router = useRouter();
  return (
    <>
      {data.decision && (
        <section
          className={`rounded-[var(--radius-lg)] border p-5 shadow-[var(--shadow-xs)] ${
            data.decision.approved
              ? 'border-[var(--success-700)]/25 bg-[var(--success-50)]'
              : 'border-[var(--danger-700)]/25 bg-[var(--danger-50)]'
          }`}
        >
          <h2
            className={`mb-2 font-display text-[15px] font-bold ${
              data.decision.approved ? 'text-[var(--success-700)]' : 'text-[var(--danger-700)]'
            }`}
          >
            {data.decision.approved ? 'Approved' : 'Declined'}
            {data.decision.approvedAmount && ` · ${data.decision.approvedAmount}`}
          </h2>
          <p className="text-sm text-[var(--text-body)]">{data.decision.rationale}</p>
          {data.decision.declineReasons && data.decision.declineReasons.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-sm text-[var(--danger-700)]">
              {data.decision.declineReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-[var(--text-muted)]">Decided {data.decision.decidedAt}</p>
        </section>
      )}

      {data.applicantRejection && (
        <Card title="Applicant declined offer" icon="alert">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <Field label="Declined at" value={data.applicantRejection.rejectedAt} />
            <div className="col-span-2">
              <Field label="Reason" value={data.applicantRejection.reason} />
            </div>
          </dl>
        </Card>
      )}

      {/* Claim */}
      {data.status === 'pending_review' && <ClaimCard applicationId={data.applicationId} onDone={() => router.refresh()} />}

      {/* Where the review is up to */}
      {!data.decision && ASSESSMENT_STATUSES.concat('pending_review').includes(data.status) && (
        <ReviewProgress data={data} onSelect={onSelect} />
      )}

      {/* Disburse */}
      {data.disburse && (
        <Card title="Disbursement" icon="wallet">
          <DisburseForm
            applicationId={data.applicationId}
            approvedAmount={data.disburse.approvedAmount}
            applicationFee={data.disburse.applicationFee}
            bankDetails={data.disburse.bankDetails}
            consentStatus={data.disburse.consentStatus}
            consentActivatedAt={data.disburse.consentActivatedAt}
          />
        </Card>
      )}

      {data.payments.show && (
        <ScheduledPaymentsPanel applicationId={data.applicationId} scheduledPayments={data.payments.scheduled} />
      )}

      <KycCard data={data} />
      <CreditCard data={data} />

      {/* Timeline */}
      <Card title="Timeline" icon="clock">
        <div className="space-y-2">
          {data.timeline.map((t) => (
            <div key={t.label} className="flex items-center justify-between text-sm">
              <span className="capitalize text-[var(--text-muted)]">{t.label}</span>
              <span className="font-mono text-xs text-[var(--text-body)]">{t.date}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function AffordabilityTab({ data }: { data: ReviewData }) {
  const a = data.affordability;
  return (
    <>
      <Card
        title="Affordability assessment"
        icon="shield"
        action={
          <div className="flex items-center gap-3">
            {a.canAssess && (
              <Link href={a.assessUrl} className="text-sm font-semibold text-[var(--orange-700)] hover:underline">
                {a.complete ? 'Re-assess →' : 'Start assessment →'}
              </Link>
            )}
            {a.complete && (
              <a
                href={a.pdfUrl}
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
              a.complete ? 'bg-[var(--success-50)] text-[var(--success-700)]' : 'bg-[var(--slate-50)] text-[var(--text-muted)]'
            }`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] opacity-80">Status</p>
            <p className="mt-0.5 font-semibold capitalize">{a.statusLabel}</p>
          </div>
          <div className="rounded-[var(--radius-md)] bg-[var(--slate-50)] p-3">
            <p className={SECTION_LABEL}>Assessments</p>
            <p className="mt-0.5 font-semibold text-[var(--text-strong)]">{a.assessmentCount}</p>
          </div>
        </div>
        {data.docsPending > 0 && (
          <p className="mt-3 text-xs text-[var(--warning-700)]">
            {data.docsPending} document{data.docsPending === 1 ? '' : 's'} still need review — check them before relying on declared figures.
          </p>
        )}
      </Card>

      {/* Declared financials */}
      <Card title="Declared financials (monthly)" icon="wallet">
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--border-subtle)]">
          {[
            { label: 'Net income', value: data.snapshot.monthlyIncome },
            { label: 'Expenses', value: data.snapshot.monthlyExpenses },
            { label: 'Surplus', value: data.snapshot.monthlySurplus },
          ].map((c) => (
            <div key={c.label} className="bg-[var(--slate-50)] p-4 text-center">
              <p className={SECTION_LABEL}>{c.label}</p>
              <p className="mt-1 font-mono font-bold tabular-nums text-[var(--text-strong)]">{c.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          As declared by the applicant — verify against bank data in the affordability assessment.
        </p>
      </Card>

      {/* Employment */}
      {data.employment.length > 0 && (
        <Card title="Employment" icon="briefcase">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {data.employment.map((f) => (
              <Field key={f.label} label={f.label} value={f.value} />
            ))}
          </dl>
        </Card>
      )}

      {/* Living expenses */}
      {data.expenses.length > 0 && (
        <Card title="Stated living expenses (fortnightly)" icon="sliders">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {data.expenses.map((f) => (
              <Field key={f.label} label={f.label} value={f.value} />
            ))}
          </dl>
        </Card>
      )}

      {/* Existing debts */}
      {data.debts.length > 0 && (
        <Card title="Existing debts" icon="trending">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {data.debts.map((d) => (
              <div key={d.label}>
                <dt className={SECTION_LABEL}>{d.label}</dt>
                <dd className="mt-1 text-sm text-[var(--text-body)]">Owed: {d.owed}</dd>
                <dd className="text-xs text-[var(--text-muted)]">Fortnightly: {d.fortnightly}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {/* Fee + existing customer */}
      <Card title="Fees" icon="creditCard">
        <div className="mb-4 flex items-center justify-between rounded-[var(--radius-md)] bg-[var(--slate-50)] p-3">
          <span className="text-sm text-[var(--text-muted)]">
            Application fee {data.feeIsEstimated && <span className="text-xs">(estimated)</span>}
          </span>
          <span className="font-mono font-bold tabular-nums text-[var(--text-strong)]">{data.estimatedFee}</span>
        </div>
        <ExistingCustomerToggle applicationId={data.applicationId} initialValue={data.isExistingCustomer} />
      </Card>
    </>
  );
}

function KycTab({ data }: { data: ReviewData }) {
  const identityDocs = data.documents.filter((d) => d.kind === 'identity');
  return (
    <>
      <KycCard data={data} />
      <Card title="Identity documents (this application)" icon="fileText">
        <DocumentReviewList
          items={identityDocs}
          canReview={data.canReviewDocs}
          emptyText="No identity documents were uploaded with this application."
        />
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// KYC + Credit cards
// ---------------------------------------------------------------------------
function ReportList({ reports, applicationId }: { reports: ReportItem[]; applicationId: string }) {
  if (reports.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] bg-white/70 p-4 text-sm text-[var(--text-muted)]">
        No report on file yet.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {reports.map((r) => (
        <li
          key={r.id}
          className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white p-3"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--slate-100)] text-[var(--text-muted)]">
              <ConsoleIcon name="fileText" size={16} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text-body)]">{r.fileName}</p>
              <p className="truncate text-xs text-[var(--text-muted)]">
                Uploaded by {r.uploadedBy} · {r.uploadedAt}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ConsolePill tone="success">On file</ConsolePill>
            <a
              href={`/api/applications/${applicationId}/reports/${r.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-[8px] border border-[var(--border-default)] bg-white px-2 py-1 text-xs font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)]"
            >
              <ConsoleIcon name="search" size={14} />
              View
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ReportUploader({
  applicationId,
  provider,
  providerLabel,
  canUpload,
}: {
  applicationId: string;
  provider: 'datazoo' | 'centrix' | 'affordability';
  providerLabel: string;
  canUpload: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('provider', provider);
      const res = await fetch(`/api/applications/${applicationId}/reports`, { method: 'POST', body: fd });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error?.message ?? 'Upload failed');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (!canUpload) {
    return (
      <p className="mt-4 text-xs text-[var(--text-muted)]">
        Claim this application to upload a {providerLabel} report. Reports are stored on the
        customer&apos;s profile and reused across future applications.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        className="hidden"
        onChange={onFile}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-1.5 rounded-[10px] bg-[var(--ink-800)] px-3 py-1.5 text-sm font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-50"
      >
        <ConsoleIcon name="upload" size={16} />
        {uploading ? 'Uploading…' : `Upload ${providerLabel} report`}
      </button>
      {error && <p className="mt-2 text-xs text-[var(--danger-700)]">{error}</p>}
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        PDF, JPEG or PNG up to 10 MB. Stored on the customer&apos;s profile and reused across future
        applications.
      </p>
    </div>
  );
}

function KycCard({ data }: { data: ReviewData }) {
  const k = data.kyc;
  const dzVerified = k.reports.length > 0;
  const identityReuse = data.history.reuse.find((r) => r.key === 'identity');
  return (
    <Card
      title="KYC verification"
      icon="shield"
      action={
        <ConsolePill tone={dzVerified ? 'success' : 'warning'} dot>
          {dzVerified ? 'DataZoo verified' : 'DataZoo pending'}
        </ConsolePill>
      }
    >
      {/* Borrower-provided onboarding evidence (reviewable by the lender) */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className={SECTION_LABEL}>Borrower identity documents (uploaded at onboarding)</p>
          <ConsolePill tone={k.borrowerStatusTone}>{k.borrowerStatusLabel}</ConsolePill>
        </div>
        <DocumentReviewList
          items={k.borrowerDocuments}
          canReview={data.canReviewDocs}
          emptyText="No identity documents were uploaded by the borrower at onboarding."
        />
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Verdicts are saved on the customer profile, so they carry across every application this borrower makes.
        </p>
      </div>

      {/* Lender-run DataZoo identity check */}
      <div className="border-t border-[var(--border-subtle)] pt-5">
        <p className={`${SECTION_LABEL} mb-1`}>DataZoo identity check (lender)</p>
        <p className="mb-3 text-sm text-[var(--text-muted)]">
          {identityReuse
            ? `Identity was verified ${identityReuse.ageLabel} (${identityReuse.fromLabel}). A new check is only needed if the borrower's details have changed.`
            : "Run the identity check in DataZoo and upload the report. It is stored on the borrower's profile and reused across their future loan applications."}
        </p>
        <ReportList reports={k.reports} applicationId={data.applicationId} />
        <ReportUploader
          applicationId={data.applicationId}
          provider="datazoo"
          providerLabel="DataZoo"
          canUpload={data.isAssigned}
        />
      </div>
    </Card>
  );
}

function CreditCard({ data, full = false }: { data: ReviewData; full?: boolean }) {
  const c = data.credit;
  const creditReports = c.reports;
  const affordabilityReports = c.affordabilityReports;
  const bothOnFile = creditReports.length > 0 && affordabilityReports.length > 0;
  const anyReport = creditReports.length > 0 || affordabilityReports.length > 0;
  const creditReuse = data.history.reuse.find((r) => r.key === 'credit');
  const pct = Math.max(0, Math.min(1, (c.score - c.min) / (c.max - c.min)));
  return (
    <Card
      title="Credit reports"
      icon="trending"
      muted={!anyReport}
      action={
        <ConsolePill tone={bothOnFile ? 'success' : 'warning'} dot>
          {bothOnFile ? 'Reports on file' : anyReport ? 'Partly on file' : 'Reports needed'}
        </ConsolePill>
      }
    >
      <p className="mb-4 text-sm text-[var(--text-muted)]">
        Upload the borrower&apos;s credit and affordability reports here. They are stored on the
        borrower&apos;s profile and reused across their future loan applications.
      </p>

      {creditReuse && (
        <div
          className={`mb-4 rounded-[var(--radius-md)] border p-3 text-sm ${
            creditReuse.reusable
              ? 'border-[var(--success-700)]/25 bg-[var(--success-50)] text-[var(--success-700)]'
              : 'border-[var(--warning-700)]/30 bg-[var(--warning-50)] text-[var(--warning-700)]'
          }`}
        >
          {creditReuse.reusable
            ? `A credit report from ${creditReuse.ageLabel} is still within the ${creditReuse.windowMonths}-month window (valid until ${creditReuse.expiresLabel}) — no need to pull a new one unless something has changed.`
            : `The last credit report is ${creditReuse.ageLabel} — outside the ${creditReuse.windowMonths}-month window. Pull a fresh report before deciding.`}
        </div>
      )}

      <div className="space-y-5">
        <div>
          <p className={`${SECTION_LABEL} mb-2`}>Comprehensive credit report</p>
          <ReportList reports={creditReports} applicationId={data.applicationId} />
          <ReportUploader
            applicationId={data.applicationId}
            provider="centrix"
            providerLabel="Comprehensive credit"
            canUpload={data.isAssigned}
          />
        </div>

        <div className="border-t border-[var(--border-subtle)] pt-5">
          <p className={`${SECTION_LABEL} mb-2`}>Affordability report</p>
          <ReportList reports={affordabilityReports} applicationId={data.applicationId} />
          <ReportUploader
            applicationId={data.applicationId}
            provider="affordability"
            providerLabel="Affordability"
            canUpload={data.isAssigned}
          />
        </div>
      </div>

      {full && (
        <div className="mt-5 border-t border-[var(--border-subtle)] pt-5">
          <p className={`${SECTION_LABEL} mb-3`}>Summary — sample, populated from the uploaded report</p>
          <div className="opacity-70" aria-hidden="true">
            <div className="flex items-end gap-3">
              <span className="font-mono text-4xl font-bold tabular-nums text-[var(--text-muted)]">{c.score}</span>
              <span className="mb-1 text-sm font-semibold text-[var(--text-muted)]">{c.band}</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--slate-100)]">
              <div className="h-full rounded-full bg-[var(--orange-400)]" style={{ width: `${pct * 100}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-[var(--slate-400)]">
              <span>{c.min}</span>
              <span>{c.max}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Defaults', value: String(c.defaults) },
                { label: 'Credit enquiries (6m)', value: String(c.enquiries) },
                { label: 'Credit utilisation', value: c.utilisation },
                { label: 'Debt-to-income', value: c.dti },
              ].map((m) => (
                <div key={m.label} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white/60 p-3">
                  <p className={SECTION_LABEL}>{m.label}</p>
                  <p className="mt-0.5 font-semibold text-[var(--text-muted)]">{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Claim card
// ---------------------------------------------------------------------------
function ClaimCard({ applicationId, onDone }: { applicationId: string; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claim = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/claim`, { method: 'POST' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error?.message ?? 'Failed to claim');
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Start review" icon="inbox">
      <p className="mb-3 text-sm text-[var(--text-muted)]">
        Claim this application to assign it to yourself and begin the review.
      </p>
      {error && (
        <div className="mb-3 rounded-[var(--radius-md)] border border-[var(--danger-700)]/25 bg-[var(--danger-50)] px-3 py-2 text-sm text-[var(--danger-700)]">
          {error}
        </div>
      )}
      <button
        onClick={claim}
        disabled={loading}
        className="rounded-[10px] bg-[var(--orange-500)] px-4 py-2.5 text-sm font-semibold text-[var(--ink-900)] transition-[filter] hover:brightness-105 disabled:opacity-50"
      >
        {loading ? 'Claiming…' : 'Claim application'}
      </button>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sticky action bar
// ---------------------------------------------------------------------------
function ActionBar({
  applicationId,
  affordabilityComplete,
  docsPending,
  requestedAmount,
  assessedAmount,
}: {
  applicationId: string;
  affordabilityComplete: boolean;
  docsPending: number;
  requestedAmount: number;
  assessedAmount?: number;
}) {
  const [mode, setMode] = useState<DecisionMode | null>(null);

  return (
    <>
      <div className="sticky bottom-0 z-30 -mx-4 mt-5 border-t border-[var(--border-default)] bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            {docsPending > 0 ? (
              <>
                <span className="text-[var(--warning-700)]">
                  <ConsoleIcon name="alert" size={16} />
                </span>
                {docsPending} document{docsPending === 1 ? '' : 's'} still to review
              </>
            ) : affordabilityComplete ? (
              <>
                <span className="text-[var(--success-700)]">
                  <ConsoleIcon name="check" size={16} />
                </span>
                Affordability assessed — ready to decide
              </>
            ) : (
              <>
                <span className="text-[var(--warning-700)]">
                  <ConsoleIcon name="alert" size={16} />
                </span>
                Assess affordability first
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('decline')}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--danger-700)]/40 bg-white px-3.5 py-2 text-sm font-semibold text-[var(--danger-700)] transition-colors hover:bg-[var(--danger-50)]"
            >
              <ConsoleIcon name="x" size={16} />
              Decline
            </button>
            <button
              type="button"
              onClick={() => setMode('request')}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--border-default)] bg-white px-3.5 py-2 text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)]"
            >
              <ConsoleIcon name="mail" size={16} />
              Request documents
            </button>
            <button
              type="button"
              onClick={() => setMode('approve')}
              disabled={!affordabilityComplete}
              title={affordabilityComplete ? undefined : 'Complete the affordability assessment first'}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-[var(--success-700)] px-3.5 py-2 text-sm font-semibold text-white transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ConsoleIcon name="check" size={16} />
              Approve
            </button>
          </div>
        </div>
      </div>

      {mode && (
        <DecisionModal
          mode={mode}
          applicationId={applicationId}
          requestedAmount={requestedAmount}
          assessedAmount={assessedAmount}
          onClose={() => setMode(null)}
        />
      )}
    </>
  );
}
