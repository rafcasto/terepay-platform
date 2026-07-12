export const APPLICATION_FEE_NEW = 50;
export const APPLICATION_FEE_EXISTING = 20;
export const LOAN_INTEREST_RATE = 0.047;

/**
 * Fixed administrative fee charged when a borrower repays their loan early in
 * full (advance / prepayment). Covers the admin cost of settling the loan
 * ahead of its scheduled term. Disclosed to the borrower before they consent.
 */
export const EARLY_REPAYMENT_FEE = 25;

/** Version tag for the early-repayment disclaimer copy the borrower agrees to. */
export const EARLY_REPAYMENT_DISCLAIMER_VERSION = '2026-07-v1';

export function computeApplicationFee(isExistingCustomer: boolean | undefined | null): number {
  return isExistingCustomer ? APPLICATION_FEE_EXISTING : APPLICATION_FEE_NEW;
}
