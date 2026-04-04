'use client';

import type { IncomeRow } from '../types';
import { fmt } from '../types';

interface Props {
  incomeRows: IncomeRow[];
  onUpdate: (index: number, field: keyof IncomeRow, value: number | string) => void;
  totalIncome: number;
  onNext: () => void;
  onBack: () => void;
  validationErrors?: string[];
}

export default function Step3IncomeVerification({
  incomeRows,
  onUpdate,
  totalIncome,
  onNext,
  onBack,
  validationErrors,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Income Verification</h2>
        <p className="text-sm text-gray-500 mt-1">
          All amounts in NZD per fortnight. Verify income with payslips and bank statements.
        </p>
      </div>

      {/* Validation errors */}
      {validationErrors && validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-800 mb-2">Please resolve the following before proceeding:</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
            {validationErrors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[160px]">
                Income Source
              </th>
              <th className="py-3 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[110px]">
                Centrix Amount
              </th>
              <th className="py-3 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[110px]">
                Verified Amount
              </th>
              <th className="py-3 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[100px]">
                Adjustment
              </th>
              <th className="py-3 px-3 text-right text-xs font-semibold text-[#0D1B2A] uppercase tracking-wide bg-blue-50 min-w-[110px]">
                Final Amount
              </th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[130px]">
                Notes
              </th>
            </tr>
          </thead>
          <tbody>
            {incomeRows.map((row, i) => (
              <tr key={row.category} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="py-3 px-4 font-medium text-gray-700">{row.category}</td>
                <td className="py-3 px-3">
                  <NumInput
                    value={row.centrixAmount}
                    onChange={(v) => onUpdate(i, 'centrixAmount', v)}
                  />
                </td>
                <td className="py-3 px-3">
                  <NumInput
                    value={row.verifiedAmount}
                    onChange={(v) => onUpdate(i, 'verifiedAmount', v)}
                  />
                </td>
                <td className="py-3 px-3">
                  <NumInput
                    value={row.adjustment}
                    onChange={(v) => onUpdate(i, 'adjustment', v)}
                    allowNegative
                  />
                </td>
                <td className="py-3 px-3 text-right font-bold text-[#0D1B2A] bg-blue-50">
                  {fmt(row.finalAmount)}
                </td>
                <td className="py-3 px-3">
                  <input
                    type="text"
                    value={row.adjustmentReason}
                    onChange={(e) => onUpdate(i, 'adjustmentReason', e.target.value)}
                    placeholder="Notes"
                    className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D1B2A]/30 bg-white"
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#0D1B2A]">
              <td colSpan={4} className="py-3 px-4 text-right font-bold text-white text-sm uppercase tracking-wide">
                Total Fortnightly Income
              </td>
              <td className="py-3 px-3 text-right font-bold text-[#F5A523] text-base bg-[#0D1B2A]">
                {fmt(totalIncome)}
              </td>
              <td className="bg-[#0D1B2A]" />
            </tr>
          </tfoot>
        </table>
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

function NumInput({
  value,
  onChange,
  allowNegative = false,
}: {
  value: number;
  onChange: (v: number) => void;
  allowNegative?: boolean;
}) {
  return (
    <div className="flex justify-end">
      <input
        type="number"
        min={allowNegative ? undefined : 0}
        step="0.01"
        value={value || ''}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-24 text-xs text-right border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D1B2A]/30 bg-white"
        placeholder="0.00"
      />
    </div>
  );
}

const nextBtnCls =
  'px-6 py-2.5 bg-[#0D1B2A] text-white rounded-lg text-sm font-semibold hover:bg-[#1a2f4a] transition-colors';
const backBtnCls =
  'px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors';
