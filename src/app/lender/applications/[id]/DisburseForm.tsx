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

  const errorBox = error && (
    <div className="rounded-[var(--radius-md)] border border-[var(--danger-700)]/25 bg-[var(--danger-50)] px-3 py-2 text-sm text-[var(--danger-700)]">
      {error}
    </div>
  );

  if (!open) {
    if (consentGated) {
      const failedConsent =
        consentStatus === 'failed' ||
        consentStatus === 'expired' ||
        consentStatus === 'cancelled';
      return (
        <div className="space-y-3">
          <div className="rounded-[var(--radius-md)] border border-[var(--warning-700)]/30 bg-[var(--warning-50)] p-4 text-sm text-[var(--warning-700)]">
            <p className="mb-1 font-semibold">Bank authorisation required</p>
            <p>
              The applicant has not completed their Qippay SetPay mandate.
              Disbursement is locked until the mandate is active.
            </p>
            <p className="mt-2 text-xs">
              Mandate status: <span className="font-mono">{consentStatus ?? 'not_started'}</span>
            </p>
          </div>
          <button
            onClick={refreshConsent}
            disabled={refreshing}
            className="w-full rounded-[10px] border border-[var(--warning-700)]/40 bg-white px-4 py-2 text-sm font-semibold text-[var(--warning-700)] transition-colors hover:bg-[var(--warning-50)] disabled:opacity-50"
          >
            {refreshing ? 'Refreshing…' : 'Refresh status'}
          </button>
          {errorBox}
          {failedConsent && (
            <p className="text-xs text-[var(--text-muted)]">
              The applicant can retry from their application page.
            </p>
          )}
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {consentStatus === 'active' && (
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--success-700)]/25 bg-[var(--success-50)] px-3 py-2 text-xs">
            <span className="font-semibold text-[var(--success-700)]">
              Bank authorisation complete
            </span>
            {consentActivatedAt && consentActivatedAt !== '—' && (
              <span className="text-[var(--success-700)]">{consentActivatedAt}</span>
            )}
          </div>
        )}
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-[10px] bg-[var(--success-700)] px-4 py-2.5 text-sm font-semibold text-white transition-[filter] hover:brightness-110"
        >
          Mark as Disbursed
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--success-700)]/25 bg-[var(--success-50)] p-4">
      <h3 className="font-display text-sm font-bold text-[var(--success-700)]">Confirm Disbursement</h3>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-[var(--text-muted)]">Approved</dt>
        <dd className="text-right font-mono font-semibold tabular-nums text-[var(--text-strong)]">{fmt(approvedAmount)}</dd>
        <dt className="text-[var(--text-muted)]">Application fee</dt>
        <dd className="text-right font-mono font-semibold tabular-nums text-[var(--text-strong)]">- {fmt(applicationFee)}</dd>
        <dt className="mt-1 border-t border-[var(--success-700)]/20 pt-1.5 text-[var(--text-muted)]">Default disbursement</dt>
        <dd className="mt-1 border-t border-[var(--success-700)]/20 pt-1.5 text-right font-mono font-semibold tabular-nums text-[var(--text-strong)]">
          {fmt(defaultAmount)}
        </dd>
      </dl>

      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
          Disbursement Amount
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--text-muted)]">$</span>
          <input
            type="number"
            min={0}
            max={approvedAmount}
            step={0.01}
            value={Number.isFinite(amount) ? amount : ''}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-40 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white px-3 py-2 text-sm text-[var(--text-body)] focus:border-[var(--orange-400)] focus:outline-none focus:ring-2 focus:ring-[var(--orange-400)]"
          />
          {isOverride && !overCap && !tooLow && (
            <span className="rounded-full border border-[var(--warning-700)]/25 bg-[var(--warning-50)] px-2.5 py-1 text-xs font-semibold text-[var(--warning-700)]">
              Override
            </span>
          )}
        </div>
        {overCap && (
          <p className="mt-1 text-xs text-[var(--danger-700)]">
            Cannot exceed the approved amount of {fmt(approvedAmount)}.
          </p>
        )}
        {tooLow && (
          <p className="mt-1 text-xs text-[var(--danger-700)]">Disbursement amount must be greater than $0.</p>
        )}
      </div>

      {errorBox}

      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={loading || overCap || tooLow}
          className="rounded-[10px] bg-[var(--success-700)] px-4 py-2 text-sm font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-50"
        >
          {loading ? 'Disbursing…' : `Confirm Disbursement of ${fmt(amount)}`}
        </button>
        <button
          onClick={() => setOpen(false)}
          disabled={loading}
          className="px-4 py-2 text-sm text-[var(--text-muted)] hover:underline disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
