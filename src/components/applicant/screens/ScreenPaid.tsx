import { Hero, Pill, ButtonLink, Confetti, StatGrid } from '@/components/ui';
import { fmtNZD, fmtDate } from '@/lib/loan/format';
import type { LoanApplication } from '@/types/application';
import { SectionCard } from './shared';

interface Props {
  app: LoanApplication & Record<string, unknown>;
  applicationId: string;
}

export default function ScreenPaid({ app, applicationId }: Props) {
  const ld = app.loanDetails;
  const repayment = app.repaymentSchedule;
  const refNum = (app.referenceNumber as string | undefined) ?? `#${applicationId.slice(0, 8)}`;
  const closedAt = (app.timeline as { closedAt?: unknown } | undefined)?.closedAt ?? null;

  return (
    <div className="space-y-5">
      <Hero
        state="paid"
        eyebrow={`Loan ${refNum}`}
        emoji="🎉"
        title="Loan fully repaid"
        subtitle="Thanks for repaying on time. You're all squared up."
        pill={
          <Pill tone="success" onInk>
            Complete
          </Pill>
        }
      >
        <div className="relative">
          <Confetti />
          <StatGrid
            stats={[
              { label: 'Total repaid', value: fmtNZD(repayment?.totalRepayment ?? ld?.totalRepayment) },
              { label: 'Closed', value: fmtDate(closedAt as Parameters<typeof fmtDate>[0]) },
            ]}
          />
        </div>
      </Hero>

      <SectionCard eyebrow="Up next" title="Ready for your next loan?">
        <p className="text-sm text-muted mb-4">
          As an existing customer, your application fee is reduced. Re-apply whenever you need.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/applicant/apply">Start a new loan</ButtonLink>
          <ButtonLink href="/applicant/applications" variant="secondary">
            View loan history
          </ButtonLink>
        </div>
      </SectionCard>
    </div>
  );
}
