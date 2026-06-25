import { Hero, Pill, ButtonLink, Confetti, StatGrid, Icons } from '@/components/ui';
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
  const loanId = (app as Record<string, unknown>).loanId as string | undefined;

  return (
    <div className="space-y-5">
      <Hero
        state="paid"
        eyebrow={`Loan ${refNum}`}
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

      {loanId && (
        <SectionCard eyebrow="Documents" title="Keep these for your records">
          <p className="text-sm text-muted mb-4">
            Download your closure letter as proof of repayment, plus a full statement of account.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/loans/${loanId}/closure-letter`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 h-11 rounded-xl bg-accent text-white text-sm font-semibold shadow-[0_2px_8px_rgba(245,166,35,0.25)] hover:bg-accent-2 hover:-translate-y-0.5 transition-all"
            >
              <Icons.Download size={16} />
              Closure letter (PDF)
            </a>
            <a
              href={`/api/loans/${loanId}/statement`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 h-11 rounded-xl border border-border bg-surface text-sm font-semibold text-text hover:border-accent/60 hover:bg-accent-soft/40 transition-colors"
            >
              <Icons.Download size={16} />
              Statement (PDF)
            </a>
          </div>
        </SectionCard>
      )}

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
