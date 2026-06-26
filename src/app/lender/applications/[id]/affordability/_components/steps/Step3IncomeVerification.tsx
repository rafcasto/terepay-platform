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
        <h2 className="font-display text-xl font-bold text-[var(--text-strong)]">Income Verification</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          All amounts in NZD per fortnight. Verify income with payslips and bank statements.
        </p>
      </div>

      {/* Validation errors */}
      {validationErrors && validationErrors.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--danger-700)]/30 bg-[var(--danger-50)] p-4">
          <p className="mb-2 text-sm font-semibold text-[var(--danger-700)]">Please resolve the following before proceeding:</p>
          <ul className="list-inside list-disc space-y-1 text-sm text-[var(--danger-700)]">
            {validationErrors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white shadow-[var(--shadow-xs)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-default)] bg-[var(--slate-50)]">
              <th className={`${thCls} min-w-[160px] text-left`}>Income Source</th>
              <th className={`${thCls} min-w-[110px] text-right`}>Centrix Amount</th>
              <th className={`${thCls} min-w-[110px] text-right`}>Verified Amount</th>
              <th className={`${thCls} min-w-[100px] text-right`}>Adjustment</th>
              <th className="min-w-[110px] bg-[var(--orange-50)] px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--orange-700)]">
                Final Amount
              </th>
              <th className={`${thCls} min-w-[130px] text-left`}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {incomeRows.map((row, i) => (
              <tr key={row.category} className="border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--slate-50)]">
                <td className="px-4 py-3 font-medium text-[var(--text-body)]">{row.category}</td>
                <td className="px-3 py-3">
                  <NumInput value={row.centrixAmount} onChange={(v) => onUpdate(i, 'centrixAmount', v)} />
                </td>
                <td className="px-3 py-3">
                  <NumInput value={row.verifiedAmount} onChange={(v) => onUpdate(i, 'verifiedAmount', v)} />
                </td>
                <td className="px-3 py-3">
                  <NumInput value={row.adjustment} onChange={(v) => onUpdate(i, 'adjustment', v)} allowNegative />
                </td>
                <td className="bg-[var(--orange-50)] px-3 py-3 text-right font-mono font-bold tabular-nums text-[var(--text-strong)]">
                  {fmt(row.finalAmount)}
                </td>
                <td className="px-3 py-3">
                  <input
                    type="text"
                    value={row.adjustmentReason}
                    onChange={(e) => onUpdate(i, 'adjustmentReason', e.target.value)}
                    placeholder="Notes"
                    className={noteCls}
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[var(--ink-900)]">
              <td colSpan={4} className="px-4 py-3 text-right text-sm font-bold uppercase tracking-wide text-white">
                Total Fortnightly Income
              </td>
              <td className="bg-[var(--ink-900)] px-3 py-3 text-right font-mono text-base font-bold tabular-nums text-[var(--orange-400)]">
                {fmt(totalIncome)}
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
        className="w-24 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-white px-2 py-1.5 text-right text-xs text-[var(--text-body)] focus:border-[var(--orange-400)] focus:outline-none focus:ring-1 focus:ring-[var(--orange-400)]"
        placeholder="0.00"
      />
    </div>
  );
}

const thCls = 'px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]';
const noteCls =
  'w-full rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-white px-2 py-1.5 text-xs text-[var(--text-body)] focus:border-[var(--orange-400)] focus:outline-none focus:ring-1 focus:ring-[var(--orange-400)]';
const nextBtnCls =
  'rounded-[10px] bg-[var(--ink-800)] px-6 py-2.5 text-sm font-semibold text-white transition-[filter] hover:brightness-110';
const backBtnCls =
  'rounded-[10px] border border-[var(--border-default)] px-6 py-2.5 text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)]';
