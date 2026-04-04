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
        <h2 className="text-xl font-bold text-gray-900">Data Collection Checklist</h2>
        <p className="text-sm text-gray-500 mt-1">
          Verify all documents and data before proceeding with income verification.
        </p>
      </div>

      {/* Validation errors */}
      {validationErrors && validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-800 mb-2">Please complete all required items before proceeding:</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
            {validationErrors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
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
                  className={`ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                    hasEnoughData
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {daysOfData} days — {hasEnoughData ? 'OK ✓' : 'INSUFFICIENT ✗'}
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
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#0D1B2A] focus:ring-[#0D1B2A] shrink-0"
        />
        <span className="text-sm font-medium text-gray-800">{label}</span>
      </label>
      {children && <div className="mt-2 pl-7">{children}</div>}
    </div>
  );
}

const inputCls =
  'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0D1B2A]/30 bg-gray-50 text-gray-800';
const nextBtnCls =
  'px-6 py-2.5 bg-[#0D1B2A] text-white rounded-lg text-sm font-semibold hover:bg-[#1a2f4a] transition-colors';
const backBtnCls =
  'px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors';
