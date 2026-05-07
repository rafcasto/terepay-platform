export const APPLICATION_FEE_NEW = 50;
export const APPLICATION_FEE_EXISTING = 20;
export const LOAN_INTEREST_RATE = 0.047;

export function computeApplicationFee(isExistingCustomer: boolean | undefined | null): number {
  return isExistingCustomer ? APPLICATION_FEE_EXISTING : APPLICATION_FEE_NEW;
}
