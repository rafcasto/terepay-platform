'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PaymentConsentStatus } from '@/types/application';
import { Button, Card, CardHeader, FormField, SelectField, Pill, Icons } from '@/components/ui';

export type PaymentConsentCardProps = {
  status: PaymentConsentStatus;
  hostedUrl?: string;
  installments?: Array<{ dueDate: string; amountCents: number }>;
};

type Props = {
  applicationId: string;
  paymentConsent?: PaymentConsentCardProps;
};

type Provider = { id: string; name: string; logoUrl?: string };

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

type ApproveResponse = { data: { method: 'CIBA' | 'redirect'; redirectUri?: string } };

const fmtNzd = (cents?: number) =>
  typeof cents === 'number'
    ? new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(cents / 100)
    : '—';

export default function InitiatePaymentConsentCard({ applicationId, paymentConsent }: Props) {
  const router = useRouter();
  const [stage, setStage] = useState<'idle' | 'picking' | 'approving' | 'waiting_ciba'>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [installments, setInstallments] = useState<Array<{ dueDate: string; amountCents: number }>>(
    paymentConsent?.installments ?? [],
  );

  const status = paymentConsent?.status;
  const isRetry = status === 'failed' || status === 'expired' || status === 'cancelled';
  const isActive = status === 'active';

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
        // retry next tick
      }
    }, 3000);
    return () => window.clearInterval(interval);
  }, [stage, applicationId, router]);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/consent/initiate`, {
        method: 'POST',
      });
      const body = (await res.json()) as InitiateResponse | { error?: { message?: string } };
      if (!res.ok) {
        setError(('error' in body && body.error?.message) || 'Could not start verification.');
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
      const res = await fetch(`/api/applications/${applicationId}/consent/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, phone }),
      });
      const body = (await res.json()) as ApproveResponse | { error?: { message?: string } };
      if (!res.ok) {
        setError(('error' in body && body.error?.message) || 'Could not start bank approval.');
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
      <Card>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-success-soft text-success flex items-center justify-center shrink-0">
            <Icons.CheckCircle size={22} />
          </div>
          <div>
            <p className="text-sm font-semibold text-success">Bank authorisation complete</p>
            <p className="text-xs text-muted">Your lender will release the funds shortly.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-accent/40">
      <CardHeader
        eyebrow="One more step"
        title="Authorise your repayments"
        action={
          <Pill tone="amber" pulse>
            Action needed
          </Pill>
        }
      />
      <p className="mt-3 text-sm text-muted">
        Before funds can be released, your bank needs to authorise the fortnightly repayments.
        You&apos;ll be sent to your bank&apos;s secure page — no money moves at this step.
      </p>

      {installments.length > 0 && stage !== 'waiting_ciba' && (
        <div className="mt-4 rounded-xl bg-surface-2 p-3.5">
          <p className="text-[11.5px] font-semibold tracking-[0.08em] uppercase text-muted mb-2">
            Repayments to authorise
          </p>
          <ul className="space-y-1.5">
            {installments.map((i) => (
              <li key={i.dueDate} className="flex justify-between text-sm">
                <span className="text-muted">{i.dueDate}</span>
                <span className="font-semibold text-text tabular-nums">{fmtNzd(i.amountCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-danger font-medium">{error}</p>}

      {stage === 'idle' && (
        <div className="mt-5">
          <Button onClick={handleStart} disabled={loading} fullWidth>
            {loading ? 'Starting…' : isRetry ? 'Retry bank authorisation' : 'Start bank authorisation'}
          </Button>
        </div>
      )}

      {stage === 'picking' && (
        <div className="mt-5 space-y-4">
          <SelectField
            label="Your bank"
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            disabled={loading}
          >
            {providers.length === 0 && <option value="">(no banks available)</option>}
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
          <FormField
            type="tel"
            label="Phone registered with your bank"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={loading}
            placeholder="+64 21 123 4567"
            hint="May be used for a push notification"
          />
          <div className="flex gap-2">
            <Button onClick={handleApprove} disabled={loading || !providerId || !phone.trim()} fullWidth>
              {loading ? 'Contacting bank…' : 'Continue to my bank'}
            </Button>
            <Button variant="secondary" onClick={() => setStage('idle')} disabled={loading}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {stage === 'waiting_ciba' && (
        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-info/40 bg-info-soft p-3.5">
            <span className="h-5 w-5 shrink-0 rounded-full border-2 border-info border-t-transparent animate-spin" />
            <p className="text-sm text-[#1e40af]">
              We&apos;ve sent an approval request to your bank&apos;s app. Approve it there to continue — this page will refresh automatically.
            </p>
          </div>
          <button
            onClick={() => router.refresh()}
            className="text-sm font-semibold text-info hover:underline"
          >
            I&apos;ve approved — check now
          </button>
        </div>
      )}
    </Card>
  );
}
