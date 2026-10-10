import type { AnyApplicationStatus } from '@/types/application';
import { buildSchedule } from './repayment';
import { computeApplicationFee } from '@/lib/constants/fees';

// Display states defined in the design handoff.
// All concrete LMS application statuses map to exactly one of these.
export type LoanDisplayState =
  | 'new'
  | 'draft'
  | 'review'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'paid';

const STATE_BY_STATUS: Record<string, LoanDisplayState> = {
  // draft — application started but not yet submitted by the applicant.
  // The CTA must take the user back to finish the application, not the tracker.
  draft: 'draft',

  // review — application submitted and being processed
  pending_review: 'review',
  under_assessment: 'review',
  waiting_for_docs: 'review',
  credit_check: 'review',
  submitted: 'review',
  under_review: 'review',

  // approved — offer made, awaiting accept / consent
  approved: 'approved',
  loan_accepted: 'approved',
  awaiting_payment_consent: 'approved',

  // rejected — application or offer turned down
  declined: 'rejected',
  rejected: 'rejected',
  offer_declined: 'rejected',
  withdrawn: 'rejected',
  expired: 'rejected',

  // active — disbursed and being repaid
  disbursed: 'active',
  active: 'active',
  funded: 'active',

  // paid — fully closed
  closed_repaid: 'paid',
  completed: 'paid',
};

export function toDisplayState(
  status: AnyApplicationStatus | string | null | undefined,
): LoanDisplayState {
  if (!status) return 'new';
  return STATE_BY_STATUS[status] ?? 'review';
}

// Short, applicant-friendly labels for each LMS status.
export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_review: 'Pending review',
  under_assessment: 'Under assessment',
  waiting_for_docs: 'Documents requested',
  credit_check: 'Credit check',
  approved: 'Approved',
  loan_accepted: 'Offer accepted',
  awaiting_payment_consent: 'Awaiting bank authorisation',
  offer_declined: 'Offer declined',
  disbursed: 'Disbursed',
  active: 'Active',
  closed_repaid: 'Repaid',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  expired: 'Expired',
  submitted: 'Submitted',
  under_review: 'Under review',
  funded: 'Funded',
  completed: 'Completed',
  rejected: 'Declined',
};

// ---------------------------------------------------------------------------
// Repayment math — delegates to the amortisation engine (src/lib/loan/repayment.ts).
// The product is a reducing-balance annuity at 49% p.a. over 4 fortnightly
// instalments. The application fee is deducted from the disbursement and is
// NOT part of the repayment schedule.
// ---------------------------------------------------------------------------

export interface RepaymentBreakdown {
  /** Application fee — deducted from the cash disbursed, not amortised. */
  fee: number;
  interest: number;
  /** Principal + interest. Excludes `fee`. */
  totalRepayable: number;
  /** Level instalment for payments 1-3; the final one is trued up. */
  instalmentAmount: number;
  /** Cash the borrower actually receives (amount − fee). */
  amountReceived: number;
}

/**
 * Headline quote for an amount, used by the marketing calculator and the
 * application form. `isExistingCustomer` selects the $20 / $50 application fee.
 */
export function computeRepayment(
  amount: number,
  isExistingCustomer?: boolean | null,
): RepaymentBreakdown {
  const fee = computeApplicationFee(isExistingCustomer);
  const schedule = buildSchedule({ principal: amount, startDate: new Date() });
  return {
    fee,
    interest: schedule.totalInterest,
    totalRepayable: schedule.totalRepayable,
    instalmentAmount: schedule.fortnightlyPayment,
    amountReceived: Math.max(round2(amount - fee), 0),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Loan product bounds
export const LOAN_MIN = 200;
export const LOAN_MAX = 2000;
export const LOAN_TERM_WEEKS = 8;
export const LOAN_INSTALMENTS = 4;
