'use client';

import { useEffect, useState } from 'react';
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

type Provider = {
  id: string;
  name: string;
  logoUrl?: string;
};

type InitiateResponse = {
  data: {
    mandateId: string;
    providers: Provider[];
    phoneHint?: string;
    scheduleSummary: {
      currency: 'NZD';
      totalAmountCents: number;
      installments: Array<{ dueDate: string; amountCents: number }>;
    };
  };
};

type ApproveResponse = {
  data: { method: 'CIBA' | 'redirect'; redirectUri?: string };
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
  const [stage, setStage] = useState<'idle' | 'picking' | 'approving' | 'waiting_ciba'>(
    'idle',
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [installments, setInstallments] = useState<
    Array<{ dueDate: string; amountCents: number }>
  >(paymentConsent?.installments ?? []);

  const status = paymentConsent?.status;
  const isRetry =
    status === 'failed' || status === 'expired' || status === 'cancelled';
  const isActive = status === 'active';

  // Resume an in-flight CIBA approval by polling the status endpoint.
  useEffect(() => {
    if (stage !== 'waiting_ciba') return;
    const interval = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/applications/${applicationId}/consent/status`);
        if (!res.ok) return;
        const body = await res.json();
        const s = body.data?.status;
        if (s === 'active' || s === 'failed' || s === 'expired' || s === 'cancelled') {
          router.refresh();
        }
      } catch {
        // ignore — next tick will retry
      }
    }, 3000);
    return () => window.clearInterval(interval);
  }, [stage, applicationId, router]);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/applications/${applicationId}/consent/initiate`,
        { method: 'POST' },
      );
      const body = (await res.json()) as InitiateResponse | { error?: { message?: string } };
      if (!res.ok) {
        setError(
          ('error' in body && body.error?.message) || 'Could not start verification.',
        );
        return;
      }
      const data = (body as InitiateResponse).data;
      setProviders(data.providers ?? []);
      setInstallments(data.scheduleSummary?.installments ?? []);
      setProviderId(data.providers?.[0]?.id ?? '');
      setPhone(data.phoneHint ?? '');
      setStage('picking');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!providerId || !phone.trim()) {
      setError('Please choose a bank and confirm your phone number.');
      return;
    }
    setLoading(true);
    setError(null);
    setStage('approving');
    try {
      const res = await fetch(
        `/api/applications/${applicationId}/consent/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerId, phone, method: 'redirect' }),
        },
      );
      const body = (await res.json()) as ApproveResponse | { error?: { message?: string } };
      if (!res.ok) {
        setError(
          ('error' in body && body.error?.message) || 'Could not start bank approval.',
        );
        setStage('picking');
        return;
      }
      const data = (body as ApproveResponse).data;
      if (data.method === 'CIBA') {
        setStage('waiting_ciba');
        return;
      }
      if (data.redirectUri) {
        window.location.assign(data.redirectUri);
        return;
      }
      // No redirect URL and not CIBA — defensive: fall back to status refresh.
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setStage('picking');
    } finally {
      setLoading(false);
    }
  };

  if (isActive) {
    return (
      <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
        Bank authorisation complete ✓
      </div>
    );
  }

  return (
    <div className="mt-4 bg-white border border-amber-300 rounded-xl p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">
          Authorise your repayments
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          Before funds can be released, we need your bank&apos;s authorisation
          for the fortnightly repayments. You&apos;ll be sent to your bank&apos;s
          secure page to approve — no money moves at this step.
        </p>
      </div>

      {installments.length > 0 && stage !== 'waiting_ciba' && (
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

      {stage === 'idle' && (
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

      {stage === 'picking' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">
              Your bank
            </label>
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {providers.length === 0 && <option value="">(no banks available)</option>}
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">
              Phone number registered with your bank
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              placeholder="+64 21 123 4567"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Your bank may use this to send a push notification to their app.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleApprove}
              disabled={loading || !providerId || !phone.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Contacting bank…
                </>
              ) : (
                'Continue to my bank'
              )}
            </button>
            <button
              onClick={() => setStage('idle')}
              disabled={loading}
              className="text-sm text-gray-500 hover:underline disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {stage === 'waiting_ciba' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm">
            <span className="h-5 w-5 shrink-0 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
            <p className="text-indigo-800">
              We&apos;ve sent an approval request to your bank&apos;s app. Open
              the app and approve to continue — this page will refresh
              automatically.
            </p>
          </div>
          <button
            onClick={() => router.refresh()}
            className="text-sm text-indigo-600 hover:underline"
          >
            I&apos;ve approved — check now
          </button>
        </div>
      )}
    </div>
  );
}
