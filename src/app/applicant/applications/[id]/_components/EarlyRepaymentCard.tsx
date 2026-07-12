'use client';

import { useState } from 'react';
import { Button, CheckboxField, Pill, Icons } from '@/components/ui';
import { fmtNZD } from '@/lib/loan/format';
import type { EarlyRepaymentStatus } from '@/types/application';
import { SectionCard } from '@/components/applicant/screens/shared';

export type EarlyRepaymentQuoteView = {
  outstandingBalance: number;
  prepaymentFee: number;
  totalPayoff: number;
};

type Props = {
  applicationId: string;
  quote: EarlyRepaymentQuoteView;
  /** Status of any existing early-repayment attempt on this loan. */
  status?: EarlyRepaymentStatus;
};

type InitiateResponse = {
  data: { paymentId: string; hostedUrl: string };
};

export default function EarlyRepaymentCard({ applicationId, quote, status }: Props) {
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inFlight = status === 'initiated' || status === 'pending';

  const handlePayoff = async () => {
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

  return (
    <SectionCard
      eyebrow="Pay off early"
      title="Repay your loan in advance"
      action={inFlight ? <Pill tone="amber" pulse>In progress</Pill> : undefined}
    >
      <p className="text-sm text-muted">
        Clear your loan today instead of waiting for the scheduled instalments. You&apos;ll pay the
        remaining balance plus a fixed{' '}
        <span className="font-semibold text-text">{fmtNZD(quote.prepaymentFee)}</span> prepayment fee.
      </p>

      {!open && (
        <div className="mt-4">
          <Button variant="secondary" onClick={() => setOpen(true)} fullWidth>
            {inFlight ? 'Continue early repayment' : 'Pay off early'}
          </Button>
        </div>
      )}

      {open && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl bg-surface-2 p-3.5">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Remaining balance</dt>
                <dd className="font-semibold text-text tabular-nums">{fmtNZD(quote.outstandingBalance)}</dd>
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

          <div className="rounded-xl border border-border-default p-3.5 text-[13px] leading-relaxed text-muted">
            <p className="font-semibold text-text mb-1">Advance-payment terms</p>
            <p>
              By paying off early you agree to pay the remaining balance shown above plus a{' '}
              <span className="font-semibold">{fmtNZD(quote.prepaymentFee)}</span> prepayment fee, which
              covers the administrative cost of settling your loan ahead of schedule. This fee is
              non-refundable. Once your payment is approved by your bank, your loan is settled in full,
              your remaining scheduled instalments are cancelled, and no further payments are collected.
              Interest already included in your instalments is not refunded. All loans are charged
              interest.
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
            <Button onClick={handlePayoff} disabled={loading || !accepted} fullWidth>
              <Icons.ArrowRight size={16} />
              {loading ? 'Starting…' : `Pay ${fmtNZD(quote.totalPayoff)} at my bank`}
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
          </div>
          <p className="text-xs text-muted">
            You&apos;ll be sent to your bank&apos;s secure page to approve the payment. Applications can be
            declined and terms apply.
          </p>
        </div>
      )}
    </SectionCard>
  );
}
