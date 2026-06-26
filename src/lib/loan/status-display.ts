import type { AnyApplicationStatus } from '@/types/application';

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
// Repayment math (handoff product rules: 8-week, 4 fortnightly instalments, 49% APR)
// ---------------------------------------------------------------------------

export interface RepaymentBreakdown {
  fee: number;
  interest: number;
  totalRepayable: number;
  instalmentAmount: number;
}

export function computeRepayment(amount: number): RepaymentBreakdown {
  const fee = amount < 500 ? 65 : amount < 1000 ? 95 : 125;
  const interest = amount * 0.49 * (8 / 52);
  const totalRepayable = amount + fee + interest;
  const instalmentAmount = totalRepayable / 4;
  return {
    fee: round2(fee),
    interest: round2(interest),
    totalRepayable: round2(totalRepayable),
    instalmentAmount: round2(instalmentAmount),
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
