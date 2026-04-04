'use client';

import type { ExpenseRow } from '../types';
import { fmt, NON_DISCRETIONARY_CATEGORIES, EXPENSE_DISPLAY_NAMES } from '../types';

interface Props {
  expenseRows: ExpenseRow[];
  onUpdate: (index: number, field: keyof ExpenseRow, value: number | string) => void;
  totalExpenses: number;
  onNext: () => void;
  onBack: () => void;
}

const NON_DISC_SET = new Set(NON_DISCRETIONARY_CATEGORIES as readonly string[]);

export default function Step4ExpenseVerification({
  expenseRows,
  onUpdate,
  totalExpenses,
  onNext,
  onBack,
}: Props) {
  const ndRows = expenseRows.filter((r) => NON_DISC_SET.has(r.category));
  const discRows = expenseRows.filter((r) => !NON_DISC_SET.has(r.category));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Expense Verification &amp; Adjustments</h2>
        <p className="text-sm text-gray-500 mt-1">All amounts in NZD per fortnight.</p>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-800 mb-2">Important:</p>
        <ul className="list-disc list-inside space-y-1 text-sm text-blue-700">
          <li>Use benchmarks when borrower&apos;s stated expenses seem unrealistically low</li>
          <li>Final amount = MAX(Centrix Amount, Benchmark) + Adjustment</li>
          <li>Document all adjustments in the Notes column</li>
        </ul>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[200px]">
                Expense Category
              </th>
              <th className="py-3 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[110px]">
                Centrix Amount
              </th>
              <th className="py-3 px-3 text-right text-xs font-semibold text-amber-600 uppercase tracking-wide min-w-[100px]">
                Benchmark
              </th>
              <th className="py-3 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[100px]">
                Adjustment
              </th>
              <th className="py-3 px-3 text-right text-xs font-semibold text-[#0D1B2A] uppercase tracking-wide bg-blue-50 min-w-[110px]">
                Final Amount
              </th>
              <th className="py-3 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-[130px]">
                Notes/Reason
              </th>
            </tr>
          </thead>
          <tbody>
            <SectionHeader label="Non-Discretionary Expenses" />
            {ndRows.map((row) => (
              <ExpenseRowTr
                key={row.category}
                row={row}
                index={expenseRows.indexOf(row)}
                onUpdate={onUpdate}
              />
            ))}
            <SectionHeader label="Discretionary Expenses" />
            {discRows.map((row) => (
              <ExpenseRowTr
                key={row.category}
                row={row}
                index={expenseRows.indexOf(row)}
                onUpdate={onUpdate}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#0D1B2A]">
              <td colSpan={4} className="py-3 px-4 text-right font-bold text-white text-sm uppercase tracking-wide">
                Total Fortnightly Expenses
              </td>
              <td className="py-3 px-3 text-right font-bold text-[#F5A523] text-base bg-[#0D1B2A]">
                {fmt(totalExpenses)}
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

function SectionHeader({ label }: { label: string }) {
  return (
    <tr className="bg-gray-50/80 border-t border-gray-200">
      <td colSpan={6} className="py-2 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
        {label}
      </td>
    </tr>
  );
}

function ExpenseRowTr({
  row,
  index,
  onUpdate,
}: {
  row: ExpenseRow;
  index: number;
  onUpdate: (i: number, field: keyof ExpenseRow, value: number | string) => void;
}) {
  const displayName = EXPENSE_DISPLAY_NAMES[row.category] ?? row.category;
  const hasBenchmark = row.benchmarkAmount > 0;
  const benchmarkActive = hasBenchmark && row.benchmarkAmount > row.centrixAmount;

  return (
    <tr
      className={[
        'border-b border-gray-50 hover:bg-gray-50/50 transition-colors',
        benchmarkActive ? 'bg-amber-50/40' : '',
      ].join(' ')}
    >
      <td className="py-2.5 px-4 font-medium text-gray-700 text-sm">{displayName}</td>

      {/* Centrix */}
      <td className="py-2.5 px-3">
        <div className="flex justify-end">
          <input
            type="number"
            min={0}
            step="0.01"
            value={row.centrixAmount || ''}
            onChange={(e) => onUpdate(index, 'centrixAmount', parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            className="w-24 text-xs text-right border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D1B2A]/30 bg-white"
          />
        </div>
      </td>

      {/* Benchmark */}
      <td className="py-2.5 px-3">
        {hasBenchmark ? (
          <div className="flex items-center justify-end gap-1">
            <span
              className={[
                'text-sm font-semibold px-2 py-1 rounded',
                benchmarkActive
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-gray-100 text-gray-600',
              ].join(' ')}
            >
              {row.benchmarkAmount.toFixed(0)}
            </span>
            {benchmarkActive && (
              <span title="Benchmark exceeds Centrix — benchmark is being used">
                <svg
                  className="h-4 w-4 text-amber-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
                  />
                </svg>
              </span>
            )}
          </div>
        ) : (
          <span className="block text-xs text-gray-400 text-right pr-2">N/A</span>
        )}
      </td>

      {/* Adjustment */}
      <td className="py-2.5 px-3">
        <div className="flex justify-end">
          <input
            type="number"
            step="0.01"
            value={row.adjustment || ''}
            onChange={(e) => onUpdate(index, 'adjustment', parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            className="w-24 text-xs text-right border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D1B2A]/30 bg-white"
          />
        </div>
      </td>

      {/* Final */}
      <td className="py-2.5 px-3 text-right font-bold text-[#0D1B2A] bg-blue-50">
        {fmt(row.finalAmount)}
      </td>

      {/* Notes */}
      <td className="py-2.5 px-3">
        <input
          type="text"
          value={row.adjustmentReason}
          onChange={(e) => onUpdate(index, 'adjustmentReason', e.target.value)}
          placeholder="Notes/Reason"
          className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0D1B2A]/30 bg-white"
        />
      </td>
    </tr>
  );
}

const nextBtnCls =
  'px-6 py-2.5 bg-[#0D1B2A] text-white rounded-lg text-sm font-semibold hover:bg-[#1a2f4a] transition-colors';
const backBtnCls =
  'px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors';
