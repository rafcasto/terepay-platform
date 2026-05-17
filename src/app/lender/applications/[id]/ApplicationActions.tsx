'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DisburseForm from './DisburseForm';

type PaymentConsentSummary = {
  status: string;
  mandateId?: string;
  activatedAt?: string;
};

type Props = {
  applicationId: string;
  status: string;
  assignedLenderId?: string;
  currentUserId?: string;
  approvedAmount?: number;
  applicationFee?: number;
  paymentConsent?: PaymentConsentSummary;
};

export default function ApplicationActions({
  applicationId,
  status,
  approvedAmount,
  applicationFee,
  paymentConsent,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = async (endpoint: string, body?: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? 'Request failed');
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
      )}

      {status === 'pending_review' && (
        <button
          onClick={() => post('claim')}
          disabled={loading}
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Claiming…' : 'Claim Application'}
        </button>
      )}

      {(status === 'loan_accepted' || status === 'awaiting_payment_consent') &&
        typeof approvedAmount === 'number' && (
          <DisburseForm
            applicationId={applicationId}
            approvedAmount={approvedAmount}
            applicationFee={applicationFee ?? 0}
            consentStatus={
              status === 'awaiting_payment_consent'
                ? (paymentConsent?.status ?? 'not_started')
                : undefined
            }
            consentActivatedAt={paymentConsent?.activatedAt}
          />
        )}
    </div>
  );
}
