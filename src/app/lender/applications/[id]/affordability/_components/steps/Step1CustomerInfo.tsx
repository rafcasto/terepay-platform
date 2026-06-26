'use client';

import { fmt } from '../types';

interface Props {
  customerName: string;
  referenceNumber: string;
  loanAmount: number;
  loanTerm: number;
  assessmentDate: string;
  lenderName: string;
  isReassessment: boolean;
  onNext: () => void;
}

export default function Step1CustomerInfo({
  customerName,
  referenceNumber,
  loanAmount,
  loanTerm,
  assessmentDate,
  lenderName,
  isReassessment,
  onNext,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-[var(--text-strong)]">Customer Information</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Details from the loan application.</p>
      </div>

      {isReassessment && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--warning-700)]/20 bg-[var(--warning-50)] p-4 text-sm text-[var(--warning-700)]">
          <strong>Re-assessment:</strong> A completed assessment already exists. Submitting will
          create a new version and supersede the previous one.
        </div>
      )}

      <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white p-6 shadow-[var(--shadow-xs)]">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Customer Name *">
            <ReadonlyInput value={customerName || '—'} />
          </Field>
          <Field label="Client ID *">
            <ReadonlyInput value={referenceNumber || '—'} monospace />
          </Field>
          <Field label="Loan Amount Requested ($) *">
            <ReadonlyInput value={loanAmount ? fmt(loanAmount) : '$0.00'} />
          </Field>
          <Field label="Loan Term (weeks)">
            <ReadonlyInput value={String(loanTerm)} />
          </Field>
          <Field label="Assessment Date">
            <ReadonlyInput value={assessmentDate} />
          </Field>
          <Field label="Assessed By">
            <ReadonlyInput value={lenderName} />
          </Field>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button type="button" onClick={onNext} className={nextBtnCls}>
          Next →
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[var(--text-body)]">{label}</label>
      {children}
    </div>
  );
}

function ReadonlyInput({ value, monospace = false }: { value: string; monospace?: boolean }) {
  return (
    <div
      className={[
        'w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--slate-50)] px-3 py-2.5 text-sm text-[var(--text-body)]',
        monospace ? 'font-mono' : '',
      ].join(' ')}
    >
      {value}
    </div>
  );
}

const nextBtnCls =
  'rounded-[10px] bg-[var(--ink-800)] px-6 py-2.5 text-sm font-semibold text-white transition-[filter] hover:brightness-110';
