import Decimal from 'decimal.js';
import type { InterestOnFeesPolicy } from './config';
import { assertYmd, shiftYmd } from './dates';
import type { EngineInput, ScheduleInstalment, PaymentInput } from './types';

/**
 * Pure mapping from a loan snapshot to the engine input (CC-5, NFR-6).
 *
 * The service layer reads the loanApplication doc and flattens it into a plain
 * `LoanSnapshot` (no Firestore types), then calls `mapToEngineInput`. Keeping
 * this pure makes the fail-closed / principal-sourcing rules unit-testable.
 */

export interface LoanSnapshot {
  loanId?: string;
  clientId?: string; // TERE0XX — also the payment reference
  borrowerName?: string;
  /** Principal advanced, from the borrower's own Disclosure Statement (CC-5). */
  approvedAmount?: number;
  /** Total of scheduled payments — used only for the CC-5 approximation fallback. */
  totalRepayment?: number;
  /** Signing / access date (interest starts here). */
  loanAccessDate?: string; // YYYY-MM-DD
  schedule: Array<{ sequence: number; dueDate: string; instalmentAmount: number }>;
  payments?: Array<{ paymentId: string; receivedDate: string; amount: number }>;
}

export interface MappingResult {
  input: EngineInput;
  /** Whether the principal came from the Disclosure Statement or was approximated. */
  principalSourcing: 'disclosed' | 'approximated';
  warnings: string[];
  /** Fail closed: issuance is blocked until a human resolves every blockReason. */
  blockIssuance: boolean;
  blockReasons: string[];
}

/** On-time interest fraction used for the CC-5 principal approximation. */
const APPROX_DIVISOR = new Decimal('1.047');

export function mapToEngineInput(
  snap: LoanSnapshot,
  statementDate: string,
  policy: InterestOnFeesPolicy,
): MappingResult {
  const warnings: string[] = [];
  const blockReasons: string[] = [];

  assertYmd('statementDate', statementDate);

  if (!snap.schedule || snap.schedule.length === 0) {
    throw new Error('Cannot map a loan with no payment schedule (fail closed — NFR-6)');
  }
  const schedule: ScheduleInstalment[] = [...snap.schedule]
    .sort((a, b) => a.sequence - b.sequence)
    .map((s) => ({
      sequence: s.sequence,
      dueDate: assertYmd(`instalment ${s.sequence} dueDate`, s.dueDate),
      instalmentAmount: new Decimal(s.instalmentAmount),
    }));

  // --- CC-3 identity presence (verification against the signed doc is CC-3 in service) ---
  if (!snap.clientId) blockReasons.push('Missing Client ID — cannot verify borrower identity (CC-3).');
  if (!snap.loanId) blockReasons.push('Missing Loan ID — cannot verify borrower identity (CC-3).');

  // --- CC-5 Initial Unpaid Balance sourcing ---
  let initialUnpaidBalance: Decimal;
  let principalSourcing: 'disclosed' | 'approximated';
  if (typeof snap.approvedAmount === 'number' && snap.approvedAmount > 0) {
    initialUnpaidBalance = new Decimal(snap.approvedAmount);
    principalSourcing = 'disclosed';
  } else if (typeof snap.totalRepayment === 'number' && snap.totalRepayment > 0) {
    initialUnpaidBalance = new Decimal(snap.totalRepayment).div(APPROX_DIVISOR).toDecimalPlaces(2);
    principalSourcing = 'approximated';
    warnings.push(
      `Initial Unpaid Balance approximated as totalRepayment ÷ 1.047 = ${initialUnpaidBalance.toFixed(2)} (CC-5).`,
    );
    blockReasons.push('Principal is an approximation — confirm against the signed Disclosure Statement before issuing (CC-5).');
  } else {
    throw new Error('No Initial Unpaid Balance and no total to approximate from (fail closed — CC-5/NFR-6).');
  }

  // --- Loan Access Date (interest start) ---
  let loanAccessDate: string;
  if (snap.loanAccessDate) {
    loanAccessDate = assertYmd('loanAccessDate', snap.loanAccessDate);
  } else {
    // Fallback: the TerePay product schedules the first instalment 14 days out.
    loanAccessDate = shiftYmd(schedule[0].dueDate, -14);
    warnings.push(`Loan Access Date not recorded — approximated as first due date − 14 days = ${loanAccessDate}.`);
    blockReasons.push('Loan Access Date approximated — confirm the signing date before issuing (Principle 1).');
  }

  const payments: PaymentInput[] = (snap.payments ?? []).map((p, i) => ({
    paymentId: p.paymentId || `payment_${i + 1}`,
    receivedDate: assertYmd(`payment ${i + 1} receivedDate`, p.receivedDate),
    amount: new Decimal(p.amount),
  }));

  const input: EngineInput = {
    loanId: snap.loanId ?? '',
    clientId: snap.clientId ?? '',
    initialUnpaidBalance,
    loanAccessDate,
    schedule,
    payments,
    statementDate,
    interestOnFeesPolicy: policy,
  };

  return {
    input,
    principalSourcing,
    warnings,
    blockIssuance: blockReasons.length > 0,
    blockReasons,
  };
}
