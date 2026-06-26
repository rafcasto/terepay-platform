'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STANDARD_DECLINE_REASONS = [
  'Insufficient income',
  'High existing debt load',
  'Visa expires before loan completion',
  'Less than 90 days transaction data',
  'Income could not be verified',
  'Negative affordability surplus',
  'Failed credit check',
  'Recent payment defaults',
  'Loan purpose not permitted',
  'Incomplete application/documents',
  'AML/CFT concerns',
  'Other',
];

const MIN_APPROVED_AMOUNT = 200;

const fmtNzd = (n: number) =>
  new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(n);

const inputClass =
  'w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white px-3 py-2 text-sm text-[var(--text-body)] focus:border-[var(--orange-400)] focus:outline-none focus:ring-2 focus:ring-[var(--orange-400)]';

const labelClass =
  'mb-1 block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]';

export default function DecisionForm({
  applicationId,
  affordabilityStatus,
  requestedAmount,
  assessedAmount,
}: {
  applicationId: string;
  affordabilityStatus: string;
  requestedAmount: number;
  assessedAmount?: number;
}) {
  const router = useRouter();
  const affordabilityComplete = affordabilityStatus === 'complete';
  // Prefill from the lender's assessed amount (from affordability), but never
  // above the requested amount — approving more than requested is not allowed.
  const defaultApprovedAmount = Math.min(assessedAmount ?? requestedAmount, requestedAmount);
  const [action, setAction] = useState<'approve' | 'decline' | null>(null);
  const [rationale, setRationale] = useState('');
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [approvedAmount, setApprovedAmount] = useState<number>(defaultApprovedAmount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approvedAmountInvalid =
    action === 'approve' &&
    (!Number.isFinite(approvedAmount) ||
      approvedAmount < MIN_APPROVED_AMOUNT ||
      approvedAmount > requestedAmount);

  const toggleReason = (r: string) => {
    setSelectedReasons((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  };

  const submit = async () => {
    if (!action || !rationale.trim()) return;
    if (approvedAmountInvalid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          rationale,
          declineReasons: action === 'decline' ? selectedReasons : undefined,
          approvedAmount: action === 'approve' ? approvedAmount : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? 'Decision failed');
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {!affordabilityComplete && (
        <div className="rounded-[var(--radius-md)] border border-[var(--warning-700)]/20 bg-[var(--warning-50)] px-4 py-3 text-sm text-[var(--warning-700)]">
          Affordability assessment must be completed before making a decision.
        </div>
      )}

      {error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--danger-700)]/25 bg-[var(--danger-50)] px-4 py-3 text-sm text-[var(--danger-700)]">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => setAction('approve')}
          className={`flex-1 rounded-[10px] border px-4 py-2 text-sm font-semibold transition-colors ${
            action === 'approve'
              ? 'border-[var(--success-700)] bg-[var(--success-700)] text-white'
              : 'border-[var(--success-700)]/40 text-[var(--success-700)] hover:bg-[var(--success-50)]'
          }`}
        >
          Approve
        </button>
        <button
          onClick={() => setAction('decline')}
          className={`flex-1 rounded-[10px] border px-4 py-2 text-sm font-semibold transition-colors ${
            action === 'decline'
              ? 'border-[var(--danger-700)] bg-[var(--danger-700)] text-white'
              : 'border-[var(--danger-700)]/40 text-[var(--danger-700)] hover:bg-[var(--danger-50)]'
          }`}
        >
          Decline
        </button>
      </div>

      {action === 'approve' && (
        <div>
          <label className={labelClass}>
            Approved amount (NZD) <span className="text-[var(--danger-700)]">*</span>
          </label>
          <input
            type="number"
            value={Number.isFinite(approvedAmount) ? approvedAmount : ''}
            onChange={(e) => setApprovedAmount(e.target.valueAsNumber)}
            min={MIN_APPROVED_AMOUNT}
            max={requestedAmount}
            step={50}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Requested: {fmtNzd(requestedAmount)}
            {typeof assessedAmount === 'number' && assessedAmount !== requestedAmount && (
              <> · Assessed: {fmtNzd(assessedAmount)}</>
            )}
            {' '}· Allowed range: {fmtNzd(MIN_APPROVED_AMOUNT)} – {fmtNzd(requestedAmount)}
          </p>
          {Number.isFinite(approvedAmount) && approvedAmount < requestedAmount && approvedAmount >= MIN_APPROVED_AMOUNT && (
            <p className="mt-1 text-xs text-[var(--warning-700)]">
              Approving {fmtNzd(approvedAmount)} of {fmtNzd(requestedAmount)} requested — the applicant will need to accept the revised offer.
            </p>
          )}
          {approvedAmountInvalid && (
            <p className="mt-1 text-xs text-[var(--danger-700)]">
              Amount must be between {fmtNzd(MIN_APPROVED_AMOUNT)} and {fmtNzd(requestedAmount)}.
            </p>
          )}
        </div>
      )}

      {action === 'decline' && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">Decline Reasons (select all that apply)</p>
          <div className="grid grid-cols-2 gap-2">
            {STANDARD_DECLINE_REASONS.map((r) => (
              <label key={r} className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-body)]">
                <input
                  type="checkbox"
                  checked={selectedReasons.includes(r)}
                  onChange={() => toggleReason(r)}
                  className="rounded border-[var(--border-default)] text-[var(--orange-500)] focus:ring-[var(--orange-400)]"
                />
                {r}
              </label>
            ))}
          </div>
        </div>
      )}

      {action && (
        <>
          <div>
            <label className={labelClass}>
              {action === 'approve' ? 'Approval' : 'Decline'} Rationale <span className="text-[var(--danger-700)]">*</span>
            </label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder={`Document the reason for ${action === 'approve' ? 'approving' : 'declining'} this application…`}
              rows={4}
              className={`${inputClass} resize-none`}
            />
          </div>

          <button
            onClick={submit}
            disabled={loading || !rationale.trim() || !affordabilityComplete || approvedAmountInvalid || (action === 'decline' && selectedReasons.length === 0)}
            className={`w-full rounded-[10px] px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
              action === 'approve'
                ? 'bg-[var(--success-700)] hover:brightness-110'
                : 'bg-[var(--danger-700)] hover:brightness-110'
            }`}
          >
            {loading ? 'Processing…' : `Confirm ${action === 'approve' ? 'Approval' : 'Decline'}`}
          </button>
        </>
      )}
    </div>
  );
}
