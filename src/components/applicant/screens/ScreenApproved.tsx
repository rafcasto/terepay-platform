import { Hero, HeroBalance, Pill, StatGrid } from '@/components/ui';
import { fmtNZD } from '@/lib/loan/format';
import type { LoanApplication, AnyApplicationStatus, PaymentConsent } from '@/types/application';
import { computeApplicationFee } from '@/lib/constants/fees';
import { buildSchedule, RATE_MODEL } from '@/lib/loan/repayment';
import AcceptOfferButton from '@/app/applicant/applications/[id]/_components/AcceptOfferButton';
import RejectOfferButton from '@/app/applicant/applications/[id]/_components/RejectOfferButton';
import InitiatePaymentConsentCard from '@/app/applicant/applications/[id]/_components/InitiatePaymentConsentCard';
import { SectionCard } from './shared';
import { QIPPAY_DESCRIPTOR } from '@/lib/qippay/brand';

interface Props {
  app: LoanApplication & Record<string, unknown>;
  status: AnyApplicationStatus;
  applicationId: string;
  isExistingCustomer: boolean;
  /**
   * Qippay feature flag. Off → no bank-authorisation step: accepting the offer
   * is the last thing the borrower does before the lender releases funds.
   */
  qippayEnabled?: boolean;
}

export default function ScreenApproved({
  app,
  status,
  applicationId,
  isExistingCustomer,
  qippayEnabled = true,
}: Props) {
  const ld = app.loanDetails;
  const approvedAmount = ld?.approvedAmount ?? ld?.requestedAmount ?? 0;
  const refNum = (app.referenceNumber as string | undefined) ?? `#${applicationId.slice(0, 8)}`;

  const recordedFee = (ld as Record<string, unknown>)?.applicationFee as number | undefined;
  const fee = recordedFee ?? computeApplicationFee(isExistingCustomer);
  const payout = approvedAmount - fee;

  const isAccepted = status === 'loan_accepted';
  const isAwaitingConsent = status === 'awaiting_payment_consent';
  const isApproved = status === 'approved';

  const pc = app.paymentConsent as PaymentConsent | undefined;
  const consentActive = pc?.status === 'active';

  let title = 'Your loan is approved';
  let subtitle = 'Review the offer below, then accept to continue.';
  let pill: React.ReactNode = (
    <Pill tone="success" pulse onInk>
      Approved
    </Pill>
  );

  if (isAccepted || (isAwaitingConsent && !qippayEnabled)) {
    title = 'Offer accepted';
    subtitle = qippayEnabled
      ? `We're preparing your bank authorisation with ${QIPPAY_DESCRIPTOR}.`
      : 'Your lender is arranging the transfer. Funds will be paid to your nominated account shortly.';
    pill = (
      <Pill tone="info" onInk>
        Accepted
      </Pill>
    );
  } else if (isAwaitingConsent && !consentActive) {
    title = 'Authorise your repayments';
    subtitle = `One last step before funds are released — ${QIPPAY_DESCRIPTOR}.`;
    pill = (
      <Pill tone="amber" pulse onInk>
        Action needed
      </Pill>
    );
  } else if (isAwaitingConsent && consentActive) {
    title = 'All set — awaiting disbursement';
    subtitle = `Your repayments are set up with ${QIPPAY_DESCRIPTOR}. Funds will be released shortly.`;
    pill = (
      <Pill tone="success" onInk>
        Ready
      </Pill>
    );
  }

  return (
    <div className="space-y-5">
      <Hero state="approved" eyebrow={`Application ${refNum}`} pill={pill} title={title} subtitle={subtitle}>
        <HeroBalance amount={approvedAmount} />
        <div className="mt-4">
          <StatGrid
            stats={[
              { label: 'Paid to your account', value: fmtNZD(payout) },
              { label: 'Application fee (deducted)', value: fmtNZD(fee) },
            ]}
          />
        </div>
      </Hero>

      {isApproved && (
        <SectionCard eyebrow="Your offer" title="Accept or decline">
          <p className="text-sm text-muted mb-4">
            {qippayEnabled
              ? `Accept to lock in your approved amount and continue to bank authorisation with ${QIPPAY_DESCRIPTOR}. `
              : 'Accept to lock in your approved amount — your lender will then release the funds. '}
            You can decline if you&apos;ve changed your mind.
          </p>
          <div className="flex flex-wrap gap-3">
            <AcceptOfferButton applicationId={applicationId} />
            <RejectOfferButton applicationId={applicationId} />
          </div>
        </SectionCard>
      )}

      {isAwaitingConsent && qippayEnabled && (
        <InitiatePaymentConsentCard
          applicationId={applicationId}
          paymentConsent={
            pc
              ? {
                  status: pc.status,
                  hostedUrl: pc.hostedUrl,
                  installments: pc.scheduleSummary?.installments?.map((i) => ({
                    dueDate: i.dueDate,
                    amountCents: i.amountCents,
                  })),
                }
              : undefined
          }
        />
      )}

      {(() => {
        const round2 = (n: number) => Math.round(n * 100) / 100;
        // Total amount to pay = principal + interest (the fee is deducted at
        // disbursement, not repaid via instalments). Total amount = that + fee.
        // Figures agreed at approval win. Only fall back to a fresh quote for
        // applications approved before pricing was persisted.
        const quote = buildSchedule({ principal: approvedAmount, startDate: new Date() });
        const totalToPay = ld?.totalRepayment ?? quote.totalRepayable;
        const interest = round2(totalToPay - approvedAmount);
        const totalAmount = round2(totalToPay + fee);
        const fortnightly = ld?.fortnightlyPayment ?? quote.fortnightlyPayment;
        // Legacy loans were priced on a flat 4.7%; amortised ones quote the
        // annual rate. Label whichever this loan was actually written on.
        const rateLabel =
          ld?.rateModel === RATE_MODEL || ld?.rateModel === undefined
            ? `${round2((ld?.interestRate ?? quote.annualRate) * 100)}% p.a.`
            : `${Math.round((interest / approvedAmount) * 1000) / 10}%`;

        const installmentCount = quote.rows.length || 4;
        // Two groups so the two "totals" can't be confused: what is paid out
        // (loan − fee) and what is repaid (loan + interest, collected in
        // instalments). The fee is deducted up front and is never collected
        // via an instalment; the overall cost line adds it back for CCCFA
        // total-cost disclosure.
        const rows: Array<{ label: string; value: string; strong?: boolean; sub?: string }> = [
          { label: 'Loan amount', value: fmtNZD(approvedAmount) },
          {
            label: 'Application fee',
            value: `− ${fmtNZD(fee)}`,
            sub: 'Deducted from the loan before payout — not part of your repayments',
          },
          { label: 'Paid to your account', value: fmtNZD(payout), strong: true },
          { label: `Interest (${rateLabel})`, value: fmtNZD(interest) },
          {
            label: 'You repay',
            value: fmtNZD(totalToPay),
            strong: true,
            sub: `${installmentCount} fortnightly instalments of ${fmtNZD(fortnightly)} — loan amount plus interest`,
          },
          {
            label: 'Total cost of borrowing',
            value: fmtNZD(totalAmount),
            sub: 'Repayments plus the application fee',
          },
          { label: 'Term', value: `${installmentCount * 2} weeks · ${installmentCount} fortnightly payments` },
        ];

        return (
          <SectionCard eyebrow="Loan details" title="What you're agreeing to">
            <dl className="divide-y divide-border-2">
              {rows.map((r) => (
                <div key={r.label} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                  <dt className="text-sm text-muted">
                    {r.label}
                    {r.sub && <span className="block text-xs text-muted/80">{r.sub}</span>}
                  </dt>
                  <dd className={`text-sm tabular-nums text-text ${r.strong ? 'font-bold' : 'font-semibold'}`}>
                    {r.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-muted">
              All loans are charged interest. The {fmtNZD(fee)} application fee is deducted from your loan
              amount at disbursement, so {fmtNZD(payout)} is paid to your account and your instalments
              repay the {fmtNZD(approvedAmount)} loan plus interest ({fmtNZD(totalToPay)} in total).
              {!qippayEnabled &&
                ' Repayments are made directly to TerePay by each due date — your lender will confirm the account details.'}
            </p>
          </SectionCard>
        );
      })()}
    </div>
  );
}
