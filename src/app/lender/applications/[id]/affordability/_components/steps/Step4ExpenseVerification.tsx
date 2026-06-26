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
        <h2 className="font-display text-xl font-bold text-[var(--text-strong)]">Expense Verification &amp; Adjustments</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">All amounts in NZD per fortnight.</p>
      </div>

      {/* Info banner */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--info-700)]/20 bg-[var(--info-50)] p-4">
        <p className="mb-2 text-sm font-semibold text-[var(--info-700)]">Important:</p>
        <ul className="list-inside list-disc space-y-1 text-sm text-[var(--info-700)]">
          <li>Use benchmarks when borrower&apos;s stated expenses seem unrealistically low</li>
          <li>Final amount = MAX(Centrix Amount, Benchmark) + Adjustment</li>
          <li>Document all adjustments in the Notes column</li>
        </ul>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white shadow-[var(--shadow-xs)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-default)] bg-[var(--slate-50)]">
              <th className={`${thCls} min-w-[200px] text-left`}>Expense Category</th>
              <th className={`${thCls} min-w-[110px] text-right`}>Centrix Amount</th>
              <th className="min-w-[100px] px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--warning-700)]">
                Benchmark
              </th>
              <th className={`${thCls} min-w-[100px] text-right`}>Adjustment</th>
              <th className="min-w-[110px] bg-[var(--orange-50)] px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--orange-700)]">
                Final Amount
              </th>
              <th className={`${thCls} min-w-[130px] text-left`}>Notes/Reason</th>
            </tr>
          </thead>
          <tbody>
            <SectionHeader label="Non-Discretionary Expenses" />
            {ndRows.map((row) => (
              <ExpenseRowTr key={row.category} row={row} index={expenseRows.indexOf(row)} onUpdate={onUpdate} />
            ))}
            <SectionHeader label="Discretionary Expenses" />
            {discRows.map((row) => (
              <ExpenseRowTr key={row.category} row={row} index={expenseRows.indexOf(row)} onUpdate={onUpdate} />
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[var(--ink-900)]">
              <td colSpan={4} className="px-4 py-3 text-right text-sm font-bold uppercase tracking-wide text-white">
                Total Fortnightly Expenses
              </td>
              <td className="bg-[var(--ink-900)] px-3 py-3 text-right font-mono text-base font-bold tabular-nums text-[var(--orange-400)]">
                {fmt(totalExpenses)}
              </td>
              <td className="bg-[var(--ink-900)]" />
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
    <tr className="border-t border-[var(--border-default)] bg-[var(--slate-50)]">
      <td colSpan={6} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
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
        'border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--slate-50)]',
        benchmarkActive ? 'bg-[var(--warning-50)]/50' : '',
      ].join(' ')}
    >
      <td className="px-4 py-2.5 text-sm font-medium text-[var(--text-body)]">{displayName}</td>

      {/* Centrix */}
      <td className="px-3 py-2.5">
        <div className="flex justify-end">
          <input
            type="number"
            min={0}
            step="0.01"
            value={row.centrixAmount || ''}
            onChange={(e) => onUpdate(index, 'centrixAmount', parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            className={numCls}
          />
        </div>
      </td>

      {/* Benchmark */}
      <td className="px-3 py-2.5">
        {hasBenchmark ? (
          <div className="flex items-center justify-end gap-1">
            <span
              className={[
                'rounded px-2 py-1 text-sm font-semibold',
                benchmarkActive
                  ? 'bg-[var(--warning-50)] text-[var(--warning-700)]'
                  : 'bg-[var(--slate-100)] text-[var(--text-muted)]',
              ].join(' ')}
            >
              {row.benchmarkAmount.toFixed(0)}
            </span>
            {benchmarkActive && (
              <span title="Benchmark exceeds Centrix — benchmark is being used" className="text-[var(--warning-700)]">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
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
          <span className="block pr-2 text-right text-xs text-[var(--slate-400)]">N/A</span>
        )}
      </td>

      {/* Adjustment */}
      <td className="px-3 py-2.5">
        <div className="flex justify-end">
          <input
            type="number"
            step="0.01"
            value={row.adjustment || ''}
            onChange={(e) => onUpdate(index, 'adjustment', parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            className={numCls}
          />
        </div>
      </td>

      {/* Final */}
      <td className="bg-[var(--orange-50)] px-3 py-2.5 text-right font-mono font-bold tabular-nums text-[var(--text-strong)]">
        {fmt(row.finalAmount)}
      </td>

      {/* Notes */}
      <td className="px-3 py-2.5">
        <input
          type="text"
          value={row.adjustmentReason}
          onChange={(e) => onUpdate(index, 'adjustmentReason', e.target.value)}
          placeholder="Notes/Reason"
          className={noteCls}
        />
      </td>
    </tr>
  );
}

const thCls = 'px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]';
const numCls =
  'w-24 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-white px-2 py-1.5 text-right text-xs text-[var(--text-body)] focus:border-[var(--orange-400)] focus:outline-none focus:ring-1 focus:ring-[var(--orange-400)]';
const noteCls =
  'w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-white px-2 py-1.5 text-xs text-[var(--text-body)] focus:border-[var(--orange-400)] focus:outline-none focus:ring-1 focus:ring-[var(--orange-400)]';
const nextBtnCls =
  'rounded-[10px] bg-[var(--ink-800)] px-6 py-2.5 text-sm font-semibold text-white transition-[filter] hover:brightness-110';
const backBtnCls =
  'rounded-[10px] border border-[var(--border-default)] px-6 py-2.5 text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)]';
