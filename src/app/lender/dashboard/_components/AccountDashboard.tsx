import Link from 'next/link';
import ConsolePill, { type PillTone } from '@/components/lender/ConsolePill';
import { fmtNZD } from '@/lib/loan/format';
import type { AccountCategory, AccountDashboard as AccountDashboardData } from '@/lib/loan/account-dashboard';

const money = (cents: number) => fmtNZD(cents / 100);

const CATEGORY_META: Record<AccountCategory, { label: string; desc: string; tone: PillTone }> = {
  late: { label: 'Late payment', desc: '1–3 days past due, inside the grace period', tone: 'info' },
  overdue: { label: 'Overdue', desc: '4–7 days past due, late fee applies', tone: 'warning' },
  overdue_7_plus: { label: 'Overdue 7+ days', desc: 'More than 7 days past due, default fee applies', tone: 'danger' },
  insufficient_funds: { label: 'Insufficient funds', desc: 'Direct debit failed or is being retried', tone: 'danger' },
  early_payment: { label: 'Early payments', desc: 'Loans settled early in full', tone: 'success' },
};

const CATEGORY_ORDER: AccountCategory[] = [
  'late',
  'overdue',
  'overdue_7_plus',
  'insufficient_funds',
  'early_payment',
];

// Not derivable yet: instalments are fixed-amount debits with no received amount stored.
const UNTRACKED = [
  { label: 'Under payment', desc: 'Paid less than the instalment due' },
  { label: 'Over payments', desc: 'Paid more than the instalment due' },
];

const CARD = 'rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white shadow-[var(--shadow-xs)]';

export default function AccountDashboard({ data }: { data: AccountDashboardData }) {
  const repayable = data.collectedActiveCents + data.outstandingCents;
  const repaidPct = repayable > 0 ? Math.round((data.collectedActiveCents / repayable) * 100) : 0;

  const figures = [
    {
      label: 'Lent on active loans',
      value: money(data.lentCents),
      sub: `${data.activeLoanCount} active ${data.activeLoanCount === 1 ? 'loan' : 'loans'}, principal advanced`,
    },
    {
      label: 'Repayments received',
      value: money(data.collectedActiveCents),
      sub: `On active loans · ${money(data.collectedAllTimeCents)} all time`,
    },
    {
      label: 'Still to collect',
      value: money(data.outstandingCents),
      sub: 'Principal and interest outstanding',
    },
    {
      label: 'Past due',
      value: money(data.pastDueCents),
      sub: 'Unpaid instalments past their due date',
    },
  ];

  return (
    <>
      {/* Money out vs money back */}
      <div className={`mb-[18px] ${CARD}`}>
        <div className="border-b border-[var(--border-subtle)] px-5 py-[15px]">
          <h2 className="m-0 font-display text-[15px] font-semibold text-[var(--text-strong)]">
            Money lent vs repayments received
          </h2>
        </div>
        <div className="grid gap-5 p-5 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
          {figures.map((f) => (
            <div key={f.label}>
              <p className="text-[12.5px] font-medium text-[var(--text-muted)]">{f.label}</p>
              <p className="mt-1.5 font-tabular text-[22px] font-semibold leading-none text-[var(--text-strong)]">
                {f.value}
              </p>
              <p className="mt-1.5 text-[12.5px] text-[var(--text-muted)]">{f.sub}</p>
            </div>
          ))}
        </div>
        <div className="px-5 pb-5">
          <div
            role="img"
            aria-label={`${repaidPct}% of the amount repayable on active loans has been received`}
            className="h-2.5 overflow-hidden rounded-full bg-[var(--slate-100)]"
          >
            <div className="h-full rounded-full bg-[var(--success-500)]" style={{ width: `${repaidPct}%` }} />
          </div>
          <div className="mt-2 flex justify-between gap-3 text-[12.5px] text-[var(--text-muted)]">
            <span>{repaidPct}% repaid</span>
            <span>{money(repayable)} repayable on active loans</span>
          </div>
        </div>
      </div>

      {/* Account categories */}
      <div className={`mb-[18px] ${CARD}`}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-[15px]">
          <h2 className="m-0 font-display text-[15px] font-semibold text-[var(--text-strong)]">Account dashboard</h2>
          <Link href="/lender/portfolio" className="shrink-0 text-sm font-semibold text-[var(--orange-700)] hover:underline">
            View portfolio →
          </Link>
        </div>
        <div className="grid gap-3 p-5 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
          {CATEGORY_ORDER.map((c) => {
            const meta = CATEGORY_META[c];
            const total = data.categories[c];
            return (
              <div key={c} className="rounded-[10px] bg-[var(--surface-sunken)] px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <ConsolePill tone={meta.tone} dot>{meta.label}</ConsolePill>
                  <span className="font-display text-lg font-bold text-[var(--text-strong)]">{total.count}</span>
                </div>
                <p className="mt-2 font-tabular text-sm font-medium text-[var(--text-strong)]">{money(total.amountCents)}</p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">{meta.desc}</p>
              </div>
            );
          })}
          {UNTRACKED.map((u) => (
            <div key={u.label} className="rounded-[10px] border border-dashed border-[var(--border-default)] px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <ConsolePill tone="neutral">{u.label}</ConsolePill>
                <span className="font-display text-lg font-bold text-[var(--text-muted)]">—</span>
              </div>
              <p className="mt-2 text-sm font-medium text-[var(--text-muted)]">Not tracked yet</p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{u.desc}</p>
            </div>
          ))}
        </div>

        {data.attention.length > 0 && (
          <ul className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
            {data.attention.slice(0, 8).map((row) => (
              <li
                key={row.applicationId}
                className="flex flex-col gap-2 px-5 py-3.5 transition-colors hover:bg-[var(--orange-50)] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-medium text-[var(--text-strong)]">{row.referenceNumber}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {row.worstDaysPastDue > 0
                      ? `${money(row.pastDueCents)} past due · ${row.worstDaysPastDue} ${row.worstDaysPastDue === 1 ? 'day' : 'days'}`
                      : 'Debit being retried'}
                    {' · '}
                    {money(row.outstandingCents)} outstanding
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {row.categories.map((c) => (
                    <ConsolePill key={c} tone={CATEGORY_META[c].tone} dot>{CATEGORY_META[c].label}</ConsolePill>
                  ))}
                  <Link
                    href={`/lender/applications/${row.applicationId}`}
                    className="ml-1 text-xs font-semibold text-[var(--orange-700)] hover:underline"
                  >
                    View →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
