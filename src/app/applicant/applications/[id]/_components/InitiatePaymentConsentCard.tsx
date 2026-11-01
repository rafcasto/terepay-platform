'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PaymentConsentStatus } from '@/types/application';
import { Button, Card, CardHeader, Pill, Icons } from '@/components/ui';
import {
  QippayBankPicker,
  QippayCheckoutIntro,
  QippayFaq,
  QippayLockup,
  QippayPayButton,
  type QippayBank,
} from '@/components/qippay';
import { MERCHANT_NAME, QIPPAY_BANK_SELECTION, QIPPAY_DESCRIPTOR } from '@/lib/qippay/brand';
import { fmtYmd } from '@/lib/loan/format';

export type PaymentConsentCardProps = {
  status: PaymentConsentStatus;
  hostedUrl?: string;
  installments?: Array<{ dueDate: string; amountCents: number }>;
};

type Props = {
  applicationId: string;
  paymentConsent?: PaymentConsentCardProps;
};

type InitiateResponse = {
  data: {
    mandateId: string;
    providers: QippayBank[];
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

/**
 * Applicant-side SetPay consent step, presented per the Qippay Merchant Brand
 * Guidelines (Embedded): the product descriptor "Pay by bank with Qippay"
 * everywhere (never "SetPay"), the dedicated Qippay button, the checkout
 * instructions before the customer starts, then the vertical bank picker with
 * the mobile-number field and a "Continue to [Bank]" confirm.
 */
export default function InitiatePaymentConsentCard({ applicationId, paymentConsent }: Props) {
  const router = useRouter();
  const [stage, setStage] = useState<'idle' | 'picking' | 'approving' | 'waiting_ciba'>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<QippayBank[]>([]);
  // No bank is pre-selected — guideline §6 ("no bank looks preferred").
  const [providerId, setProviderId] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [installments, setInstallments] = useState<Array<{ dueDate: string; amountCents: number }>>(
    paymentConsent?.installments ?? [],
  );
  const [totalCents, setTotalCents] = useState<number | undefined>(
    paymentConsent?.installments?.reduce((acc, i) => acc + i.amountCents, 0),
  );

  const status = paymentConsent?.status;
  const isRetry = status === 'failed' || status === 'expired' || status === 'cancelled';
  const isActive = status === 'active';
  const selectedBank = providers.find((p) => p.id === providerId);

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
      setTotalCents(data.scheduleSummary?.totalAmountCents);
      setProviderId('');
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
      setError('Please choose your bank and enter your mobile number.');
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
            <p className="text-xs text-muted">
              Your repayments are set up with {QIPPAY_DESCRIPTOR}. Your lender will release the funds
              shortly.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const picking = stage === 'picking' || stage === 'approving';

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
        Before funds can be released, your bank needs to authorise the fortnightly repayments using{' '}
        {QIPPAY_DESCRIPTOR} (Open Banking Payments). You approve it in your own banking app and no money
        moves at this step.
      </p>
      {isRetry && stage === 'idle' && (
        <p className="mt-2 text-sm font-medium text-warning-text">
          Your previous authorisation wasn&apos;t completed. You can try again below.
        </p>
      )}

      {installments.length > 0 && stage !== 'waiting_ciba' && (
        <div className="mt-4 rounded-xl bg-surface-2 p-3.5">
          <p className="text-[11.5px] font-semibold tracking-[0.08em] uppercase text-muted mb-2">
            Repayments to authorise
          </p>
          <ul className="space-y-1.5">
            {installments.map((i) => (
              <li key={i.dueDate} className="flex justify-between text-sm">
                <span className="text-muted">{fmtYmd(i.dueDate)}</span>
                <span className="font-semibold text-text tabular-nums">{fmtNzd(i.amountCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stage === 'idle' && (
        <div className="mt-4 space-y-4">
          <QippayCheckoutIntro
            note={
              <>
                This sets up your fortnightly repayments to {MERCHANT_NAME}. Nothing is collected until
                each instalment is due. All loans are charged interest.
              </>
            }
          />
          {error && <p className="text-sm text-danger font-medium">{error}</p>}
          <QippayPayButton onClick={handleStart} disabled={loading} fullWidth>
            {loading ? 'Starting…' : QIPPAY_DESCRIPTOR}
          </QippayPayButton>
          <QippayLockup logoHeight={28} className="pt-1" />
          <QippayFaq className="pt-2" />
        </div>
      )}

      {picking && (
        <div className="mt-4 space-y-4">
          {typeof totalCents === 'number' && (
            <p className="text-sm text-[var(--text-body)]">
              Authorising <span className="font-semibold tabular-nums">{fmtNzd(totalCents)}</span> in
              repayments to {MERCHANT_NAME}.
            </p>
          )}
          {providers.length === 0 ? (
            <p className="text-sm text-muted">No banks are available right now. Please try again shortly.</p>
          ) : (
            <QippayBankPicker
              idPrefix="consent"
              banks={providers}
              selectedId={providerId}
              onSelect={setProviderId}
              phone={phone}
              onPhoneChange={setPhone}
              disabled={loading}
            />
          )}
          {error && <p className="text-sm text-danger font-medium">{error}</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <QippayPayButton
              onClick={handleApprove}
              disabled={loading || !providerId || !phone.trim()}
              fullWidth
            >
              {loading
                ? 'Contacting your bank…'
                : selectedBank
                  ? QIPPAY_BANK_SELECTION.continueTo(selectedBank.name)
                  : 'Choose your bank to continue'}
            </QippayPayButton>
            <Button variant="secondary" size="lg" onClick={() => setStage('idle')} disabled={loading}>
              Cancel
            </Button>
          </div>
          <p className="text-xs text-muted">
            You approve the authorisation securely in your own bank&apos;s app or online banking.
            Applications can be declined and terms apply.
          </p>
          <QippayLockup logoHeight={28} className="pt-1" />
        </div>
      )}

      {stage === 'waiting_ciba' && (
        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-info/40 bg-info-soft p-3.5">
            <span className="h-5 w-5 shrink-0 rounded-full border-2 border-info border-t-transparent animate-spin" />
            <p className="text-sm text-[#1e40af]">
              We&apos;ve sent the request to {selectedBank?.name ?? 'your bank'}. Approve it in your banking
              app to continue — this page will refresh automatically.
            </p>
          </div>
          <button
            onClick={() => router.refresh()}
            className="text-sm font-semibold text-info hover:underline"
          >
            I&apos;ve approved — check now
          </button>
          <QippayLockup logoHeight={28} className="pt-1" />
        </div>
      )}
    </Card>
  );
}
