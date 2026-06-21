import { Hero, HeroBalance, Pill, ProgressBar, ScheduleRow, StatGrid, Icons } from '@/components/ui';
import { fmtNZD, fmtDate } from '@/lib/loan/format';
import type { LoanApplication, AnyApplicationStatus } from '@/types/application';
import { SectionCard, Field } from './shared';

interface Props {
  app: LoanApplication & Record<string, unknown>;
  status: AnyApplicationStatus;
  applicationId: string;
}

export default function ScreenActive({ app, status, applicationId }: Props) {
  const ld = app.loanDetails;
  const repayment = app.repaymentSchedule;
  const refNum = (app.referenceNumber as string | undefined) ?? `#${applicationId.slice(0, 8)}`;
  const isDisbursed = status === 'disbursed';
  const loanId = (app as Record<string, unknown>).loanId as string | undefined;

  const total = repayment?.totalRepayment ?? 0;
  const installments = repayment?.installments ?? [];
  const paidAmount = installments
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + (i.amount ?? 0), 0);
  const remaining = total - paidAmount;
  const repaidPct = total > 0 ? Math.round((paidAmount / total) * 100) : 0;

  const upcoming = installments.find((i) => i.status === 'scheduled');
  const overdue = installments.find((i) => i.status === 'overdue');
  const next = overdue ?? upcoming;

  return (
    <div className="space-y-5">
      <Hero
        eyebrow={`Loan ${refNum}`}
        pill={
          overdue ? (
            <Pill tone="danger" pulse onInk>
              Overdue
            </Pill>
          ) : isDisbursed ? (
            <Pill tone="info" pulse onInk>
              Disbursed
            </Pill>
          ) : (
            <Pill tone="success" pulse onInk>
              On track
            </Pill>
          )
        }
      >
        <p className="text-[11.5px] font-medium tracking-[0.02em] uppercase text-white/60 mb-1">
          Remaining balance
        </p>
        <HeroBalance amount={remaining} />
        <div className="mt-4">
          <ProgressBar value={repaidPct} onInk label="Repayment progress" trailing={`${repaidPct}% repaid`} />
        </div>
        <div className="mt-5">
          <StatGrid
            stats={[
              {
                label: next ? (overdue ? 'Overdue payment' : 'Next payment') : 'Status',
                value: next ? fmtNZD(next.amount) : 'Up to date',
              },
              {
                label: next ? 'Due' : 'Total repayable',
                value: next ? fmtDate(next.dueDate) : fmtNZD(total),
              },
            ]}
          />
        </div>
      </Hero>

      {installments.length > 0 && (
        <SectionCard eyebrow="Schedule" title="Repayments">
          <p className="text-xs text-muted mb-3">
            Each instalment is auto-debited from your bank on its due date — no action needed.
          </p>
          <div className="divide-y divide-border-2">
            {installments.map((i) => {
              const tone = i.status === 'paid' ? 'paid' : i.status === 'overdue' ? 'overdue' : i === next ? 'next' : 'upcoming';
              return (
                <ScheduleRow
                  key={i.installmentNumber}
                  date={i.dueDate}
                  label={`Instalment ${i.installmentNumber}`}
                  amount={fmtNZD(i.amount)}
                  status={tone}
                />
              );
            })}
          </div>
          <div className="mt-4 flex items-baseline justify-between pt-3 border-t border-border-2">
            <span className="text-[11.5px] font-semibold tracking-[0.06em] uppercase text-muted">
              Total repayable
            </span>
            <span className="text-base font-bold tabular-nums">{fmtNZD(total)}</span>
          </div>
        </SectionCard>
      )}

      {loanId && (
        <SectionCard eyebrow="Documents" title="Statement">
          <p className="text-sm text-muted mb-3">
            Download a statement showing all instalments and their current status.
          </p>
          <a
            href={`/api/loans/${loanId}/statement`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 h-11 rounded-xl border border-border bg-surface text-sm font-semibold text-text hover:border-accent/60 hover:bg-accent-soft/40 transition-colors"
          >
            <Icons.Download size={16} />
            Download statement (PDF)
          </a>
        </SectionCard>
      )}

      <SectionCard eyebrow="Loan details" title="Your loan">
        <dl className="grid grid-cols-2 gap-4">
          <Field
            label="Disbursed"
            value={fmtNZD((ld as Record<string, unknown>)?.disbursedAmount as number | undefined)}
          />
          <Field label="Approved amount" value={fmtNZD(ld?.approvedAmount)} />
          {ld?.fortnightlyPayment && (
            <Field label="Fortnightly payment" value={fmtNZD(ld.fortnightlyPayment)} />
          )}
          <Field label="Term" value="8 weeks · 4 fortnightly payments" />
        </dl>
      </SectionCard>
    </div>
  );
}
