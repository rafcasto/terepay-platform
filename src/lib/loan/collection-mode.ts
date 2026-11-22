import type { LoanApplication, PaymentConsent, ScheduledPayment } from '@/types/application';

/**
 * How a given loan's instalments are collected. Decided **per loan**, not by
 * the global `qippay_enabled` flag, so loans written by hand before Qippay was
 * switched on keep being managed by hand afterwards — and Qippay loans are
 * never touched by the manual tooling.
 *
 *   - `qippay` — the borrower has an active SetPay mandate, or at least one
 *     instalment has already been lodged with Qippay (`qippayPaymentId`).
 *     Qippay (webhooks / reconciliation) owns the instalment state.
 *   - `manual` — everything else. The lender records repayments from the
 *     application page and the schedule was written from the approved figures.
 */
export type LoanCollectionMode = 'qippay' | 'manual';

export function loanCollectionMode(
  app: Pick<LoanApplication, 'paymentConsent' | 'scheduledPayments'>,
): LoanCollectionMode {
  const consent = app.paymentConsent as PaymentConsent | undefined;
  if (consent?.status === 'active') return 'qippay';

  const payments = Array.isArray(app.scheduledPayments)
    ? (app.scheduledPayments as ScheduledPayment[])
    : [];
  if (payments.some((p) => Boolean(p.qippayPaymentId))) return 'qippay';

  return 'manual';
}

/** True when Qippay owns this loan's instalment state. */
export function isQippayManagedLoan(
  app: Pick<LoanApplication, 'paymentConsent' | 'scheduledPayments'>,
): boolean {
  return loanCollectionMode(app) === 'qippay';
}
