'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(n);

type Props = {
  applicationId: string;
  approvedAmount: number;
  applicationFee: number;
  /** Status of the Qippay SetPay mandate. Undefined for legacy `loan_accepted` applications that pre-date the consent gate. */
  consentStatus?: string;
  consentActivatedAt?: string;
};

export default function DisburseForm({
  applicationId,
  approvedAmount,
  applicationFee,
  consentStatus,
  consentActivatedAt,
}: Props) {
  const router = useRouter();
  const defaultAmount = Math.max(0, approvedAmount - applicationFee);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lender disburse is blocked until consent is active (legacy
  // `loan_accepted` applications have undefined consentStatus and skip the gate).
  const consentGated = consentStatus !== undefined && consentStatus !== 'active';

  const refreshConsent = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/consent/status`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? 'Failed to refresh consent status');
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setRefreshing(false);
    }
  };

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
    if (consentGated) {
      const failedConsent =
        consentStatus === 'failed' ||
        consentStatus === 'expired' ||
        consentStatus === 'cancelled';
      return (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">Bank authorisation required</p>
            <p>
              The applicant has not completed their Qippay SetPay mandate.
              Disbursement is locked until the mandate is active.
            </p>
            <p className="mt-2 text-xs text-amber-700">
              Mandate status: <span className="font-mono">{consentStatus ?? 'not_started'}</span>
            </p>
          </div>
          <button
            onClick={refreshConsent}
            disabled={refreshing}
            className="w-full px-4 py-2 bg-white border border-amber-400 text-amber-800 rounded-lg font-medium text-sm hover:bg-amber-50 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing…' : 'Refresh status'}
          </button>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {failedConsent && (
            <p className="text-xs text-gray-500">
              The applicant can retry from their application page.
            </p>
          )}
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {consentStatus === 'active' && (
          <div className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs">
            <span className="font-medium text-emerald-800">
              ✓ Bank authorisation complete
            </span>
            {consentActivatedAt && consentActivatedAt !== '—' && (
              <span className="text-emerald-700">{consentActivatedAt}</span>
            )}
          </div>
        )}
        <button
          onClick={() => setOpen(true)}
          className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700"
        >
          Mark as Disbursed
        </button>
      </div>
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
