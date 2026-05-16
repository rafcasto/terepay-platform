'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PaymentConsentStatus } from '@/types/application';

export type PaymentConsentCardProps = {
  status: PaymentConsentStatus;
  hostedUrl?: string;
  installments?: Array<{ dueDate: string; amountCents: number }>;
};

type Props = {
  applicationId: string;
  paymentConsent?: PaymentConsentCardProps;
};

const fmtNzd = (cents?: number) =>
  typeof cents === 'number'
    ? new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(cents / 100)
    : '—';

export default function InitiatePaymentConsentCard({
  applicationId,
  paymentConsent,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = paymentConsent?.status;
  const isRetry =
    status === 'failed' || status === 'expired' || status === 'cancelled';
  const isPending = status === 'initiated' || status === 'redirected';

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/applications/${applicationId}/consent/initiate`,
        { method: 'POST' },
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body.error?.message ?? 'Something went wrong. Please try again.');
        return;
      }
      const hostedUrl = body.data?.hostedUrl as string | undefined;
      if (hostedUrl) {
        window.location.assign(hostedUrl);
        return;
      }
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResume = () => {
    if (paymentConsent?.hostedUrl) {
      window.location.assign(paymentConsent.hostedUrl);
    }
  };

  const installments = paymentConsent?.installments ?? [];

  return (
    <div className="mt-4 bg-white border border-amber-300 rounded-xl p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">
          Authorise your repayments
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          Before funds can be released, we need your bank&apos;s authorisation
          for the fortnightly repayments. You&apos;ll be redirected to your
          bank&apos;s secure app to confirm — no money moves at this step.
        </p>
      </div>

      {installments.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-3 text-xs">
          <p className="font-semibold text-gray-700 mb-2">
            Repayments to be authorised
          </p>
          <ul className="space-y-1">
            {installments.map((i) => (
              <li key={i.dueDate} className="flex justify-between text-gray-600">
                <span>{i.dueDate}</span>
                <span className="font-medium text-gray-900">
                  {fmtNzd(i.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        {isPending && paymentConsent?.hostedUrl ? (
          <button
            onClick={handleResume}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            Continue to your bank
          </button>
        ) : (
          <button
            onClick={handleStart}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Starting…
              </>
            ) : isRetry ? (
              'Retry bank authorisation'
            ) : (
              'Start bank authorisation'
            )}
          </button>
        )}
        {status === 'active' && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Mandate active ✓
          </span>
        )}
      </div>
    </div>
  );
}
