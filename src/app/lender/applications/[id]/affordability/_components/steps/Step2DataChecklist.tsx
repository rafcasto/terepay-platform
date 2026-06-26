'use client';

import type { Checklist } from '../types';

interface Props {
  checklist: Checklist;
  onChange: (c: Checklist) => void;
  daysOfData: number;
  onNext: () => void;
  onBack: () => void;
  validationErrors?: string[];
}

export default function Step2DataChecklist({
  checklist,
  onChange,
  daysOfData,
  onNext,
  onBack,
  validationErrors,
}: Props) {
  const update = (patch: Partial<Checklist>) => onChange({ ...checklist, ...patch });
  const hasEnoughData = daysOfData >= 90;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-[var(--text-strong)]">Data Collection Checklist</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Verify all documents and data before proceeding with income verification.
        </p>
      </div>

      {/* Validation errors */}
      {validationErrors && validationErrors.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--danger-700)]/30 bg-[var(--danger-50)] p-4">
          <p className="mb-2 text-sm font-semibold text-[var(--danger-700)]">Please complete all required items before proceeding:</p>
          <ul className="list-inside list-disc space-y-1 text-sm text-[var(--danger-700)]">
            {validationErrors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}

      <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white shadow-[var(--shadow-xs)]">
        {/* 1. Centrix Report */}
        <ChecklistItem
          checked={checklist.centrixReportObtained}
          label="Centrix Report obtained"
          onChange={(v) => update({ centrixReportObtained: v })}
        >
          <input
            type="text"
            value={checklist.centrixReportNumber}
            onChange={(e) => update({ centrixReportNumber: e.target.value })}
            placeholder="Report Number"
            className={inputCls}
          />
        </ChecklistItem>

        {/* 2. First transaction date */}
        <ChecklistItem
          checked={checklist.firstTransactionVerified}
          label={
            <span>
              First transaction date verified (90+ days required)
              {daysOfData > 0 && (
                <span
                  className={`ml-2 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    hasEnoughData
                      ? 'bg-[var(--success-50)] text-[var(--success-700)]'
                      : 'bg-[var(--danger-50)] text-[var(--danger-700)]'
                  }`}
                >
                  {daysOfData} days — {hasEnoughData ? 'OK' : 'INSUFFICIENT'}
                </span>
              )}
            </span>
          }
          onChange={(v) => update({ firstTransactionVerified: v })}
        >
          <input
            type="date"
            value={checklist.firstTransactionDate}
            onChange={(e) => update({ firstTransactionDate: e.target.value })}
            className={inputCls}
          />
        </ChecklistItem>

        {/* 3. Payslips */}
        <ChecklistItem
          checked={checklist.payslipsReceived}
          label="Payslips received (last 2-3)"
          onChange={(v) => update({ payslipsReceived: v })}
        />

        {/* 4. Credit report */}
        <ChecklistItem
          checked={checklist.creditReportObtained}
          label="Credit report obtained"
          onChange={(v) => update({ creditReportObtained: v })}
        />

        {/* 5. Employment */}
        <ChecklistItem
          checked={checklist.employmentVerified}
          label="Employment verified"
          onChange={(v) => update({ employmentVerified: v })}
        >
          <input
            type="text"
            value={checklist.employmentVerificationMethod}
            onChange={(e) => update({ employmentVerificationMethod: e.target.value })}
            placeholder="Verification method"
            className={inputCls}
          />
        </ChecklistItem>

        {/* 6. Visa status */}
        <ChecklistItem
          checked={checklist.visaConfirmed}
          label="Visa status confirmed"
          onChange={(v) => update({ visaConfirmed: v })}
        >
          <input
            type="date"
            value={checklist.visaExpiryDate}
            onChange={(e) => update({ visaExpiryDate: e.target.value })}
            className={inputCls}
          />
        </ChecklistItem>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onBack} className={backBtnCls}>
          ← Back
        </button>
        <button type="button" onClick={onNext} className={nextBtnCls}>
          Next →
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ChecklistItem({
  checked,
  label,
  onChange,
  children,
}: {
  checked: boolean;
  label: React.ReactNode;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="p-5">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--border-default)] text-[var(--orange-500)] focus:ring-[var(--orange-400)]"
        />
        <span className="text-sm font-medium text-[var(--text-body)]">{label}</span>
      </label>
      {children && <div className="mt-2 pl-7">{children}</div>}
    </div>
  );
}

const inputCls =
  'w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white px-3 py-2 text-sm text-[var(--text-body)] focus:border-[var(--orange-400)] focus:outline-none focus:ring-2 focus:ring-[var(--orange-400)]';
const nextBtnCls =
  'rounded-[10px] bg-[var(--ink-800)] px-6 py-2.5 text-sm font-semibold text-white transition-[filter] hover:brightness-110';
const backBtnCls =
  'rounded-[10px] border border-[var(--border-default)] px-6 py-2.5 text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)]';
