import { Hero, HeroBalance, Pill, ProgressBar, StatGrid, ButtonLink, Confetti } from '@/components/ui';
import { fmtDate, fmtNZD, daysUntil } from '@/lib/loan/format';
import type { LoanDisplayState } from '@/lib/loan/status-display';

export type DashboardHeroData = {
  state: LoanDisplayState;
  // active / paid
  loan?: {
    remainingBalance: number;
    totalPaid: number;
    nextPaymentDate: string;
    isDelinquent?: boolean;
    /** Active loan's application id — links straight to its repayment schedule. */
    applicationId?: string;
  };
  // draft / review / approved / rejected
  application?: {
    id: string;
    referenceNumber?: string;
    requestedAmount?: number;
    approvedAmount?: number;
    submittedAt?: string | null;
  };
};

export default function LoanHero({ data, firstName }: { data: DashboardHeroData; firstName?: string | null }) {
  if (data.state === 'active' && data.loan) {
    const { remainingBalance, totalPaid, nextPaymentDate, isDelinquent, applicationId } = data.loan;
    const total = totalPaid + remainingBalance;
    const repaidPct = total > 0 ? Math.round((totalPaid / total) * 100) : 0;
    const dleft = daysUntil(nextPaymentDate);
    return (
      <Hero
        eyebrow={isDelinquent ? 'Payment missed' : 'Active loan balance'}
        subtitle={
          isDelinquent
            ? "Your last instalment didn't go through. We'll keep retrying — make sure funds are available in your account."
            : undefined
        }
        pill={
          isDelinquent ? (
            <Pill tone="danger" pulse onInk>
              Late
            </Pill>
          ) : (
            <Pill tone="success" pulse onInk>
              On track
            </Pill>
          )
        }
      >
        <HeroBalance amount={remainingBalance} />
        <div className="mt-4">
          <ProgressBar
            value={repaidPct}
            onInk
            label="Repayment progress"
            trailing={`${repaidPct}% repaid`}
          />
        </div>
        <div className="mt-5">
          <StatGrid
            stats={[
              { label: 'Next payment', value: fmtDate(nextPaymentDate) },
              { label: 'Repaid so far', value: fmtNZD(totalPaid) },
            ]}
          />
        </div>
        {typeof dleft === 'number' && dleft >= 0 && dleft <= 14 && !isDelinquent && (
          <p className="mt-4 text-[12.5px] text-white/60">
            Next payment in {dleft === 0 ? 'today' : `${dleft} day${dleft === 1 ? '' : 's'}`}.
          </p>
        )}
        {applicationId && (
          <div className="mt-5">
            <ButtonLink href={`/applicant/applications/${applicationId}`} variant="ghost-light" fullWidth>
              View repayment schedule
            </ButtonLink>
          </div>
        )}
      </Hero>
    );
  }

  if (data.state === 'paid' && data.loan) {
    return (
      <Hero
        state="paid"
        eyebrow="Loan complete"
        title={`Loan repaid${firstName ? `, ${firstName}` : ''}`}
        subtitle="Thanks for repaying on time. You're all set."
        pill={
          <Pill tone="success" onInk>
            Repaid
          </Pill>
        }
      >
        <div className="relative">
          <Confetti />
          <StatGrid
            stats={[
              { label: 'Total repaid', value: fmtNZD(data.loan.totalPaid + data.loan.remainingBalance) },
            ]}
            columns={2}
          />
        </div>
      </Hero>
    );
  }

  if (data.state === 'draft') {
    const requested = data.application?.requestedAmount;
    return (
      <Hero
        eyebrow="Application in progress"
        title="Finish your application"
        subtitle="You've started a loan application but haven't submitted it yet. Pick up right where you left off — it only takes a few minutes."
        pill={
          <Pill tone="amber" pulse onInk>
            Not submitted
          </Pill>
        }
      >
        {requested ? (
          <StatGrid
            stats={[{ label: 'Requested', value: fmtNZD(requested) }]}
            columns={2}
          />
        ) : null}
        <div className="mt-5">
          <ButtonLink href="/applicant/apply" fullWidth>
            Continue your application
          </ButtonLink>
        </div>
        <p className="mt-3 text-[12px] text-white/60">
          All loans are charged interest and fees. Applications can be declined.
        </p>
      </Hero>
    );
  }

  if (data.state === 'approved' && data.application) {
    return (
      <Hero
        state="approved"
        eyebrow="Loan approved"
        title="Your loan is approved"
        subtitle="Review your offer and one-tap accept on the loan tracker."
        pill={
          <Pill tone="success" pulse onInk>
            Approved
          </Pill>
        }
      >
        <StatGrid
          stats={[
            {
              label: 'Approved',
              value: data.application.approvedAmount
                ? fmtNZD(data.application.approvedAmount)
                : fmtNZD(data.application.requestedAmount),
            },
            { label: 'Ref', value: data.application.referenceNumber ?? '—' },
          ]}
        />
        <div className="mt-5">
          <ButtonLink href={`/applicant/applications/${data.application.id}`} fullWidth>
            Review offer
          </ButtonLink>
        </div>
      </Hero>
    );
  }

  if (data.state === 'review' && data.application) {
    return (
      <Hero
        eyebrow="Application in review"
        title="We're processing your loan"
        subtitle="A lender is reviewing your application. We'll notify you when there's an update."
        pill={
          <Pill tone="amber" pulse onInk>
            In review
          </Pill>
        }
      >
        <StatGrid
          stats={[
            { label: 'Requested', value: fmtNZD(data.application.requestedAmount) },
            { label: 'Submitted', value: fmtDate(data.application.submittedAt) },
          ]}
        />
        <div className="mt-5">
          <ButtonLink href={`/applicant/applications/${data.application.id}`} variant="ghost-light" fullWidth>
            Track progress
          </ButtonLink>
        </div>
      </Hero>
    );
  }

  if (data.state === 'rejected' && data.application) {
    return (
      <Hero
        state="rejected"
        eyebrow="Application outcome"
        title="We couldn't approve this time"
        subtitle="Don't worry — you can review the details and try again when you're ready."
        pill={
          <Pill tone="danger" onInk>
            Declined
          </Pill>
        }
      >
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/applicant/applications/${data.application.id}`} variant="ghost-light">
            See details
          </ButtonLink>
          <ButtonLink href="/applicant/apply">Apply again</ButtonLink>
        </div>
      </Hero>
    );
  }

  // state === 'new'
  return (
    <Hero
      eyebrow="No active loan"
      title="Start a TerePay loan"
      subtitle="Borrow $200 – $2,000 · 8 weeks · 4 fortnightly instalments."
    >
      <ButtonLink href="/applicant/apply" fullWidth>
        Apply for a loan
      </ButtonLink>
    </Hero>
  );
}
