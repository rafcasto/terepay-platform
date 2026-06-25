import { Hero, HeroBalance, Pill, StatGrid } from '@/components/ui';
import { fmtNZD } from '@/lib/loan/format';
import type { LoanApplication, AnyApplicationStatus, PaymentConsent } from '@/types/application';
import { computeApplicationFee } from '@/lib/constants/fees';
import AcceptOfferButton from '@/app/applicant/applications/[id]/_components/AcceptOfferButton';
import RejectOfferButton from '@/app/applicant/applications/[id]/_components/RejectOfferButton';
import InitiatePaymentConsentCard from '@/app/applicant/applications/[id]/_components/InitiatePaymentConsentCard';
import { SectionCard, Field } from './shared';

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

  let title = 'Your loan is approved 🎉';
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

      <SectionCard eyebrow="Loan details" title="What you're agreeing to">
        <dl className="grid grid-cols-2 gap-4">
          <Field label="Requested amount" value={fmtNZD(ld?.requestedAmount)} />
          <Field label="Approved amount" value={fmtNZD(approvedAmount)} />
          <Field label="Application fee" value={fmtNZD(fee)} />
          {ld?.fortnightlyPayment && (
            <Field label="Fortnightly payment" value={fmtNZD(ld.fortnightlyPayment)} />
          )}
          {ld?.totalRepayment && <Field label="Total repayment" value={fmtNZD(ld.totalRepayment)} />}
          <Field label="Term" value="8 weeks · 4 fortnightly payments" />
        </dl>
      </SectionCard>
    </div>
  );
}
