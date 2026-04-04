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
        <h2 className="text-xl font-bold text-gray-900">Customer Information</h2>
        <p className="text-sm text-gray-500 mt-1">Details from the loan application.</p>
      </div>

      {isReassessment && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <strong>Re-assessment:</strong> A completed assessment already exists. Submitting will
          create a new version and supersede the previous one.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
        <button
          type="button"
          onClick={onNext}
          className="px-6 py-2.5 bg-[#0D1B2A] text-white rounded-lg text-sm font-semibold hover:bg-[#1a2f4a] transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ReadonlyInput({ value, monospace = false }: { value: string; monospace?: boolean }) {
  return (
    <div
      className={[
        'w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-800',
        monospace ? 'font-mono' : '',
      ].join(' ')}
    >
      {value}
    </div>
  );
}
