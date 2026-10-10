/**
 * Affordability assessment row maths — the single source of truth shared by the
 * lender wizard (client) and the submit route (server) so the surplus the lender
 * sees on screen is exactly the surplus that gets persisted.
 *
 * All figures are NZD **per fortnight**, matching what the applicant declares on
 * the application form (income and living expenses are both collected
 * fortnightly) and the level instalment the loan is priced at.
 */
import { fortnightlyPayment } from '@/lib/loan/repayment';

export interface AffordabilityIncomeRowInput {
  /** Fortnightly figure the applicant declared on their application. Reference only. */
  declaredAmount?: number;
  centrixAmount: number;
  verifiedAmount: number;
  adjustment: number;
}

export interface AffordabilityExpenseRowInput {
  /** Fortnightly figure the applicant declared on their application. */
  declaredAmount?: number;
  centrixAmount: number;
  benchmarkAmount: number;
  adjustment: number;
}

/**
 * Income final = MIN(centrix, verified) + adjustment.
 * If only one source has data, use that source + adjustment.
 */
export function calcIncomeFinal(row: AffordabilityIncomeRowInput): number {
  const c = row.centrixAmount;
  const v = row.verifiedAmount;
  let base = 0;
  if (c > 0 && v > 0) base = Math.min(c, v);
  else if (c > 0) base = c;
  else if (v > 0) base = v;
  return Math.max(0, base + row.adjustment);
}

/**
 * Expense final = MAX(observed, benchmark) + adjustment.
 *
 * "Observed" is the Centrix bank-analysis figure once the lender has entered it;
 * until then it falls back to what the applicant declared. Benchmarks act as a
 * floor when the stated spend looks unrealistically low. The adjustment is added
 * on top (Excel logic) — it is NOT part of the MAX.
 */
export function calcExpenseFinal(row: AffordabilityExpenseRowInput): number {
  const observed = row.centrixAmount > 0 ? row.centrixAmount : (row.declaredAmount ?? 0);
  const base = Math.max(observed, row.benchmarkAmount);
  return Math.max(0, base + row.adjustment);
}

/**
 * The fortnightly instalment the borrower will actually be charged for
 * `assessedAmount`, priced identically to the applicant-facing quote
 * (reducing-balance annuity, rate from the effective-dated collections config).
 */
export function affordabilityLoanPayment(assessedAmount: number): number {
  return fortnightlyPayment(assessedAmount);
}
