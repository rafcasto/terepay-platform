'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConsoleIcon from '@/components/lender/ConsoleIcon';
import { INPUT_CLASS } from './Card';

export type DecisionMode = 'approve' | 'decline' | 'request';

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

const REQUESTABLE_DOCS = [
  'Photo ID (passport or driver licence)',
  'Bank statements (last 3 months)',
  'Payslips (last 3 months)',
  'Proof of address',
  'Visa / residency document',
  'Evidence of other income (WINZ etc.)',
];

const MIN_APPROVED = 200;

const fmtNzd = (n: number) =>
  new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 }).format(n);

export default function DecisionModal({
  mode,
  applicationId,
  requestedAmount,
  assessedAmount,
  onClose,
}: {
  mode: DecisionMode;
  applicationId: string;
  requestedAmount: number;
  assessedAmount?: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [rationale, setRationale] = useState('');
  const [reasons, setReasons] = useState<string[]>([]);
  const [requestedDocs, setRequestedDocs] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [amount, setAmount] = useState<number>(Math.min(assessedAmount ?? requestedAmount, requestedAmount));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = mode === 'approve' ? 'Approve application' : mode === 'decline' ? 'Decline application' : 'Request more documents';

  const amountInvalid =
    mode === 'approve' && (!Number.isFinite(amount) || amount < MIN_APPROVED || amount > requestedAmount);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const canSubmit =
    mode === 'approve'
      ? rationale.trim().length >= 10 && !amountInvalid
      : mode === 'decline'
        ? rationale.trim().length >= 10 && reasons.length > 0
        : requestedDocs.length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      let res: Response;
      if (mode === 'request') {
        res = await fetch(`/api/applications/${applicationId}/request-documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requiredDocuments: requestedDocs, message: message || undefined }),
        });
      } else {
        res = await fetch(`/api/applications/${applicationId}/decision`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: mode === 'approve' ? 'approve' : 'decline',
            rationale,
            declineReasons: mode === 'decline' ? reasons : undefined,
            approvedAmount: mode === 'approve' ? amount : undefined,
          }),
        });
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error?.message ?? 'Request failed');
      }
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(15,29,46,0.45)] p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-[var(--radius-xl)] border border-[var(--border-default)] bg-white p-5 shadow-[var(--shadow-lg)] sm:rounded-[var(--radius-xl)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-[var(--text-strong)]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-body)]"
            aria-label="Close"
          >
            <ConsoleIcon name="x" size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-[var(--radius-md)] border border-[var(--danger-700)]/25 bg-[var(--danger-50)] px-3 py-2 text-sm text-[var(--danger-700)]">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {mode === 'approve' && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                Approved amount (NZD)
              </label>
              <input
                type="number"
                value={Number.isFinite(amount) ? amount : ''}
                onChange={(e) => setAmount(e.target.valueAsNumber)}
                min={MIN_APPROVED}
                max={requestedAmount}
                step={50}
                className={INPUT_CLASS}
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Requested: {fmtNzd(requestedAmount)} · Allowed: {fmtNzd(MIN_APPROVED)} – {fmtNzd(requestedAmount)}
              </p>
              {amountInvalid && (
                <p className="mt-1 text-xs text-[var(--danger-700)]">
                  Amount must be between {fmtNzd(MIN_APPROVED)} and {fmtNzd(requestedAmount)}.
                </p>
              )}
            </div>
          )}

          {mode === 'decline' && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                Decline reasons (select all that apply)
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {STANDARD_DECLINE_REASONS.map((r) => (
                  <label key={r} className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-body)]">
                    <input
                      type="checkbox"
                      checked={reasons.includes(r)}
                      onChange={() => toggle(reasons, setReasons, r)}
                      className="rounded border-[var(--border-default)] text-[var(--orange-500)] focus:ring-[var(--orange-400)]"
                    />
                    {r}
                  </label>
                ))}
              </div>
            </div>
          )}

          {mode === 'request' && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                Documents to request
              </p>
              <div className="grid grid-cols-1 gap-2">
                {REQUESTABLE_DOCS.map((r) => (
                  <label key={r} className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-body)]">
                    <input
                      type="checkbox"
                      checked={requestedDocs.includes(r)}
                      onChange={() => toggle(requestedDocs, setRequestedDocs, r)}
                      className="rounded border-[var(--border-default)] text-[var(--orange-500)] focus:ring-[var(--orange-400)]"
                    />
                    {r}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                The application moves to &ldquo;Waiting for docs&rdquo; and the applicant sees this list on their tracker.
              </p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
              {mode === 'request' ? 'Message to applicant (optional)' : 'Rationale'}
            </label>
            <textarea
              value={mode === 'request' ? message : rationale}
              onChange={(e) => (mode === 'request' ? setMessage(e.target.value) : setRationale(e.target.value))}
              rows={4}
              placeholder={
                mode === 'request'
                  ? 'Let the applicant know what you need and why…'
                  : `Document the reason for ${mode === 'approve' ? 'approving' : 'declining'}…`
              }
              className={`${INPUT_CLASS} resize-none`}
            />
            {mode !== 'request' && rationale.trim().length > 0 && rationale.trim().length < 10 && (
              <p className="mt-1 text-xs text-[var(--danger-700)]">Rationale must be at least 10 characters.</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-[10px] px-4 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-body)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={loading || !canSubmit}
            className={`rounded-[10px] px-4 py-2 text-sm font-semibold transition-[filter] hover:brightness-110 disabled:opacity-50 ${
              mode === 'decline'
                ? 'bg-[var(--danger-700)] text-white'
                : mode === 'approve'
                  ? 'bg-[var(--success-700)] text-white'
                  : 'bg-[var(--orange-500)] text-[var(--ink-900)]'
            }`}
          >
            {loading
              ? 'Working…'
              : mode === 'approve'
                ? 'Confirm approval'
                : mode === 'decline'
                  ? 'Confirm decline'
                  : 'Send request'}
          </button>
        </div>
      </div>
    </div>
  );
}
