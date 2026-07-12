import { EARLY_REPAYMENT_FEE } from '@/lib/constants/fees';
import { deriveLoanSummary, type LoanSummarySource } from './active-loan';
import type { DerivedInstallmentStatus } from './active-loan';

/**
 * The early-repayment payoff figure a borrower must pay to settle their loan in
 * full ahead of schedule.
 *
 * Policy (kept in ONE place so it is easy to audit / tune):
 *   payoff = outstanding balance (sum of not-yet-paid instalments)
 *          + EARLY_REPAYMENT_FEE (fixed admin/prepayment fee)
 *
 * This never charges the borrower more than they already owe on the remaining
 * instalments, plus one disclosed fee — no hidden interest. All money values
 * are returned in both dollars (for display) and cents (for the PayBy call).
 */
export interface EarlyPayoffQuote {
  currency: 'NZD';
  /** Sum of not-yet-paid instalments, in NZD. */
  outstandingBalance: number;
  outstandingBalanceCents: number;
  /** Fixed prepayment/administrative fee, in NZD. */
  prepaymentFee: number;
  prepaymentFeeCents: number;
  /** outstandingBalance + prepaymentFee, in NZD. */
  totalPayoff: number;
  totalPayoffCents: number;
  /** installmentNumbers this payoff would clear. */
  installmentsCleared: number[];
}

/** Instalment statuses that count as already settled (nothing left to pay). */
const SETTLED: ReadonlySet<DerivedInstallmentStatus> = new Set(['paid', 'cancelled']);

function toCents(n: number): number {
  return Math.round(n * 100);
}

/**
 * Compute the early-repayment payoff quote for a live loan, or `null` when there
 * is nothing left to pay off (fully repaid, or no schedule yet).
 */
export function computeEarlyPayoff(app: LoanSummarySource): EarlyPayoffQuote | null {
  const summary = deriveLoanSummary(app);

  const unpaid = summary.installments.filter((i) => !SETTLED.has(i.status));
  if (unpaid.length === 0 || summary.isFullyPaid) return null;

  // The outstanding balance is exactly the instalments the borrower will still
  // be charged: unpaid and not cancelled. We use this rather than
  // `totalRepayable − paid` so a cancelled instalment (e.g. after a revoked
  // mandate) is never billed back to the borrower on payoff.
  const unpaidSum = Math.round(unpaid.reduce((acc, i) => acc + i.amount, 0) * 100) / 100;
  // Guard: never quote more than the derived remaining balance when that is the
  // tighter figure (protects against a schedule that sums above totalRepayable).
  const remaining = summary.remainingBalance;
  const outstandingBalance = Math.max(
    0,
    remaining > 0 ? Math.min(unpaidSum, remaining) : unpaidSum,
  );
  if (outstandingBalance <= 0) return null;

  const prepaymentFee = EARLY_REPAYMENT_FEE;
  const totalPayoff = Math.round((outstandingBalance + prepaymentFee) * 100) / 100;

  return {
    currency: 'NZD',
    outstandingBalance,
    outstandingBalanceCents: toCents(outstandingBalance),
    prepaymentFee,
    prepaymentFeeCents: toCents(prepaymentFee),
    totalPayoff,
    totalPayoffCents: toCents(totalPayoff),
    installmentsCleared: unpaid.map((i) => i.installmentNumber),
  };
}
