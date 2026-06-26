import { Hero, HeroBalance, Pill, StatGrid } from '@/components/ui';
import { fmtNZD } from '@/lib/loan/format';
import type { LoanApplication, AnyApplicationStatus, PaymentConsent } from '@/types/application';
import { computeApplicationFee, LOAN_INTEREST_RATE } from '@/lib/constants/fees';
import AcceptOfferButton from '@/app/applicant/applications/[id]/_components/AcceptOfferButton';
import RejectOfferButton from '@/app/applicant/applications/[id]/_components/RejectOfferButton';
import InitiatePaymentConsentCard from '@/app/applicant/applications/[id]/_components/InitiatePaymentConsentCard';
import { SectionCard } from './shared';

interface Props {
  app: LoanApplication & Record<string, unknown>;
  status: AnyApplicationStatus;
  applicationId: string;
  isExistingCustomer: boolean;
}

export default function ScreenApproved({ app, status, applicationId, isExistingCustomer }: Props) {
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

  if (isAccepted) {
    title = 'Offer accepted';
    subtitle = "We're preparing the bank authorisation step.";
    pill = (
      <Pill tone="info" onInk>
        Accepted
      </Pill>
    );
  } else if (isAwaitingConsent && !consentActive) {
    title = 'Authorise your repayments';
    subtitle = 'One last step before funds are released.';
    pill = (
      <Pill tone="amber" pulse onInk>
        Action needed
      </Pill>
    );
  } else if (isAwaitingConsent && consentActive) {
    title = 'All set — awaiting disbursement';
    subtitle = 'Your bank authorisation is complete. Funds will be released shortly.';
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
              { label: 'You receive', value: fmtNZD(payout) },
              { label: 'Application fee', value: fmtNZD(fee) },
            ]}
          />
        </div>
      </Hero>

      {isApproved && (
        <SectionCard eyebrow="Your offer" title="Accept or decline">
          <p className="text-sm text-muted mb-4">
            Accept to lock in your approved amount and continue to bank authorisation. You can decline if you&apos;ve
            changed your mind.
          </p>
          <div className="flex flex-wrap gap-3">
            <AcceptOfferButton applicationId={applicationId} />
            <RejectOfferButton applicationId={applicationId} />
          </div>
        </SectionCard>
      )}

      {isAwaitingConsent && (
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
        // Total amount of payments = principal + interest (the fee is deducted at
        // disbursement, not repaid via instalments). Total amount = that + fee.
        const totalOfPayments = ld?.totalRepayment ?? round2(approvedAmount * (1 + LOAN_INTEREST_RATE));
        const interest = round2(totalOfPayments - approvedAmount);
        const totalAmount = round2(totalOfPayments + fee);
        const fortnightly = ld?.fortnightlyPayment ?? round2(totalOfPayments / 4);
        const ratePct = Math.round(LOAN_INTEREST_RATE * 1000) / 10; // 4.7

        const rows: Array<{ label: string; value: string; strong?: boolean }> = [
          { label: 'Loan amount', value: fmtNZD(approvedAmount) },
          { label: `Total interest charges (${ratePct}%)`, value: fmtNZD(interest) },
          { label: 'Application fee', value: fmtNZD(fee) },
          { label: 'Total amount', value: fmtNZD(totalAmount), strong: true },
          { label: 'Total amount of payments', value: fmtNZD(totalOfPayments) },
          { label: 'Requested amount', value: fmtNZD(ld?.requestedAmount) },
          { label: 'Approved amount', value: fmtNZD(approvedAmount) },
          { label: 'Fortnightly payment', value: fmtNZD(fortnightly) },
          { label: 'Term', value: '8 weeks · 4 fortnightly payments' },
        ];

        return (
          <SectionCard eyebrow="Loan details" title="What you're agreeing to">
            <dl className="divide-y divide-border-2">
              {rows.map((r) => (
                <div key={r.label} className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                  <dt className="text-sm text-muted">{r.label}</dt>
                  <dd className={`text-sm tabular-nums text-text ${r.strong ? 'font-bold' : 'font-semibold'}`}>
                    {r.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-muted">
              All loans are charged interest. The application fee is deducted from your loan amount at
              disbursement, so you receive {fmtNZD(payout)}.
            </p>
          </SectionCard>
        );
      })()}
    </div>
  );
}
