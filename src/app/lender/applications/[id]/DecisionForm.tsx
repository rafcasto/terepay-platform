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
  const defaultApprovedAmount = assessedAmount ?? requestedAmount;
  const [action, setAction] = useState<'approve' | 'decline' | null>(null);
  const [rationale, setRationale] = useState('');
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [approvedAmount, setApprovedAmount] = useState<number>(defaultApprovedAmount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleReason = (r: string) => {
    setSelectedReasons((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  };

  const approvedOutOfRange = approvedAmount < 200 || approvedAmount > 2000;

  const submit = async () => {
    if (!action || !rationale.trim()) return;
    if (action === 'approve' && approvedOutOfRange) return;
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
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          ⚠ Affordability assessment must be completed before making a decision.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => setAction('approve')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition-colors ${
            action === 'approve'
              ? 'bg-green-600 text-white border-green-600'
              : 'border-green-600 text-green-700 hover:bg-green-50'
          }`}
        >
          ✓ Approve
        </button>
        <button
          onClick={() => setAction('decline')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition-colors ${
            action === 'decline'
              ? 'bg-red-600 text-white border-red-600'
              : 'border-red-600 text-red-700 hover:bg-red-50'
          }`}
        >
          ✗ Decline
        </button>
      </div>

      {action === 'approve' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">
            Approved Amount <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">$</span>
            <input
              type="number"
              min={200}
              max={2000}
              step={1}
              value={Number.isFinite(approvedAmount) ? approvedAmount : ''}
              onChange={(e) => setApprovedAmount(Number(e.target.value))}
              className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <span className="text-xs text-gray-500">
              Requested {new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(requestedAmount)}
              {typeof assessedAmount === 'number' && assessedAmount !== requestedAmount && (
                <> · Assessed {new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(assessedAmount)}</>
              )}
            </span>
          </div>
          {approvedOutOfRange && (
            <p className="mt-1 text-xs text-red-600">Amount must be between $200 and $2,000.</p>
          )}
        </div>
      )}

      {action === 'decline' && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Decline Reasons (select all that apply)</p>
          <div className="grid grid-cols-2 gap-2">
            {STANDARD_DECLINE_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedReasons.includes(r)}
                  onChange={() => toggleReason(r)}
                  className="rounded border-gray-300 text-indigo-600"
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
            <label className="block text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">
              {action === 'approve' ? 'Approval' : 'Decline'} Rationale <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder={`Document the reason for ${action === 'approve' ? 'approving' : 'declining'} this application…`}
              rows={4}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <button
            onClick={submit}
            disabled={
              loading ||
              !rationale.trim() ||
              !affordabilityComplete ||
              (action === 'decline' && selectedReasons.length === 0) ||
              (action === 'approve' && approvedOutOfRange)
            }
            className={`w-full py-2 px-4 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
              action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {loading ? 'Processing…' : `Confirm ${action === 'approve' ? 'Approval' : 'Decline'}`}
          </button>
        </>
      )}
    </div>
  );
}
