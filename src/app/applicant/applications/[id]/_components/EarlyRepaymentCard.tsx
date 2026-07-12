'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, CheckboxField, FormField, SelectField, Pill, Icons } from '@/components/ui';
import { fmtNZD } from '@/lib/loan/format';
import type { EarlyRepaymentStatus } from '@/types/application';
import { SectionCard } from '@/components/applicant/screens/shared';

export type EarlyRepaymentQuoteView = {
  outstandingBalance: number;
  unearnedInterestRebate: number;
  netOutstanding: number;
  prepaymentFee: number;
  totalPayoff: number;
};

type Provider = { id: string; name: string; logoUrl?: string };

type Props = {
  applicationId: string;
  quote: EarlyRepaymentQuoteView;
  /** Status of any existing early-repayment attempt on this loan. */
  status?: EarlyRepaymentStatus;
};

type InitiateResponse = {
  data: {
    paymentId: string;
    hostedUrl?: string;
    embedded?: boolean;
    providers?: Provider[];
    phoneHint?: string;
  };
};

type ApproveResponse = { data: { method: 'CIBA' | 'redirect'; redirectUri?: string } };

type Stage = 'summary' | 'review' | 'picking' | 'approving' | 'waiting_ciba';

export default function EarlyRepaymentCard({ applicationId, quote, status }: Props) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('summary');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerId, setProviderId] = useState('');
  const [phone, setPhone] = useState('');
  const [hostedUrl, setHostedUrl] = useState('');

  const inFlight = status === 'initiated' || status === 'pending';

  // Poll payment status while waiting for a CIBA bank-app approval.
  useEffect(() => {
    if (stage !== 'waiting_ciba') return;
    const interval = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/applications/${applicationId}/early-repayment/status`);
        if (!res.ok) return;
        const body = await res.json();
        const s = body.data?.status;
        if (s === 'paid' || s === 'failed' || s === 'expired' || s === 'cancelled') {
          router.refresh();
        }
      } catch {
        // retry next tick
      }
    }, 3000);
    return () => window.clearInterval(interval);
  }, [stage, applicationId, router]);

  // Create the PayBy payment, then show the in-app bank picker.
  const handleStart = async () => {
    if (!accepted) {
      setError('Please confirm you accept the advance-payment terms.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/early-repayment/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disclaimerAccepted: true }),
      });
      const body = (await res.json()) as InitiateResponse | { error?: { message?: string } };
      if (!res.ok) {
        setError(('error' in body && body.error?.message) || 'Could not start the payment.');
        return;
      }
      const data = (body as InitiateResponse).data;
      // Embedded in-app bank picker only when enabled and banks are available;
      // otherwise use PayBy's supported Hosted flow — redirect to the payment
      // page. The Hosted round-trip returns to our early-repayment return page.
      if (data.embedded && (data.providers?.length ?? 0) > 0) {
        setProviders(data.providers ?? []);
        setProviderId(data.providers?.[0]?.id ?? '');
        setPhone(data.phoneHint ?? '');
        setHostedUrl(data.hostedUrl ?? '');
        setStage('picking');
        return;
      }
      if (data.hostedUrl) {
        window.location.assign(data.hostedUrl);
        return;
      }
      setError('Could not start the payment. Please try again.');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Approve at the selected bank — CIBA push (poll) or redirect straight to bank.
  const handleApprove = async () => {
    if (!providerId || !phone.trim()) {
      setError('Please choose a bank and confirm your phone number.');
      return;
    }
    setLoading(true);
    setError(null);
    setStage('approving');
    try {
      const res = await fetch(`/api/applications/${applicationId}/early-repayment/approve`, {
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

  // Fallback: hand off to the Qippay Hosted payment page (used when no banks
  // are available for the embedded picker, or the embedded approve fails).
  const goToHosted = () => {
    if (hostedUrl) window.location.assign(hostedUrl);
  };

  return (
    <SectionCard
      eyebrow="Pay off early"
      title="Repay your loan in advance"
      action={inFlight ? <Pill tone="amber" pulse>In progress</Pill> : undefined}
    >
      {stage !== 'waiting_ciba' && (
        <p className="text-sm text-muted">
          Clear your loan today instead of waiting for the scheduled instalments. You&apos;ll pay the
          balance owed, less any interest not yet earned, plus a fixed{' '}
          <span className="font-semibold text-text">{fmtNZD(quote.prepaymentFee)}</span> prepayment fee.
        </p>
      )}

      {stage === 'summary' && (
        <div className="mt-4">
          <Button variant="secondary" onClick={() => setStage('review')} fullWidth>
            {inFlight ? 'Continue early repayment' : 'Pay off early'}
          </Button>
        </div>
      )}

      {(stage === 'review' || stage === 'picking' || stage === 'approving') && (
        <div className="mt-4 rounded-xl bg-surface-2 p-3.5">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Remaining instalments</dt>
              <dd className="font-semibold text-text tabular-nums">{fmtNZD(quote.outstandingBalance)}</dd>
            </div>
            {quote.unearnedInterestRebate > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">Less: unused interest refund</dt>
                <dd className="font-semibold text-success tabular-nums">
                  −{fmtNZD(quote.unearnedInterestRebate)}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted">Balance to settle</dt>
              <dd className="font-semibold text-text tabular-nums">{fmtNZD(quote.netOutstanding)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Prepayment fee</dt>
              <dd className="font-semibold text-text tabular-nums">{fmtNZD(quote.prepaymentFee)}</dd>
            </div>
            <div className="flex justify-between border-t border-border-2 pt-2">
              <dt className="font-semibold text-text">Total to pay today</dt>
              <dd className="text-base font-bold text-text tabular-nums">{fmtNZD(quote.totalPayoff)}</dd>
            </div>
          </dl>
        </div>
      )}

      {stage === 'review' && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-border-default p-3.5 text-[13px] leading-relaxed text-muted">
            <p className="font-semibold text-text mb-1">Advance-payment terms</p>
            <p>
              By paying off early you agree to settle your loan today for{' '}
              <span className="font-semibold">{fmtNZD(quote.totalPayoff)}</span>. This is the balance of
              your remaining instalments, less a refund of interest not yet earned (
              <span className="font-semibold">{fmtNZD(quote.unearnedInterestRebate)}</span>), plus a fixed{' '}
              <span className="font-semibold">{fmtNZD(quote.prepaymentFee)}</span> prepayment fee that covers
              the administrative cost of settling ahead of schedule. The prepayment fee is non-refundable.
              Once your payment is approved by your bank, your loan is settled in full, your remaining
              scheduled instalments are cancelled, and no further payments are collected. All loans are
              charged interest.
            </p>
          </div>

          <CheckboxField
            label="I have read and accept the advance-payment terms above."
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            disabled={loading}
          />

          {error && <p className="text-sm text-danger font-medium">{error}</p>}

          <div className="flex gap-2">
            <Button onClick={handleStart} disabled={loading || !accepted} fullWidth>
              {loading ? 'Starting…' : 'Continue'}
            </Button>
            <Button variant="secondary" onClick={() => setStage('summary')} disabled={loading}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {(stage === 'picking' || stage === 'approving') && providers.length === 0 && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted">
            {hostedUrl
              ? 'Your bank isn’t available for in-app approval right now. You can still pay securely on our payment page.'
              : 'No banks are available right now. Please try again shortly.'}
          </p>

          {error && <p className="text-sm text-danger font-medium">{error}</p>}

          <div className="flex gap-2">
            {hostedUrl ? (
              <Button onClick={goToHosted} disabled={loading} fullWidth>
                <Icons.ArrowRight size={16} />
                {`Pay ${fmtNZD(quote.totalPayoff)} on the secure payment page`}
              </Button>
            ) : (
              <Button onClick={handleStart} disabled={loading} fullWidth>
                {loading ? 'Retrying…' : 'Try again'}
              </Button>
            )}
            <Button variant="secondary" onClick={() => setStage('review')} disabled={loading}>
              Back
            </Button>
          </div>
        </div>
      )}

      {(stage === 'picking' || stage === 'approving') && providers.length > 0 && (
        <div className="mt-4 space-y-4">
          <SelectField
            label="Your bank"
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            disabled={loading}
          >
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
            hint="May be used for a secure push notification from your bank"
          />

          {error && <p className="text-sm text-danger font-medium">{error}</p>}

          <div className="flex gap-2">
            <Button onClick={handleApprove} disabled={loading || !providerId || !phone.trim()} fullWidth>
              <Icons.ArrowRight size={16} />
              {loading ? 'Contacting your bank…' : `Pay ${fmtNZD(quote.totalPayoff)} at my bank`}
            </Button>
            <Button variant="secondary" onClick={() => setStage('review')} disabled={loading}>
              Back
            </Button>
          </div>
          <p className="text-xs text-muted">
            You approve the payment securely with your own bank. Applications can be declined and terms
            apply.
          </p>
          {hostedUrl && (
            <button
              type="button"
              onClick={goToHosted}
              disabled={loading}
              className="text-xs font-semibold text-accent hover:underline disabled:opacity-50"
            >
              Having trouble? Pay on the secure payment page instead
            </button>
          )}
        </div>
      )}

      {stage === 'waiting_ciba' && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-info/40 bg-info-soft p-3.5">
            <span className="h-5 w-5 shrink-0 rounded-full border-2 border-info border-t-transparent animate-spin" />
            <p className="text-sm text-[#1e40af]">
              We&apos;ve sent an approval request to your bank&apos;s app. Approve the{' '}
              {fmtNZD(quote.totalPayoff)} payment there to settle your loan — this page will refresh
              automatically.
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
    </SectionCard>
  );
}
