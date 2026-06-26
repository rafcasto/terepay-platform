'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DocumentStatus, ScheduledPayment } from '@/types/application';
import ConsoleIcon, { type ConsoleIconName } from '@/components/lender/ConsoleIcon';
import ConsolePill, { type PillTone } from '@/components/lender/ConsolePill';
import AddNoteForm from '../AddNoteForm';
import DisburseForm from '../DisburseForm';
import ExistingCustomerToggle from '../ExistingCustomerToggle';
import ScheduledPaymentsPanel from '../ScheduledPaymentsPanel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type ReportItem = { id: string; fileName: string; uploadedAt: string; uploadedBy: string };

export type ReviewData = {
  applicationId: string;
  status: string;
  statusLabel: string;
  statusTone: PillTone;
  isAssigned: boolean;
  isExistingCustomer: boolean;
  header: {
    reference: string;
    name: string;
    initials: string;
    email: string;
    phone: string;
    requested: string;
    purpose: string;
    submittedLabel: string;
  };
  snapshot: {
    dob: string;
    address: string;
    visa: string;
    employer: string;
    monthlyIncome: string;
    monthlyExpenses: string;
    monthlySurplus: string;
    surplusTone: 'pos' | 'neg' | 'none';
  };
  documents: { title: string; subtitle: string; status: DocumentStatus }[];
  docsVerified: number;
  docsTotal: number;
  affordability: {
    statusLabel: string;
    complete: boolean;
    assessmentCount: number;
    canAssess: boolean;
    pdfUrl: string;
    assessUrl: string;
  };
  estimatedFee: string;
  feeIsEstimated: boolean;
  employment: { label: string; value: string }[];
  expenses: { label: string; value: string }[];
  debts: { label: string; owed: string; fortnightly: string }[];
  notes: { id: string; author: string; date: string; text: string }[];
  timeline: { label: string; date: string }[];
  decision?: {
    approved: boolean;
    approvedAmount?: string;
    decidedAt: string;
    rationale: string;
    declineReasons?: string[];
  };
  applicantRejection?: { rejectedAt: string; reason: string };
  payments: { show: boolean; scheduled: ScheduledPayment[] };
  disburse?: {
    approvedAmount: number;
    applicationFee: number;
    consentStatus?: string;
    consentActivatedAt?: string;
  };
  decisionInput: { requestedAmount: number; assessedAmount?: number };
  kyc: {
    borrowerStatusLabel: string;
    borrowerStatusTone: PillTone;
    borrowerDocuments: { fileId: string; label: string; fileName: string; uploadedAt: string; status: string }[];
    reports: ReportItem[];
  };
  credit: {
    reports: ReportItem[];
    score: number;
    band: string;
    min: number;
    max: number;
    defaults: number;
    enquiries: number;
    utilisation: string;
    dti: string;
  };
};

type TabKey = 'overview' | 'affordability' | 'kyc' | 'credit' | 'calls' | 'messages';

const ASSESSMENT_STATUSES = ['under_assessment', 'waiting_for_docs', 'credit_check'];

const STANDARD_DECLINE_REASONS = [
  'Insufficient income',
  'High existing debt load',
  'Visa expires before loan completion',
  'Less than 90 days transaction data',
  'Income could not be verified',
  'Negative affordability surplus',
  'Failed credit check',
  'Recent payment defaults',
  'Loan purpose not permitted',
  'Incomplete application/documents',
  'AML/CFT concerns',
  'Other',
];

const REQUESTABLE_DOCS = [
  'Photo ID (passport or driver licence)',
  'Bank statements (last 3 months)',
  'Payslips (last 3 months)',
  'Proof of address',
  'Visa / residency document',
  'Evidence of other income (WINZ etc.)',
];

const MIN_APPROVED = 200;

const fmtNzd = (n: number) =>
  new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(n);

const docTone = (s: DocumentStatus): PillTone =>
  s === 'accepted' ? 'success' : s === 'rejected' ? 'danger' : 'neutral';

const docLabel = (s: DocumentStatus) => (s === 'accepted' ? 'Verified' : s === 'rejected' ? 'Rejected' : 'Pending');

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------
function Card({
  title,
  icon,
  action,
  muted,
  children,
}: {
  title?: string;
  icon?: ConsoleIconName;
  action?: React.ReactNode;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-[var(--radius-lg)] border bg-white p-5 shadow-[var(--shadow-xs)] ${
        muted ? 'border-dashed border-[var(--border-default)] bg-[var(--slate-50)]' : 'border-[var(--border-default)]'
      }`}
    >
      {title && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2
            className={`flex items-center gap-2 font-display text-[15px] font-bold ${
              muted ? 'text-[var(--text-muted)]' : 'text-[var(--text-strong)]'
            }`}
          >
            {icon && (
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-[8px] ${
                  muted ? 'bg-[var(--slate-100)] text-[var(--slate-400)]' : 'bg-[var(--orange-50)] text-[var(--orange-700)]'
                }`}
              >
                <ConsoleIcon name={icon} size={16} />
              </span>
            )}
            {title}
          </h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-1 break-words text-sm text-[var(--text-body)]">{value}</dd>
    </div>
  );
}

function MockBadge() {
  return <ConsolePill tone="neutral">Not connected</ConsolePill>;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function LoanReview({ data }: { data: ReviewData }) {
  const [tab, setTab] = useState<TabKey>('overview');

  const tabs: { key: TabKey; label: string; icon: ConsoleIconName; count?: number }[] = [
    { key: 'overview', label: 'Overview', icon: 'gauge' },
    { key: 'affordability', label: 'Affordability', icon: 'wallet' },
    { key: 'kyc', label: 'KYC', icon: 'shield' },
    { key: 'credit', label: 'Credit', icon: 'trending' },
    { key: 'calls', label: 'Calls', icon: 'phoneCall', count: 1 },
    { key: 'messages', label: 'Messages', icon: 'message', count: 2 },
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
        <span className="text-[var(--text-muted)]">{data.header.name} · Tabbed workspace</span>
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
              </div>
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                <span className="font-mono">{data.header.reference}</span> · Submitted {data.header.submittedLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Requested</p>
              <p className="font-mono text-lg font-bold tabular-nums text-[var(--text-strong)]">{data.header.requested}</p>
            </div>
            <div className="hidden max-w-[220px] sm:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Purpose</p>
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
          <Sidebar data={data} />
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
                  <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--surface-sunken)] px-1 text-[11px] font-bold text-[var(--text-muted)]">
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="space-y-5">
            {tab === 'overview' && <OverviewTab data={data} />}
            {tab === 'affordability' && <AffordabilityTab data={data} />}
            {tab === 'kyc' && <KycTab data={data} />}
            {tab === 'credit' && <CreditTab data={data} />}
            {tab === 'calls' && <CallsTab />}
            {tab === 'messages' && <MessagesTab data={data} />}
          </div>
        </main>
      </div>

      {showActionBar && (
        <ActionBar
          applicationId={data.applicationId}
          affordabilityComplete={data.affordability.complete}
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
function Sidebar({ data }: { data: ReviewData }) {
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
            {data.docsVerified}/{data.docsTotal} verified
          </span>
        </div>
        {data.documents.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No documents uploaded yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {data.documents.map((d, i) => (
              <li key={`${d.subtitle}-${i}`} className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--slate-100)] text-[var(--text-muted)]">
                    <ConsoleIcon name="fileText" size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--text-body)]">{d.title}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">{d.subtitle}</p>
                  </div>
                </div>
                <ConsolePill tone={docTone(d.status)}>{docLabel(d.status)}</ConsolePill>
              </li>
            ))}
          </ul>
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{label}</p>
        <p className="mt-0.5 break-words text-[13px] font-medium text-[var(--text-body)]">{value}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
function OverviewTab({ data }: { data: ReviewData }) {
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

      {/* Disburse */}
      {data.disburse && (
        <Card title="Disbursement" icon="wallet">
          <DisburseForm
            applicationId={data.applicationId}
            approvedAmount={data.disburse.approvedAmount}
            applicationFee={data.disburse.applicationFee}
            consentStatus={data.disburse.consentStatus}
            consentActivatedAt={data.disburse.consentActivatedAt}
          />
        </Card>
      )}

      {data.payments.show && (
        <ScheduledPaymentsPanel applicationId={data.applicationId} scheduledPayments={data.payments.scheduled} />
      )}

      {/* KYC summary (mocked) */}
      <KycCard data={data} />

      {/* Credit summary (mocked) */}
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Assessments</p>
            <p className="mt-0.5 font-semibold text-[var(--text-strong)]">{a.assessmentCount}</p>
          </div>
        </div>
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{c.label}</p>
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
                <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{d.label}</dt>
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
  return (
    <>
      <KycCard data={data} full />
      {/* Documents detail (real) */}
      <Card title="Documents" icon="fileText">
        {data.documents.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No documents uploaded yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.documents.map((d, i) => (
              <li
                key={`${d.subtitle}-${i}`}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--slate-50)] p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text-body)]">{d.title}</p>
                  <p className="truncate text-xs text-[var(--text-muted)]">{d.subtitle}</p>
                </div>
                <ConsolePill tone={docTone(d.status)}>{docLabel(d.status)}</ConsolePill>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function CreditTab({ data }: { data: ReviewData }) {
  return <CreditCard data={data} full />;
}

function CallsTab() {
  return (
    <Card title="Call log" icon="phoneCall" muted action={<MockBadge />}>
      <div className="space-y-3 opacity-60" aria-hidden="true">
        {[
          { dir: 'Outbound', note: 'Discussed loan purpose and repayment dates', when: 'Sample · 09:42' },
        ].map((c, i) => (
          <div key={i} className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white/60 p-3">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--slate-100)] text-[var(--slate-400)]">
                <ConsoleIcon name="phoneCall" size={16} />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--text-muted)]">{c.dir} call</p>
                <p className="text-xs text-[var(--text-muted)]">{c.note}</p>
              </div>
            </div>
            <span className="text-xs text-[var(--slate-400)]">{c.when}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-[var(--text-muted)]">
        Call logging is not yet connected. This panel shows sample data only.
      </p>
    </Card>
  );
}

function MessagesTab({ data }: { data: ReviewData }) {
  return (
    <>
      <Card title="Applicant messages" icon="message" muted action={<MockBadge />}>
        <div className="space-y-3 opacity-60" aria-hidden="true">
          <div className="max-w-[80%] rounded-[var(--radius-md)] bg-white/70 p-3">
            <p className="text-sm text-[var(--text-muted)]">Hi, when will I hear back on my application?</p>
            <p className="mt-1 text-[11px] text-[var(--slate-400)]">Applicant · sample</p>
          </div>
          <div className="ml-auto max-w-[80%] rounded-[var(--radius-md)] bg-[var(--slate-100)] p-3">
            <p className="text-sm text-[var(--text-muted)]">We&apos;re reviewing your documents and will update you shortly.</p>
            <p className="mt-1 text-right text-[11px] text-[var(--slate-400)]">You · sample</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-[var(--text-muted)]">
          In-app messaging is not yet connected. This panel shows sample data only.
        </p>
      </Card>

      {/* Internal notes (real) */}
      <Card title={`Internal notes (${data.notes.length})`} icon="fileText">
        {data.notes.length > 0 && (
          <ul className="mb-4 space-y-3">
            {data.notes.map((n) => (
              <li key={n.id} className="rounded-[var(--radius-md)] bg-[var(--slate-50)] p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--text-body)]">{n.author}</span>
                  <span className="text-xs text-[var(--text-muted)]">{n.date}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-[var(--text-body)]">{n.text}</p>
              </li>
            ))}
          </ul>
        )}
        {data.isAssigned && <AddNoteForm applicationId={data.applicationId} />}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// KYC + Credit cards (mocked, greyed)
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
  provider: 'datazoo' | 'centrix';
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

const ONBOARDING_DOC_TONE: Record<string, PillTone> = {
  pending_review: 'warning',
  pending: 'warning',
  accepted: 'success',
  approved: 'success',
  verified: 'success',
  rejected: 'danger',
};

const onboardingDocStatusLabel = (st: string) =>
  st === 'pending_review' || st === 'pending'
    ? 'Pending review'
    : st === 'accepted' || st === 'approved' || st === 'verified'
      ? 'Verified'
      : st === 'rejected'
        ? 'Rejected'
        : st;

function BorrowerKycList({
  docs,
  applicationId,
}: {
  docs: ReviewData['kyc']['borrowerDocuments'];
  applicationId: string;
}) {
  if (docs.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] bg-white/70 p-4 text-sm text-[var(--text-muted)]">
        No identity documents were uploaded by the borrower at onboarding.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {docs.map((d, i) => (
        <li
          key={`${d.fileId}-${i}`}
          className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white p-3"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--slate-100)] text-[var(--text-muted)]">
              <ConsoleIcon name="fileText" size={16} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text-body)]">{d.label}</p>
              <p className="truncate text-xs text-[var(--text-muted)]">
                {d.fileName} · Uploaded {d.uploadedAt}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ConsolePill tone={ONBOARDING_DOC_TONE[d.status] ?? 'neutral'}>
              {onboardingDocStatusLabel(d.status)}
            </ConsolePill>
            <a
              href={`/api/applications/${applicationId}/kyc-documents/${d.fileId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-[8px] border border-[var(--border-default)] bg-white px-2 py-1 text-xs font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)]"
            >
              <ConsoleIcon name="download" size={14} />
              Download
            </a>
          </div>
        </li>
      ))}
    </ul>
  );
}

function KycCard({ data, full = false }: { data: ReviewData; full?: boolean }) {
  void full;
  const k = data.kyc;
  const dzVerified = k.reports.length > 0;
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
      {/* Borrower-provided onboarding evidence (downloadable by the lender) */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
            Borrower identity documents (uploaded at onboarding)
          </p>
          <ConsolePill tone={k.borrowerStatusTone}>{k.borrowerStatusLabel}</ConsolePill>
        </div>
        <BorrowerKycList docs={k.borrowerDocuments} applicationId={data.applicationId} />
      </div>

      {/* Lender-run DataZoo identity check */}
      <div className="border-t border-[var(--border-subtle)] pt-5">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
          DataZoo identity check (lender)
        </p>
        <p className="mb-3 text-sm text-[var(--text-muted)]">
          Run the identity check in DataZoo and upload the report. It is stored on the borrower&apos;s
          profile and reused across their future loan applications.
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
  const reports = c.reports;
  const hasReport = reports.length > 0;
  const pct = Math.max(0, Math.min(1, (c.score - c.min) / (c.max - c.min)));
  return (
    <Card
      title="Credit — Centrix"
      icon="trending"
      muted={!hasReport}
      action={
        <ConsolePill tone={hasReport ? 'success' : 'warning'} dot>
          {hasReport ? 'Report on file' : 'No report'}
        </ConsolePill>
      }
    >
      <p className="mb-4 text-sm text-[var(--text-muted)]">
        Pull the credit report in Centrix and upload it here. It is stored on the borrower&apos;s profile
        and reused across their future loan applications.
      </p>
      <ReportList reports={reports} applicationId={data.applicationId} />
      <ReportUploader
        applicationId={data.applicationId}
        provider="centrix"
        providerLabel="Centrix"
        canUpload={data.isAssigned}
      />

      {full && (
        <div className="mt-5 border-t border-[var(--border-subtle)] pt-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
            Summary — sample, populated from the uploaded report
          </p>
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
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{m.label}</p>
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
        Claim this application to assign it to yourself and begin the affordability assessment.
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
// Sticky action bar + decision modals
// ---------------------------------------------------------------------------
type ActionMode = 'approve' | 'decline' | 'request' | null;

function ActionBar({
  applicationId,
  affordabilityComplete,
  requestedAmount,
  assessedAmount,
}: {
  applicationId: string;
  affordabilityComplete: boolean;
  requestedAmount: number;
  assessedAmount?: number;
}) {
  const [mode, setMode] = useState<ActionMode>(null);

  return (
    <>
      <div className="sticky bottom-0 z-30 -mx-4 mt-5 border-t border-[var(--border-default)] bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            {affordabilityComplete ? (
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
              Request info
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

function DecisionModal({
  mode,
  applicationId,
  requestedAmount,
  assessedAmount,
  onClose,
}: {
  mode: Exclude<ActionMode, null>;
  applicationId: string;
  requestedAmount: number;
  assessedAmount?: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [rationale, setRationale] = useState('');
  const [reasons, setReasons] = useState<string[]>([]);
  const [requestedDocs, setRequestedDocs] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [amount, setAmount] = useState<number>(Math.min(assessedAmount ?? requestedAmount, requestedAmount));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = mode === 'approve' ? 'Approve application' : mode === 'decline' ? 'Decline application' : 'Request more information';

  const amountInvalid =
    mode === 'approve' && (!Number.isFinite(amount) || amount < MIN_APPROVED || amount > requestedAmount);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const canSubmit =
    mode === 'approve'
      ? rationale.trim().length >= 10 && !amountInvalid
      : mode === 'decline'
        ? rationale.trim().length >= 10 && reasons.length > 0
        : requestedDocs.length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      let res: Response;
      if (mode === 'request') {
        res = await fetch(`/api/applications/${applicationId}/request-documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requiredDocuments: requestedDocs, message: message || undefined }),
        });
      } else {
        res = await fetch(`/api/applications/${applicationId}/decision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: mode === 'approve' ? 'approve' : 'decline',
            rationale,
            declineReasons: mode === 'decline' ? reasons : undefined,
            approvedAmount: mode === 'approve' ? amount : undefined,
          }),
        });
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error?.message ?? 'Request failed');
      }
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white px-3 py-2 text-sm text-[var(--text-body)] focus:border-[var(--orange-400)] focus:outline-none focus:ring-2 focus:ring-[var(--orange-400)]';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(15,29,46,0.45)] p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius-xl)] border border-[var(--border-default)] bg-white p-5 shadow-[var(--shadow-lg)] sm:rounded-[var(--radius-xl)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-[var(--text-strong)]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-body)]"
            aria-label="Close"
          >
            <ConsoleIcon name="x" size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-[var(--radius-md)] border border-[var(--danger-700)]/25 bg-[var(--danger-50)] px-3 py-2 text-sm text-[var(--danger-700)]">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {mode === 'approve' && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                Approved amount (NZD)
              </label>
              <input
                type="number"
                value={Number.isFinite(amount) ? amount : ''}
                onChange={(e) => setAmount(e.target.valueAsNumber)}
                min={MIN_APPROVED}
                max={requestedAmount}
                step={50}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Requested: {fmtNzd(requestedAmount)} · Allowed: {fmtNzd(MIN_APPROVED)} – {fmtNzd(requestedAmount)}
              </p>
              {amountInvalid && (
                <p className="mt-1 text-xs text-[var(--danger-700)]">
                  Amount must be between {fmtNzd(MIN_APPROVED)} and {fmtNzd(requestedAmount)}.
                </p>
              )}
            </div>
          )}

          {mode === 'decline' && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                Decline reasons (select all that apply)
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {STANDARD_DECLINE_REASONS.map((r) => (
                  <label key={r} className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-body)]">
                    <input
                      type="checkbox"
                      checked={reasons.includes(r)}
                      onChange={() => toggle(reasons, setReasons, r)}
                      className="rounded border-[var(--border-default)] text-[var(--orange-500)] focus:ring-[var(--orange-400)]"
                    />
                    {r}
                  </label>
                ))}
              </div>
            </div>
          )}

          {mode === 'request' && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                Documents to request
              </p>
              <div className="grid grid-cols-1 gap-2">
                {REQUESTABLE_DOCS.map((r) => (
                  <label key={r} className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-body)]">
                    <input
                      type="checkbox"
                      checked={requestedDocs.includes(r)}
                      onChange={() => toggle(requestedDocs, setRequestedDocs, r)}
                      className="rounded border-[var(--border-default)] text-[var(--orange-500)] focus:ring-[var(--orange-400)]"
                    />
                    {r}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
              {mode === 'request' ? 'Message to applicant (optional)' : 'Rationale'}
            </label>
            <textarea
              value={mode === 'request' ? message : rationale}
              onChange={(e) => (mode === 'request' ? setMessage(e.target.value) : setRationale(e.target.value))}
              rows={4}
              placeholder={
                mode === 'request'
                  ? 'Let the applicant know what you need and why…'
                  : `Document the reason for ${mode === 'approve' ? 'approving' : 'declining'}…`
              }
              className={`${inputClass} resize-none`}
            />
            {mode !== 'request' && rationale.trim().length > 0 && rationale.trim().length < 10 && (
              <p className="mt-1 text-xs text-[var(--danger-700)]">Rationale must be at least 10 characters.</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-[10px] px-4 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-body)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={loading || !canSubmit}
            className={`rounded-[10px] px-4 py-2 text-sm font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-50 ${
              mode === 'decline' ? 'bg-[var(--danger-700)]' : mode === 'approve' ? 'bg-[var(--success-700)]' : 'bg-[var(--orange-500)] text-[var(--ink-900)]'
            }`}
          >
            {loading
              ? 'Working…'
              : mode === 'approve'
                ? 'Confirm approval'
                : mode === 'decline'
                  ? 'Confirm decline'
                  : 'Send request'}
          </button>
        </div>
      </div>
    </div>
  );
}
