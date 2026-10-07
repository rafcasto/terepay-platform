import { LATE_PAYMENT_GRACE_DAYS, PAYMENT_DEFAULT_GRACE_DAYS } from '@/lib/constants/fees';
import type { LoanApplication } from '@/types/application';
import { deriveLoanSummary, isClosedLoanStatus, isLiveLoanStatus } from './active-loan';
import { daysBetween } from './arrears';

/**
 * Pure aggregation behind the lender "Account dashboard": how much money is
 * lent out on active loans versus how much has come back as repayments, and
 * which accounts need attention.
 *
 * No I/O and no clock — the caller passes the applications and today's NZ
 * calendar date. All money is integer cents.
 *
 * Age buckets follow the arrears policy in src/lib/constants/fees.ts and are
 * mutually exclusive, keyed on the loan's oldest unpaid instalment:
 *   - late            1–3 days past due (inside the late-fee grace period)
 *   - overdue         4–7 days past due (late fee applies, not yet in default)
 *   - overdue_7_plus  more than 7 days past due (default fee applies)
 *
 * `insufficient_funds` and `early_payment` are flags and can overlap a bucket.
 *
 * Under- and over-payments are NOT derivable today: instalments are collected
 * as fixed-amount direct debits that either settle in full or fail, and no
 * received amount is stored per instalment.
 */

export type AccountCategory =
  | 'late'
  | 'overdue'
  | 'overdue_7_plus'
  | 'insufficient_funds'
  | 'early_payment';

export const ACCOUNT_CATEGORIES: readonly AccountCategory[] = [
  'late',
  'overdue',
  'overdue_7_plus',
  'insufficient_funds',
  'early_payment',
];

export type AccountDashboardSource = Pick<
  LoanApplication,
  | 'status'
  | 'referenceNumber'
  | 'loanDetails'
  | 'scheduledPayments'
  | 'paymentConsent'
  | 'repaymentSchedule'
  | 'earlyRepayment'
  | 'feeAssessments'
  | 'arrears'
> & { id: string };

export interface AccountRow {
  applicationId: string;
  referenceNumber: string;
  categories: AccountCategory[];
  /** Days past due of the oldest unpaid instalment (0 when nothing is past due). */
  worstDaysPastDue: number;
  /** Sum of unpaid instalments whose due date has passed. */
  pastDueCents: number;
  /** Everything still to be collected on the loan. */
  outstandingCents: number;
}

export interface CategoryTotal {
  count: number;
  amountCents: number;
}

export interface AccountDashboard {
  activeLoanCount: number;
  /** Principal advanced on loans still being repaid. */
  lentCents: number;
  /** Repayments received so far on loans still being repaid. */
  collectedActiveCents: number;
  /** Still to be collected on loans still being repaid (principal + interest). */
  outstandingCents: number;
  /** Repayments received across every loan, including closed ones. */
  collectedAllTimeCents: number;
  /** Unpaid instalments whose due date has passed, across active loans. */
  pastDueCents: number;
  categories: Record<AccountCategory, CategoryTotal>;
  /** Active accounts in at least one arrears category, worst first. */
  attention: AccountRow[];
}

const toCents = (nzd: number): number => Math.round(nzd * 100);

function ageBucket(daysPastDue: number): AccountCategory | null {
  if (daysPastDue <= 0) return null;
  if (daysPastDue <= LATE_PAYMENT_GRACE_DAYS) return 'late';
  if (daysPastDue <= PAYMENT_DEFAULT_GRACE_DAYS) return 'overdue';
  return 'overdue_7_plus';
}

/**
 * Cash actually received on a loan. `deriveLoanSummary` already counts an
 * early payoff at the amount the borrower paid (not instalment face value).
 */
function collectedCents(app: AccountDashboardSource): number {
  return toCents(deriveLoanSummary(app).totalPaid);
}

export function buildAccountDashboard(
  apps: AccountDashboardSource[],
  today: string,
): AccountDashboard {
  const categories = Object.fromEntries(
    ACCOUNT_CATEGORIES.map((c) => [c, { count: 0, amountCents: 0 }]),
  ) as Record<AccountCategory, CategoryTotal>;

  const dashboard: AccountDashboard = {
    activeLoanCount: 0,
    lentCents: 0,
    collectedActiveCents: 0,
    outstandingCents: 0,
    collectedAllTimeCents: 0,
    pastDueCents: 0,
    categories,
    attention: [],
  };

  for (const app of apps) {
    const live = isLiveLoanStatus(app.status);
    if (!live && !isClosedLoanStatus(app.status)) continue;

    const collected = collectedCents(app);
    dashboard.collectedAllTimeCents += collected;

    if (app.earlyRepayment?.status === 'paid') {
      categories.early_payment.count += 1;
      categories.early_payment.amountCents += app.earlyRepayment.quote?.totalPayoffCents ?? 0;
    }

    if (!live) continue;

    const summary = deriveLoanSummary(app);
    const outstandingCents = toCents(summary.remainingBalance);

    dashboard.activeLoanCount += 1;
    dashboard.lentCents += toCents(
      app.loanDetails?.approvedAmount ?? app.loanDetails?.disbursedAmount ?? 0,
    );
    dashboard.collectedActiveCents += collected;
    dashboard.outstandingCents += outstandingCents;

    const unpaid = summary.installments.filter(
      (i) => i.status !== 'paid' && i.status !== 'cancelled',
    );
    const pastDue = unpaid
      .map((i) => ({ inst: i, days: daysBetween(i.dueDate, today) }))
      .filter((o) => o.days > 0);
    const pastDueCents = pastDue.reduce((sum, o) => sum + toCents(o.inst.amount), 0);
    const worstDaysPastDue = pastDue.reduce((max, o) => Math.max(max, o.days), 0);
    const bounced = unpaid.filter((i) => i.status === 'failed' || i.status === 'retrying');

    dashboard.pastDueCents += pastDueCents;

    const rowCategories: AccountCategory[] = [];
    const bucket = ageBucket(worstDaysPastDue);
    if (bucket) {
      rowCategories.push(bucket);
      categories[bucket].count += 1;
      categories[bucket].amountCents += pastDueCents;
    }
    if (bounced.length > 0) {
      rowCategories.push('insufficient_funds');
      categories.insufficient_funds.count += 1;
      categories.insufficient_funds.amountCents += bounced.reduce(
        (sum, i) => sum + toCents(i.amount),
        0,
      );
    }

    if (rowCategories.length > 0) {
      dashboard.attention.push({
        applicationId: app.id,
        referenceNumber: app.referenceNumber ?? app.id,
        categories: rowCategories,
        worstDaysPastDue,
        pastDueCents,
        outstandingCents,
      });
    }
  }

  dashboard.attention.sort(
    (a, b) => b.worstDaysPastDue - a.worstDaysPastDue || b.pastDueCents - a.pastDueCents,
  );

  return dashboard;
}
