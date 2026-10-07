import { Hero, Pill, ButtonLink, Confetti, StatGrid, Icons } from '@/components/ui';
import { fmtNZD, fmtDate, fmtYmd } from '@/lib/loan/format';
import { deriveLoanSummary } from '@/lib/loan/active-loan';
import type { LoanApplication } from '@/types/application';
import { SectionCard } from './shared';

interface Props {
  app: LoanApplication & Record<string, unknown>;
  applicationId: string;
}

export default function ScreenPaid({ app, applicationId }: Props) {
  const refNum = (app.referenceNumber as string | undefined) ?? `#${applicationId.slice(0, 8)}`;
  const closedAt = (app.timeline as { closedAt?: unknown } | undefined)?.closedAt ?? null;
  const loanId = (app as Record<string, unknown>).loanId as string | undefined;

  // One source of truth for what the loan cost and what was actually paid —
  // an early payoff counts at the amount paid, not the contractual total.
  const summary = deriveLoanSummary(app);
  const { ledger, settlement, settledEarly } = summary;
  const hadArrears = ledger.lateFees + ledger.defaultFee + ledger.overdueInterest > 0;

  const closedLabel = settlement?.settledAt
    ? fmtDate(settlement.settledAt)
    : settlement?.settlementDate
      ? fmtYmd(settlement.settlementDate)
      : fmtDate(closedAt as Parameters<typeof fmtDate>[0]);

  const subtitle = settledEarly
    ? `You settled early on ${closedLabel}. Interest stopped that day, so you paid less than the scheduled total.`
    : hadArrears
      ? 'Your loan is repaid in full, including the late fees and interest charged while it was overdue.'
      : "Thanks for repaying on time. You're all squared up.";

  return (
    <div className="space-y-5">
      <Hero
        state="paid"
        eyebrow={`Loan ${refNum}`}
        title="Loan fully repaid"
        subtitle={subtitle}
        pill={
          <Pill tone="success" onInk>
            {settledEarly ? 'Settled early' : 'Complete'}
          </Pill>
        }
      >
        <div className="relative">
          <Confetti />
          <StatGrid
            stats={[
              { label: 'Total repaid', value: fmtNZD(summary.totalPaid) },
              { label: settledEarly ? 'Settled' : 'Closed', value: closedLabel },
            ]}
          />
        </div>
      </Hero>

      <SectionCard eyebrow="Breakdown" title="What your loan cost">
        <dl className="divide-y divide-border-2 text-sm">
          {ledger.lines.map((line) => (
            <div key={line.id} className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-muted">
                {line.label}
                {(line.date || line.note) && (
                  <span className="block text-xs">
                    {line.date ? fmtDate(line.date) : null}
                    {line.date && line.note ? ' · ' : null}
                    {line.note}
                  </span>
                )}
              </dt>
              <dd
                className={`font-semibold tabular-nums whitespace-nowrap ${
                  line.amount < 0 ? 'text-success' : 'text-text'
                }`}
              >
                {line.amount < 0 ? `−${fmtNZD(-line.amount)}` : fmtNZD(line.amount)}
              </dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between py-2.5">
            <dt className="text-[11.5px] font-semibold tracking-[0.06em] uppercase text-muted">
              Total paid
            </dt>
            <dd className="text-base font-bold tabular-nums">{fmtNZD(ledger.totalPaid)}</dd>
          </div>
        </dl>
        {settledEarly && settlement && (
          <p className="mt-3 text-xs text-muted">
            Your early settlement of {fmtNZD(settlement.amountPaid)} covered the principal still owed
            {typeof settlement.outstandingPrincipal === 'number'
              ? ` (${fmtNZD(settlement.outstandingPrincipal)})`
              : ''}
            {typeof settlement.accruedInterest === 'number' && typeof settlement.accrualDays === 'number'
              ? `, ${settlement.accrualDays} day${settlement.accrualDays === 1 ? '' : 's'} of interest since your last instalment (${fmtNZD(settlement.accruedInterest)})`
              : ''}
            , the {fmtNZD(settlement.fee)} early repayment fee
            {settlement.arrearsCharges > 0
              ? ` and ${fmtNZD(settlement.arrearsCharges)} in late fees and overdue interest already charged`
              : ''}
            . Interest of {fmtNZD(settlement.interestRebate)} that would have applied over the rest of the
            term was not charged.
          </p>
        )}
      </SectionCard>

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
        </div>
      </SectionCard>
    </div>
  );
}
