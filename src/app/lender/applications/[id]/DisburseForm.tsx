'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(n);

type Props = {
  applicationId: string;
  approvedAmount: number;
  applicationFee: number;
};

export default function DisburseForm({ applicationId, approvedAmount, applicationFee }: Props) {
  const router = useRouter();
  const defaultAmount = Math.max(0, approvedAmount - applicationFee);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overCap = amount > approvedAmount;
  const tooLow = !(amount > 0);
  const isOverride = amount !== defaultAmount;

  const submit = async () => {
    if (overCap || tooLow) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/disburse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isOverride ? { disbursedAmount: amount } : {}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? 'Disbursement failed');
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700"
      >
        Mark as Disbursed
      </button>
    );
  }

  return (
    <div className="space-y-3 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-emerald-900">Confirm Disbursement</h3>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-gray-600">Approved</dt>
        <dd className="text-right font-medium text-gray-900">{fmt(approvedAmount)}</dd>
        <dt className="text-gray-600">Application fee</dt>
        <dd className="text-right font-medium text-gray-900">- {fmt(applicationFee)}</dd>
        <dt className="text-gray-600 border-t border-emerald-200 pt-1.5 mt-1">Default disbursement</dt>
        <dd className="text-right font-medium text-gray-900 border-t border-emerald-200 pt-1.5 mt-1">
          {fmt(defaultAmount)}
        </dd>
      </dl>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">
          Disbursement Amount
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">$</span>
          <input
            type="number"
            min={0}
            max={approvedAmount}
            step={0.01}
            value={Number.isFinite(amount) ? amount : ''}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {isOverride && !overCap && !tooLow && (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
              Override
            </span>
          )}
        </div>
        {overCap && (
          <p className="mt-1 text-xs text-red-600">
            Cannot exceed the approved amount of {fmt(approvedAmount)}.
          </p>
        )}
        {tooLow && (
          <p className="mt-1 text-xs text-red-600">Disbursement amount must be greater than $0.</p>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={loading || overCap || tooLow}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? 'Disbursing…' : `Confirm Disbursement of ${fmt(amount)}`}
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={loading}
          className="px-4 py-2 text-sm text-gray-600 hover:underline disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
