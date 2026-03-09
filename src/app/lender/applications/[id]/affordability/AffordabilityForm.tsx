'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ──────────────────────────────────────────────────────────────────

interface IncomeRow {
  category: string;
  statedAmount: number;
  centrixAmount: number;
  verifiedAmount: number;
  adjustment: number;
  adjustmentReason: string;
  finalAmount: number;
}

interface ExpenseRow {
  category: string;
  statedAmount: number;
  centrixAmount: number;
  benchmarkAmount: number;
  adjustment: number;
  adjustmentReason: string;
  finalAmount: number;
  benchmarkOverrideAcknowledged: boolean;
}

interface BenchmarkEntry {
  benchmarkId: string;
  categoryName: string;
  fortnightlyAmount: number;
}

interface Checklist {
  centrixReportNumber: string;
  firstTransactionDate: string;
  paylipsReceived: boolean;
  employmentVerified: boolean;
  employmentVerificationMethod: string;
  visaConfirmed: boolean;
}

const INCOME_CATEGORIES = ['Salary/Wages', 'Bonus', 'Government Benefits / WINZ', 'Other Income'];

const EXPENSE_CATEGORIES = [
  'Accommodation/Rent', 'Food & Groceries', 'Utilities', 'Personal/Clothing',
  'Transport', 'Medical', 'Childcare', 'Health Insurance', 'Car Insurance',
  'Rates', 'Education', 'Child Support', 'Remittances', 'Restaurants/Takeaways',
  'Entertainment', 'Travel', 'Subscriptions', 'Home Improvement',
  'Cash Withdrawals', 'Buy Now Pay Later', 'Existing Debt Repayments', 'Other',
];

const HOUSEHOLD_MULTIPLIERS: Record<string, number> = {
  single: 1.0,
  single_children: 1.5,
  couple: 1.5,
  couple_children: 1.8,
};

function calcIncomeRow(row: IncomeRow): IncomeRow {
  const c = row.centrixAmount;
  const v = row.verifiedAmount;
  // Lower of Centrix and Verified (conservative per CCCFA)
  let final = 0;
  if (c > 0 && v > 0) final = Math.min(c, v);
  else if (c > 0) final = c;
  else if (v > 0) final = v;
  return { ...row, finalAmount: final };
}

function calcExpenseRow(row: ExpenseRow): ExpenseRow {
  const final = Math.max(row.centrixAmount, row.benchmarkAmount, row.adjustment > 0 ? row.adjustment : 0);
  return { ...row, finalAmount: final };
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', minimumFractionDigits: 2 }).format(n);

// ─── Component ──────────────────────────────────────────────────────────────

export default function AffordabilityForm({
  applicationId,
  loanAmount,
  householdType,
  preFillIncome,
  preFillExpenses,
  visaExpiryDate,
  catalogVersionId,
}: {
  applicationId: string;
  loanAmount: number;
  householdType: string;
  preFillIncome: Partial<Record<string, number>>;
  preFillExpenses: Partial<Record<string, number>>;
  visaExpiryDate?: string;
  catalogVersionId: string;
}) {
  const router = useRouter();
  const hMult = HOUSEHOLD_MULTIPLIERS[householdType] ?? 1.0;

  const [checklist, setChecklist] = useState<Checklist>({
    centrixReportNumber: '',
    firstTransactionDate: '',
    paylipsReceived: false,
    employmentVerified: false,
    employmentVerificationMethod: '',
    visaConfirmed: false,
  });

  const [benchmarks, setBenchmarks] = useState<BenchmarkEntry[]>([]);
  const [incomeRows, setIncomeRows] = useState<IncomeRow[]>(() =>
    INCOME_CATEGORIES.map((cat) => ({
      category: cat,
      statedAmount: preFillIncome[cat] ?? 0,
      centrixAmount: 0,
      verifiedAmount: 0,
      adjustment: 0,
      adjustmentReason: '',
      finalAmount: 0,
    })),
  );
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>(() =>
    EXPENSE_CATEGORIES.map((cat) => ({
      category: cat,
      statedAmount: preFillExpenses[cat] ?? 0,
      centrixAmount: 0,
      benchmarkAmount: 0,
      adjustment: 0,
      adjustmentReason: '',
      finalAmount: 0,
      benchmarkOverrideAcknowledged: false,
    })),
  );

  const [redFlagsAcknowledged, setRedFlagsAcknowledged] = useState<Record<string, string>>({});
  const [recommendation, setRecommendation] = useState<'proceed' | 'decline'>('proceed');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load benchmarks
  useEffect(() => {
    fetch('/api/benchmarks')
      .then((r) => r.json())
      .then((data) => {
        if (data.benchmarks) {
          setBenchmarks(data.benchmarks);
          // Apply benchmarks to expense rows
          setExpenseRows((rows) =>
            rows.map((row) => {
              const bmEntry = (data.benchmarks as BenchmarkEntry[]).find(
                (b) => b.categoryName.toLowerCase() === row.category.toLowerCase(),
              );
              const benchmarkAmount = bmEntry ? bmEntry.fortnightlyAmount * hMult : 0;
              return calcExpenseRow({ ...row, benchmarkAmount });
            }),
          );
        }
      })
      .catch(() => undefined);
  }, [hMult]);

  // Recalculate rows when values change
  const updateIncomeRow = useCallback((index: number, field: keyof IncomeRow, value: number | string) => {
    setIncomeRows((rows) => {
      const updated = [...rows];
      updated[index] = calcIncomeRow({ ...updated[index], [field]: value });
      return updated;
    });
  }, []);

  const updateExpenseRow = useCallback((index: number, field: keyof ExpenseRow, value: number | string | boolean) => {
    setExpenseRows((rows) => {
      const updated = [...rows];
      updated[index] = calcExpenseRow({ ...updated[index], [field]: value });
      return updated;
    });
  }, []);

  // Computed totals
  const totalIncome = incomeRows.reduce((s, r) => s + r.finalAmount, 0);
  const totalExpenses = expenseRows.reduce((s, r) => s + r.finalAmount, 0);
  const netDisposable = totalIncome - totalExpenses;
  const loanPayment = (loanAmount * 1.047) / 4;
  const surplus = netDisposable - loanPayment;

  const daysOfData = checklist.firstTransactionDate
    ? Math.floor((Date.now() - new Date(checklist.firstTransactionDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const hardDeclines: string[] = [];
  if (daysOfData > 0 && daysOfData < 90) hardDeclines.push('< 90 days of transaction data');
  if (surplus <= 0) hardDeclines.push('Surplus ≤ $0 — not affordable');
  if (visaExpiryDate) {
    const loanEnd = new Date();
    loanEnd.setDate(loanEnd.getDate() + 56 + 90); // 56 days + 3 months buffer
    if (new Date(visaExpiryDate) < loanEnd) hardDeclines.push('Visa expires before loan completion + 3 months');
  }

  const surplusRating =
    surplus > 100 ? 'LIKELY AFFORDABLE ✓' :
    surplus >= 50 ? 'MARGINAL ⚠' :
    surplus > 0 ? 'HIGH RISK ✗' : 'NOT AFFORDABLE ✗';

  const surplusColor =
    surplus > 100 ? 'text-green-700 bg-green-50' :
    surplus >= 50 ? 'text-amber-700 bg-amber-50' :
    'text-red-700 bg-red-50';

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/affordability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklist: { ...checklist, daysOfTransactionData: daysOfData },
          incomeRows,
          expenseRows,
          householdMultiplier: hMult,
          catalogVersionId,
          redFlagsAcknowledged,
          recommendation,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'Failed to submit assessment');
      }
      setSuccess(true);
      router.push(`/lender/applications/${applicationId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-4 text-sm">
          Assessment submitted successfully. Redirecting…
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">{error}</div>
      )}

      {/* Hard Declines Alert */}
      {hardDeclines.length > 0 && (
        <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4">
          <p className="font-semibold text-red-800 mb-2">🚫 Hard Decline Triggered</p>
          <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
            {hardDeclines.map((d) => <li key={d}>{d}</li>)}
          </ul>
          <p className="text-xs text-red-600 mt-2">These conditions cannot be overridden. The system will force-decline.</p>
        </div>
      )}

      {/* ── Section 1: Data Collection Checklist ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">1. Data Collection Checklist</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Centrix Report Number *</label>
            <input
              type="text"
              value={checklist.centrixReportNumber}
              onChange={(e) => setChecklist((c) => ({ ...c, centrixReportNumber: e.target.value }))}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. CTX-2026-12345"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              First Transaction Date *
              {daysOfData > 0 && (
                <span className={`ml-2 font-normal ${daysOfData < 90 ? 'text-red-600' : 'text-green-600'}`}>
                  ({daysOfData} days of data{daysOfData < 90 ? ' — INSUFFICIENT' : ' — OK'})
                </span>
              )}
            </label>
            <input
              type="date"
              value={checklist.firstTransactionDate}
              onChange={(e) => setChecklist((c) => ({ ...c, firstTransactionDate: e.target.value }))}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Employment Verification Method *</label>
            <select
              value={checklist.employmentVerificationMethod}
              onChange={(e) => setChecklist((c) => ({ ...c, employmentVerificationMethod: e.target.value }))}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select…</option>
              <option>Payslip</option>
              <option>Phone verification</option>
              <option>Email confirmation</option>
              <option>Employer letter</option>
            </select>
          </div>
          <div className="space-y-2 pt-2">
            {[
              { key: 'paylipsReceived', label: 'Payslips received (last 2-3)' },
              { key: 'employmentVerified', label: 'Employment verified' },
              { key: 'visaConfirmed', label: 'Visa status confirmed' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist[key as keyof Checklist] as boolean}
                  onChange={(e) => setChecklist((c) => ({ ...c, [key]: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 2: Income Verification ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 overflow-x-auto">
        <h2 className="font-semibold text-gray-900 mb-4">2. Income Verification (Fortnightly NZD)</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2 pr-2 text-left font-medium text-gray-500 min-w-[140px]">Category</th>
              <th className="py-2 px-2 text-right font-medium text-gray-500">Stated (App)</th>
              <th className="py-2 px-2 text-right font-medium text-blue-600">Centrix</th>
              <th className="py-2 px-2 text-right font-medium text-purple-600">Payslip</th>
              <th className="py-2 px-2 text-right font-medium text-gray-500">Adjustment</th>
              <th className="py-2 pl-2 text-right font-medium text-green-700 bg-green-50 rounded">Final</th>
            </tr>
          </thead>
          <tbody>
            {incomeRows.map((row, i) => (
              <tr key={row.category} className="border-b border-gray-50">
                <td className="py-1.5 pr-2 text-gray-700 font-medium">{row.category}</td>
                <td className="py-1.5 px-2 text-right text-gray-400">{fmt(row.statedAmount)}</td>
                <td className="py-1.5 px-2">
                  <input
                    type="number"
                    min="0"
                    value={row.centrixAmount || ''}
                    onChange={(e) => updateIncomeRow(i, 'centrixAmount', parseFloat(e.target.value) || 0)}
                    className="w-20 text-xs text-right border border-blue-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder="0.00"
                  />
                </td>
                <td className="py-1.5 px-2">
                  <input
                    type="number"
                    min="0"
                    value={row.verifiedAmount || ''}
                    onChange={(e) => updateIncomeRow(i, 'verifiedAmount', parseFloat(e.target.value) || 0)}
                    className="w-20 text-xs text-right border border-purple-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
                    placeholder="0.00"
                  />
                </td>
                <td className="py-1.5 px-2">
                  <input
                    type="number"
                    value={row.adjustment || ''}
                    onChange={(e) => updateIncomeRow(i, 'adjustment', parseFloat(e.target.value) || 0)}
                    className="w-20 text-xs text-right border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    placeholder="0.00"
                  />
                </td>
                <td className="py-1.5 pl-2 text-right font-semibold text-green-700 bg-green-50">
                  {fmt(row.finalAmount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300">
              <td colSpan={5} className="py-2 pr-2 text-right font-bold text-gray-900 text-sm">Total Verified Income</td>
              <td className="py-2 pl-2 text-right font-bold text-green-700 text-sm bg-green-50">{fmt(totalIncome)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Section 3: Expense Verification ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 overflow-x-auto">
        <h2 className="font-semibold text-gray-900 mb-1">3. Expense Verification (Fortnightly NZD)</h2>
        <p className="text-xs text-gray-500 mb-4">
          Household multiplier: <strong>{hMult}x</strong> ({householdType}).
          Final = max(Centrix, Benchmark × multiplier, Adjustment).
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-2 pr-2 text-left font-medium text-gray-500 min-w-[150px]">Category</th>
              <th className="py-2 px-2 text-right font-medium text-gray-500">Stated</th>
              <th className="py-2 px-2 text-right font-medium text-blue-600">Centrix</th>
              <th className="py-2 px-2 text-right font-medium text-orange-600">Benchmark</th>
              <th className="py-2 px-2 text-right font-medium text-gray-500">Adjustment</th>
              <th className="py-2 pl-2 text-right font-medium text-red-700 bg-red-50 rounded">Final</th>
            </tr>
          </thead>
          <tbody>
            {expenseRows.map((row, i) => {
              const benchmarkOverride = row.benchmarkAmount > row.centrixAmount && row.benchmarkAmount > row.statedAmount;
              return (
                <tr key={row.category} className={`border-b border-gray-50 ${benchmarkOverride ? 'bg-orange-50' : ''}`}>
                  <td className="py-1.5 pr-2 text-gray-700 font-medium">
                    {row.category}
                    {benchmarkOverride && <span className="ml-1 text-orange-500 text-xs">⚠ Benchmark used</span>}
                  </td>
                  <td className="py-1.5 px-2 text-right text-gray-400">{fmt(row.statedAmount)}</td>
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      min="0"
                      value={row.centrixAmount || ''}
                      onChange={(e) => updateExpenseRow(i, 'centrixAmount', parseFloat(e.target.value) || 0)}
                      className="w-20 text-xs text-right border border-blue-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="py-1.5 px-2 text-right text-orange-700 font-medium">
                    {fmt(row.benchmarkAmount)}
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      min="0"
                      value={row.adjustment || ''}
                      onChange={(e) => updateExpenseRow(i, 'adjustment', parseFloat(e.target.value) || 0)}
                      className="w-20 text-xs text-right border border-gray-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="py-1.5 pl-2 text-right font-semibold text-red-700 bg-red-50">
                    {fmt(row.finalAmount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300">
              <td colSpan={5} className="py-2 pr-2 text-right font-bold text-gray-900 text-sm">Total Expenses</td>
              <td className="py-2 pl-2 text-right font-bold text-red-700 text-sm bg-red-50">{fmt(totalExpenses)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Section 4: Affordability Summary ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">4. Affordability Calculation</h2>
        <div className="space-y-3 max-w-md">
          {[
            { label: 'Total Verified Income', value: totalIncome, color: 'text-green-700' },
            { label: 'Total Expenses', value: totalExpenses, color: 'text-red-700' },
            { label: 'Net Disposable Income', value: netDisposable, color: netDisposable > 0 ? 'text-gray-900' : 'text-red-700' },
            { label: `Loan Fortnightly Payment (${fmt(loanAmount)} × 1.047 ÷ 4)`, value: loanPayment, color: 'text-gray-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between py-1 border-b border-gray-100">
              <span className="text-sm text-gray-600">{label}</span>
              <span className={`text-sm font-semibold ${color}`}>{fmt(value)}</span>
            </div>
          ))}
          <div className={`flex items-center justify-between py-3 rounded-xl px-4 mt-2 ${surplusColor}`}>
            <span className="font-bold text-sm">Final Available Surplus</span>
            <div className="text-right">
              <div className="font-bold text-base">{fmt(surplus)}</div>
              <div className="text-xs mt-0.5">{surplusRating}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 5: Recommendation ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">5. Recommendation</h2>
        {hardDeclines.length > 0 ? (
          <p className="text-sm text-red-700 font-medium">Hard decline conditions are met. Recommendation is forced to Decline.</p>
        ) : (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setRecommendation('proceed')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition-colors ${
                recommendation === 'proceed'
                  ? 'bg-green-600 text-white border-green-600'
                  : 'border-green-600 text-green-700 hover:bg-green-50'
              }`}
            >
              ✓ Proceed to Credit Check
            </button>
            <button
              type="button"
              onClick={() => setRecommendation('decline')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition-colors ${
                recommendation === 'decline'
                  ? 'bg-red-600 text-white border-red-600'
                  : 'border-red-600 text-red-700 hover:bg-red-50'
              }`}
            >
              ✗ Decline
            </button>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex gap-4">
        <button
          onClick={submit}
          disabled={loading || !checklist.centrixReportNumber || !checklist.firstTransactionDate}
          className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Submitting…' : 'Submit Assessment (Immutable)'}
        </button>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Once submitted, this assessment is immutable. A new version will be created if you need to revise it.
      </p>
    </div>
  );
}
