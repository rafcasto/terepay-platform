'use client';

import { useState } from 'react';

interface BenchmarkEntry {
  benchmarkId: string;
  categoryName: string;
  householdType: string;
  fortnightlyAmount: number;
  rangeLow: number;
  rangeHigh: number;
  source: string;
  effectiveFrom: string;
  isActive: boolean;
}

const CATEGORIES = [
  'Accommodation/Rent', 'Food & Groceries', 'Utilities', 'Personal/Clothing',
  'Transport', 'Medical', 'Childcare', 'Health Insurance', 'Car Insurance',
  'Rates', 'Education', 'Child Support', 'Remittances', 'Restaurants/Takeaways',
  'Entertainment', 'Travel', 'Subscriptions', 'Home Improvement',
  'Cash Withdrawals', 'Buy Now Pay Later', 'Existing Debt Repayments', 'Other',
];

const HOUSEHOLD_TYPES = ['single', 'single_children', 'couple', 'couple_children'];

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', minimumFractionDigits: 2 }).format(n);

const EMPTY_FORM = {
  categoryName: '',
  householdType: 'single',
  fortnightlyAmount: '',
  rangeLow: '',
  rangeHigh: '',
  source: '',
  effectiveFrom: new Date().toISOString().slice(0, 10),
};

export default function BenchmarksClient({
  initialBenchmarks,
}: {
  initialBenchmarks: BenchmarkEntry[];
}) {
  const [benchmarks, setBenchmarks] = useState<BenchmarkEntry[]>(initialBenchmarks);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<BenchmarkEntry | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterHousehold, setFilterHousehold] = useState('');

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setShowForm(false);
    setError(null);
  };

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setShowForm(true);
    setError(null);
  };

  const openEdit = (b: BenchmarkEntry) => {
    setForm({
      categoryName: b.categoryName,
      householdType: b.householdType,
      fortnightlyAmount: String(b.fortnightlyAmount),
      rangeLow: String(b.rangeLow),
      rangeHigh: String(b.rangeHigh),
      source: b.source,
      effectiveFrom: new Date().toISOString().slice(0, 10),
    });
    setEditTarget(b);
    setShowForm(true);
    setError(null);
  };

  const submitForm = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        categoryName: form.categoryName,
        householdType: form.householdType,
        fortnightlyAmount: parseFloat(form.fortnightlyAmount),
        rangeLow: parseFloat(form.rangeLow) || 0,
        rangeHigh: parseFloat(form.rangeHigh) || 0,
        source: form.source,
        effectiveFrom: form.effectiveFrom,
      };

      let res: Response;
      if (editTarget) {
        // PATCH existing → creates new version
        res = await fetch(`/api/benchmarks/${editTarget.benchmarkId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/benchmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'Request failed');
      }

      const data = await res.json();
      const newEntry: BenchmarkEntry = editTarget
        ? data.newBenchmark
        : data.benchmark;

      if (editTarget) {
        // Replace old with new version
        setBenchmarks((prev) =>
          prev.map((b) => (b.benchmarkId === editTarget.benchmarkId ? { ...b, isActive: false } : b))
            .concat(newEntry),
        );
      } else {
        setBenchmarks((prev) => [...prev, newEntry]);
      }

      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const deactivate = async (entry: BenchmarkEntry) => {
    if (!confirm(`Deactivate benchmark "${entry.categoryName}" (${entry.householdType})?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/benchmarks/${entry.benchmarkId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to deactivate');
      setBenchmarks((prev) => prev.map((b) => b.benchmarkId === entry.benchmarkId ? { ...b, isActive: false } : b));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to deactivate');
    } finally {
      setLoading(false);
    }
  };

  // Filter
  const filtered = benchmarks.filter((b) => {
    if (filterCategory && b.categoryName !== filterCategory) return false;
    if (filterHousehold && b.householdType !== filterHousehold) return false;
    return true;
  });

  const active = filtered.filter((b) => b.isActive);
  const inactive = filtered.filter((b) => !b.isActive);

  return (
    <div className="space-y-6">
      {/* Filters + Add */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select
          value={filterHousehold}
          onChange={(e) => setFilterHousehold(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">All household types</option>
          {HOUSEHOLD_TYPES.map((h) => <option key={h} value={h}>{h.replace('_', ' + ')}</option>)}
        </select>
        <button
          onClick={openNew}
          className="ml-auto py-1.5 px-4 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + Add Benchmark
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-900 mb-4">
            {editTarget ? `Update: ${editTarget.categoryName} (${editTarget.householdType})` : 'New Benchmark Entry'}
          </h3>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
              <select
                value={form.categoryName}
                onChange={(e) => setForm((f) => ({ ...f, categoryName: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select…</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Household Type *</label>
              <select
                value={form.householdType}
                onChange={(e) => setForm((f) => ({ ...f, householdType: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {HOUSEHOLD_TYPES.map((h) => <option key={h} value={h}>{h.replace('_', ' + ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fortnightly Amount (NZD) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.fortnightlyAmount}
                onChange={(e) => setForm((f) => ({ ...f, fortnightlyAmount: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Range Low (NZD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.rangeLow}
                onChange={(e) => setForm((f) => ({ ...f, rangeLow: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Range High (NZD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.rangeHigh}
                onChange={(e) => setForm((f) => ({ ...f, rangeHigh: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Source *</label>
              <input
                type="text"
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. MSD HES Survey 2024"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Effective From *</label>
              <input
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={submitForm}
              disabled={loading || !form.categoryName || !form.fortnightlyAmount || !form.source}
              className="py-2 px-5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving…' : editTarget ? 'Save New Version' : 'Create Benchmark'}
            </button>
            <button
              onClick={resetForm}
              className="py-2 px-4 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active Benchmarks */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Active Benchmarks</h2>
          <span className="text-xs text-gray-400">{active.length} entries</span>
        </div>
        {active.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">No active benchmarks. Add one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="py-2.5 px-4 text-left font-medium text-gray-500">Category</th>
                  <th className="py-2.5 px-4 text-left font-medium text-gray-500">Household</th>
                  <th className="py-2.5 px-4 text-right font-medium text-gray-500">Fortnightly</th>
                  <th className="py-2.5 px-4 text-right font-medium text-gray-500">Range</th>
                  <th className="py-2.5 px-4 text-left font-medium text-gray-500">Source</th>
                  <th className="py-2.5 px-4 text-left font-medium text-gray-500">Effective</th>
                  <th className="py-2.5 px-4 text-right font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {active.map((b) => (
                  <tr key={b.benchmarkId} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2.5 px-4 font-medium text-gray-800">{b.categoryName}</td>
                    <td className="py-2.5 px-4 text-gray-600 capitalize">{b.householdType.replace('_', ' + ')}</td>
                    <td className="py-2.5 px-4 text-right font-semibold text-gray-900">{fmt(b.fortnightlyAmount)}</td>
                    <td className="py-2.5 px-4 text-right text-gray-500">
                      {b.rangeLow || b.rangeHigh ? `${fmt(b.rangeLow)} – ${fmt(b.rangeHigh)}` : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-gray-500">{b.source || '—'}</td>
                    <td className="py-2.5 px-4 text-gray-500">{b.effectiveFrom}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => openEdit(b)}
                        className="text-indigo-600 hover:underline mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deactivate(b)}
                        className="text-red-500 hover:underline"
                      >
                        Deactivate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inactive / Version History */}
      {inactive.length > 0 && (
        <details className="bg-white rounded-xl border border-gray-200">
          <summary className="px-5 py-4 text-sm font-medium text-gray-600 cursor-pointer select-none">
            Version History / Inactive ({inactive.length})
          </summary>
          <div className="overflow-x-auto border-t border-gray-100">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50">
                  <th className="py-2.5 px-4 text-left font-medium text-gray-500">Category</th>
                  <th className="py-2.5 px-4 text-left font-medium text-gray-500">Household</th>
                  <th className="py-2.5 px-4 text-right font-medium text-gray-500">Fortnightly</th>
                  <th className="py-2.5 px-4 text-left font-medium text-gray-500">Source</th>
                  <th className="py-2.5 px-4 text-left font-medium text-gray-500">Effective From</th>
                </tr>
              </thead>
              <tbody>
                {inactive.map((b) => (
                  <tr key={b.benchmarkId} className="border-b border-gray-50 opacity-60">
                    <td className="py-2 px-4 text-gray-700 line-through">{b.categoryName}</td>
                    <td className="py-2 px-4 text-gray-500 capitalize">{b.householdType.replace('_', ' + ')}</td>
                    <td className="py-2 px-4 text-right text-gray-500">{fmt(b.fortnightlyAmount)}</td>
                    <td className="py-2 px-4 text-gray-400">{b.source || '—'}</td>
                    <td className="py-2 px-4 text-gray-400">{b.effectiveFrom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
