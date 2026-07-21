import type Decimal from 'decimal.js';
import type { InterestOnFeesPolicy } from './config';

/**
 * Engine types for the TerePay collections calculation module.
 *
 * The engine (see engine.ts) is a PURE function: it takes a loan + schedule +
 * payments + policy as at a statement date and returns a running ledger, a fee
 * list and an honestly-labelled component breakdown. No DB, no clock, no I/O
 * (NFR-5). Persistence, statement rendering and sign-off gates live outside it.
 */

export type LedgerEntryType =
  | 'principal_open' // opening principal debit on the Loan Access Date
  | 'interest_accrual' // interest accrued but not yet charged (reporting only)
  | 'interest_charge' // fortnightly interest debited into the balance (compounds)
  | 'payment' // credit
  | 'fee' // fee debit
  | 'adjustment'; // correction / reversal (append-only, never in-place edit)

export type FeeType =
  | 'late_payment'
  | 'payment_default'
  | 'early_full_repayment';

/** One append-only entry on the running Borrower Account (DM-4). */
export interface LedgerEntry {
  entryDate: string; // YYYY-MM-DD
  type: LedgerEntryType;
  /** Signed amount: debits positive, credits negative. Full precision. */
  amount: Decimal;
  /** Running balance AFTER this entry. Full precision. */
  runningBalance: Decimal;
  description: string;
  /** Reference to the source object (payment id, instalment #, fee id, …). */
  sourceRef?: string;
}

/** A fee assessment (DM-5). `interestBearing` is frozen from policy at assessment. */
export interface AssessedFee {
  feeType: FeeType;
  amount: Decimal;
  assessedDate: string; // YYYY-MM-DD
  /** Which instalment (1-based) or event triggered this fee. */
  triggerRef: string;
  /** Snapshot of the Rule-7 policy at assessment time (DM-5, FR-13). */
  interestBearing: boolean;
}

/** Schedule row — INFORMATIONAL: used for fee triggering/display, never as an interest base (DM-2). */
export interface ScheduleInstalment {
  sequence: number; // 1-based
  dueDate: string; // YYYY-MM-DD
  instalmentAmount: Decimal;
}

/** An actual receipt (DM-3). Effective date is derived by the engine (FR-8). */
export interface PaymentInput {
  paymentId: string;
  receivedDate: string; // YYYY-MM-DD
  amount: Decimal;
}

/** Complete, self-contained input to the pure engine. */
export interface EngineInput {
  loanId: string;
  clientId: string;
  /** Principal advanced — from the borrower's own Disclosure Statement (CC-5). */
  initialUnpaidBalance: Decimal;
  /** Signing date — interest starts here (Principle 1). */
  loanAccessDate: string; // YYYY-MM-DD
  schedule: ScheduleInstalment[];
  payments: PaymentInput[];
  /** The date the statement/run is computed as at. */
  statementDate: string; // YYYY-MM-DD
  /** Effective interest-on-fees policy for THIS loan (default OFF). */
  interestOnFeesPolicy: InterestOnFeesPolicy;
}

/** Honest, separately-labelled component breakdown (FR-15). */
export interface ComponentBreakdown {
  principalOutstanding: Decimal;
  interestAccruedToDate: Decimal;
  /** Gross interest accrued over the whole life, incl. amounts absorbed by
   *  payments — the 4.7% on-time sanity check (AC-3) is measured against this. */
  totalInterestAccrued: Decimal;
  lateFeeCount: number;
  lateFeesTotal: Decimal;
  defaultFeeTriggered: boolean;
  defaultFee: Decimal;
  earlyRepaymentFee: Decimal;
  /** Interest on fees — always zero when policy = OFF. */
  interestOnFees: Decimal;
  paymentsCredited: Decimal;
  totalOwing: Decimal;
}

/** Complete engine result. */
export interface EngineResult {
  ledger: LedgerEntry[];
  fees: AssessedFee[];
  breakdown: ComponentBreakdown;
  policy: InterestOnFeesPolicy;
  statementDate: string;
}
