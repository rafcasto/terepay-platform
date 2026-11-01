import ConsolePill from '@/components/lender/ConsolePill';
import { Card } from './Card';
import type { RepaymentPlanView } from './review-types';

const TH = 'py-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]';

/**
 * Read-only fortnightly repayment breakdown shown to the lender once a loan is
 * approved and before it is disbursed. Manual repayment mode only — the page
 * omits `repaymentPlan` while Qippay is on, since the SetPay mandate sets the
 * schedule at disbursement. Repayments are recorded against the live schedule
 * (ManualPaymentsPanel) after disbursement, not here.
 */
export default function RepaymentPlanCard({ plan }: { plan: RepaymentPlanView }) {
  return (
    <Card title="Repayment breakdown" icon="calendar" action={<ConsolePill tone="info">Indicative</ConsolePill>}>
      <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Principal" value={plan.principal} />
        <Stat label="Per fortnight" value={plan.fortnightlyPayment} />
        <Stat label={`Interest (${plan.annualRate} p.a.)`} value={plan.totalInterest} />
        <Stat label="Total repayable" value={plan.totalRepayable} strong />
      </dl>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              <th className={`${TH} text-left`}>#</th>
              <th className={`${TH} text-left`}>Due</th>
              <th className={`${TH} text-right`}>Amount</th>
              <th className={`${TH} hidden text-right sm:table-cell`}>Interest</th>
              <th className={`${TH} hidden text-right sm:table-cell`}>Principal</th>
              <th className={`${TH} hidden text-right sm:table-cell`}>Balance after</th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((r) => (
              <tr key={r.installmentNumber} className="border-b border-[var(--border-subtle)] last:border-b-0">
                <td className="py-2.5 text-[var(--text-muted)]">{r.installmentNumber}</td>
                <td className="py-2.5 text-[var(--text-body)]">{r.dueDate}</td>
                <td className="py-2.5 text-right font-mono font-semibold tabular-nums text-[var(--text-strong)]">
                  {r.amount}
                </td>
                <td className="hidden py-2.5 text-right font-mono tabular-nums text-[var(--text-muted)] sm:table-cell">
                  {r.interest}
                </td>
                <td className="hidden py-2.5 text-right font-mono tabular-nums text-[var(--text-muted)] sm:table-cell">
                  {r.principal}
                </td>
                <td className="hidden py-2.5 text-right font-mono tabular-nums text-[var(--text-muted)] sm:table-cell">
                  {r.closingBalance}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="pt-2.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                Total
              </td>
              <td className="pt-2.5 text-right font-mono font-bold tabular-nums text-[var(--text-strong)]">
                {plan.totalRepayable}
              </td>
              <td className="hidden sm:table-cell" colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-3 text-[11px] leading-snug text-[var(--text-muted)]">
        {plan.instalments} fortnightly instalments from {plan.anchoredOn}. Due dates are indicative and
        are set from the disbursement date once funds are released. Amounts are fixed by the approved
        loan and cannot be edited; repayments are recorded against the schedule after disbursement.
      </p>
    </Card>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--slate-50)] p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{label}</dt>
      <dd
        className={`mt-1 font-mono tabular-nums ${
          strong ? 'font-bold text-[var(--text-strong)]' : 'font-semibold text-[var(--text-body)]'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
