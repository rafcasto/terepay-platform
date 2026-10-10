export const APPLICATION_FEE_NEW = 50;
export const APPLICATION_FEE_EXISTING = 20;

/**
 * Fixed administrative fee charged when a borrower repays their loan early in
 * full (advance / prepayment). Covers the admin cost of settling the loan
 * ahead of its scheduled term. Disclosed to the borrower before they consent.
 */
export const EARLY_REPAYMENT_FEE = 25;

/** Version tag for the early-repayment disclaimer copy the borrower agrees to. */
export const EARLY_REPAYMENT_DISCLAIMER_VERSION = '2026-07-v1';

// ---------------------------------------------------------------------------
// Default / arrears fees (NZD). Charged by the arrears engine on missed
// instalments — see src/lib/loan/arrears.ts. Disclosed in the loan contract.
// These apply ONLY to loans disbursed under FEE_POLICY_VERSION (future loans);
// loans disbursed before this policy carry no stamp and are never assessed.
// ---------------------------------------------------------------------------

/** Late Payment Fee charged per missed instalment once the grace period lapses. */
export const LATE_PAYMENT_FEE = 10;
/**
 * Calendar-day grace after an instalment's due date before the Late Payment
 * Fee applies. Due 1 Aug + 3-day grace → paying on 1–4 Aug incurs no fee; the
 * fee applies from 5 Aug (i.e. once daysPastDue > LATE_PAYMENT_GRACE_DAYS).
 */
export const LATE_PAYMENT_GRACE_DAYS = 3;
/**
 * Maximum total Late Payment Fees chargeable over the life of a loan. The
 * TerePay product is 4 fortnightly instalments, so 4 × $10 = $40 is the cap.
 */
export const LATE_PAYMENT_FEE_MAX = 40;

/**
 * One-off Payment Default Fee, charged in addition to the Late Payment Fee when
 * an instalment remains unpaid past the default grace period. Charged at most
 * once over the life of a loan, even if further instalments are missed.
 */
export const PAYMENT_DEFAULT_FEE = 25;
/** Calendar-day grace before the one-off Payment Default Fee applies. */
export const PAYMENT_DEFAULT_GRACE_DAYS = 7;

/**
 * Fixed annual interest rate (49%). Loans are priced as a reducing-balance
 * annuity at this rate — see src/lib/loan/repayment.ts, which reads the rate
 * from the effective-dated collections config. Over an on-time 8-week term the
 * total interest works out at ~4.74% of the initial balance ($47.42 per
 * $1,000), which is the sanity check the collections engine asserts (AC-3).
 * The same rate drives post-default daily accrual on the outstanding balance.
 */
export const ANNUAL_INTEREST_RATE = 0.49;
/** Daily interest rate = annual / 365 (CCCFA daily-balance method). */
export const DAILY_INTEREST_RATE = ANNUAL_INTEREST_RATE / 365;

/**
 * Version stamped on a loan at disbursement. The arrears engine assesses late /
 * default fees and post-default interest ONLY for loans carrying this stamp, so
 * the new fee policy applies to future loans only (never retroactively).
 */
export const FEE_POLICY_VERSION = '2026-07-v1';

export function computeApplicationFee(isExistingCustomer: boolean | undefined | null): number {
  return isExistingCustomer ? APPLICATION_FEE_EXISTING : APPLICATION_FEE_NEW;
}
