import Decimal from 'decimal.js';
import { configForDate } from './config';
import { assertYmd, daysBetween, shiftYmd } from './dates';
import { toCents } from './money';
import type {
  AssessedFee,
  ComponentBreakdown,
  EngineInput,
  EngineResult,
  LedgerEntry,
  PaymentInput,
} from './types';

/**
 * TerePay collections calculation engine — PURE, deterministic, no I/O (NFR-3, NFR-5).
 *
 * Implements the CCCFA rules in Collection Agent/CLAUDE.md:
 *   • Interest on the UNPAID DAILY BALANCE from the Loan Access Date (Principle 1).
 *   • Instalments already include interest — NEVER an interest base (Principle 2).
 *   • ONE running principal-plus-interest ledger, not per-instalment (Principle 3).
 *   • Unpaid Balance = debits − credits (Principle 4).
 *
 * There is deliberately NO code path that multiplies an instalment amount or a
 * shortfall by a rate. Interest is only ever computed from the running balance
 * (FR-6 / AC-7). The schedule is used solely to trigger fees and for display.
 */

const ZERO = new Decimal(0);

/** A credit is applied interest-first, then principal, then fees. */
interface EngineState {
  principal: Decimal; // outstanding principal (interest-bearing)
  interestCharged: Decimal; // debited interest sitting in the balance (compounds)
  accruedUncharged: Decimal; // interest accrued since last charge, not yet debited
  totalInterestAccrued: Decimal; // gross interest ever accrued (incl. paid-off)
  feeBalance: Decimal; // outstanding fees (interest-bearing only when policy ON)
  feeInterestCharged: Decimal; // charged interest on fees (policy ON only)
  feeAccruedUncharged: Decimal; // fee interest accrued, not yet charged (policy ON)
  paymentsCredited: Decimal;
}

/**
 * A payment's effective credit date (FR-8), excluding full-prepayment.
 *
 *   • If any instalment is already due on/before the received date, the money
 *     is settling a due/overdue amount → credit when RECEIVED (on-time or late).
 *   • If the payment arrives purely ahead of schedule (nothing due yet), it is
 *     an early part-prepayment → credit on the NEXT due date, not earlier, so it
 *     does not reduce interest early (T&C 4.2).
 */
function effectiveCreditDate(schedule: EngineInput['schedule'], received: string): string {
  const dueDates = schedule.map((s) => s.dueDate).sort();
  const somethingAlreadyDue = dueDates.some((d) => d <= received);
  if (somethingAlreadyDue) return received;
  const nextDue = dueDates.find((d) => d > received);
  return nextDue ?? received;
}

/**
 * Run the engine for a loan as at its statement date.
 * Returns the running ledger, the assessed fees, and the labelled breakdown.
 */
export function runEngine(input: EngineInput): EngineResult {
  const accessDate = assertYmd('loanAccessDate', input.loanAccessDate);
  const statementDate = assertYmd('statementDate', input.statementDate);
  if (statementDate < accessDate) {
    throw new Error('statementDate cannot precede loanAccessDate');
  }
  if (input.initialUnpaidBalance.lte(0)) {
    throw new Error('initialUnpaidBalance must be positive (fail closed — CC-5/NFR-6)');
  }

  const cfg = configForDate(accessDate);
  const dailyRate = cfg.dailyRate;
  const policyOn = input.interestOnFeesPolicy === 'ON';

  const schedule = [...input.schedule].sort((a, b) => a.sequence - b.sequence);
  const cumulativeDue: Decimal[] = [];
  schedule.reduce((acc, s, i) => {
    const running = acc.plus(s.instalmentAmount);
    cumulativeDue[i] = running;
    return running;
  }, ZERO);
  // Clearing the balance on/after the final due date is normal completion, not
  // an EARLY full repayment — the $25 fee only applies to settling ahead of it.
  const finalDueDate = schedule.length ? schedule[schedule.length - 1].dueDate : accessDate;

  // --- Assess fees up front (date-driven, idempotent — FR-12) ----------------
  const fees = assessFees(input, schedule, cumulativeDue, cfg, statementDate, policyOn);

  // --- Precompute each payment's effective credit date ----------------------
  const effectiveByPayment = new Map<string, string>();
  for (const p of input.payments) {
    const received = assertYmd(`payment ${p.paymentId} receivedDate`, p.receivedDate);
    effectiveByPayment.set(p.paymentId, effectiveCreditDate(schedule, received));
  }

  const state: EngineState = {
    principal: input.initialUnpaidBalance,
    interestCharged: ZERO,
    accruedUncharged: ZERO,
    totalInterestAccrued: ZERO,
    feeBalance: ZERO,
    feeInterestCharged: ZERO,
    feeAccruedUncharged: ZERO,
    paymentsCredited: ZERO,
  };

  const ledger: LedgerEntry[] = [];
  const push = (
    entryDate: string,
    type: LedgerEntry['type'],
    amount: Decimal,
    description: string,
    sourceRef?: string,
  ) => {
    ledger.push({
      entryDate,
      type,
      amount,
      runningBalance: currentBalance(state, policyOn),
      description,
      ...(sourceRef ? { sourceRef } : {}),
    });
  };

  // FR-2: open the ledger with the principal on the Loan Access Date.
  push(accessDate, 'principal_open', input.initialUnpaidBalance, 'Opening principal (Initial Unpaid Balance)');

  const totalDays = daysBetween(accessDate, statementDate);
  const paidFull = new Set<string>();

  for (let day = 1; day <= totalDays; day++) {
    const d = shiftYmd(accessDate, day);

    // (a) Early full-prepayment check on the RECEIVED date — only BEFORE the
    //     final due date (settling ahead of schedule → $25 fee, T&C 4.3).
    for (const p of input.payments) {
      if (p.receivedDate !== d || paidFull.has(p.paymentId) || d >= finalDueDate) continue;
      const owing = currentBalance(state, policyOn)
        .plus(state.accruedUncharged)
        .plus(policyOn ? state.feeAccruedUncharged : ZERO)
        .plus(policyOn ? ZERO : state.feeBalance);
      if (p.amount.gte(owing) && owing.gt(0)) {
        creditPayment(state, p, policyOn);
        push(d, 'payment', p.amount.neg(), 'Full prepayment', p.paymentId);
        const efr = cfg.fees.earlyFullRepayment;
        state.feeBalance = state.feeBalance.plus(efr);
        fees.push({ feeType: 'early_full_repayment', amount: efr, assessedDate: d, triggerRef: 'full_prepayment', interestBearing: policyOn });
        push(d, 'fee', efr, 'Early Full Repayment Fee', 'early_full_repayment');
        paidFull.add(p.paymentId);
      }
    }

    // (b) Ordinary/part payments effective on this day.
    for (const p of input.payments) {
      if (paidFull.has(p.paymentId)) continue;
      if (effectiveByPayment.get(p.paymentId) === d) {
        creditPayment(state, p, policyOn);
        push(d, 'payment', p.amount.neg(), 'Payment received', p.paymentId);
      }
    }

    // (c) Fee debits assessed on this day (already computed; add to balance now).
    for (const f of fees) {
      if (f.assessedDate === d && f.feeType !== 'early_full_repayment') {
        state.feeBalance = state.feeBalance.plus(f.amount);
        push(d, 'fee', f.amount, feeLabel(f), f.feeType);
      }
    }

    // (d) Accrue one day of interest on the end-of-day interest-bearing balance.
    const base = state.principal.plus(state.interestCharged);
    const dayInterest = base.times(dailyRate);
    state.accruedUncharged = state.accruedUncharged.plus(dayInterest);
    state.totalInterestAccrued = state.totalInterestAccrued.plus(dayInterest);
    if (policyOn) {
      const feeBase = state.feeBalance.plus(state.feeInterestCharged);
      state.feeAccruedUncharged = state.feeAccruedUncharged.plus(feeBase.times(dailyRate));
    }

    // (e) Fortnightly interest CHARGE — debit accrued interest into the balance,
    //     which then itself accrues interest (compounding — FR-4).
    if (day % cfg.chargeIntervalDays === 0) {
      if (state.accruedUncharged.gt(0)) {
        state.interestCharged = state.interestCharged.plus(state.accruedUncharged);
        push(d, 'interest_charge', state.accruedUncharged, 'Fortnightly interest charge');
        state.accruedUncharged = ZERO;
      }
      if (policyOn && state.feeAccruedUncharged.gt(0)) {
        state.feeInterestCharged = state.feeInterestCharged.plus(state.feeAccruedUncharged);
        push(d, 'interest_charge', state.feeAccruedUncharged, 'Fortnightly interest charge on fees');
        state.feeAccruedUncharged = ZERO;
      }
    }
  }

  // FR-5: report interest accrued up to the statement date (not-yet-charged).
  if (state.accruedUncharged.gt(0)) {
    push(statementDate, 'interest_accrual', state.accruedUncharged, 'Interest accrued to statement date');
  }
  if (policyOn && state.feeAccruedUncharged.gt(0)) {
    push(statementDate, 'interest_accrual', state.feeAccruedUncharged, 'Interest on fees accrued to statement date');
  }

  const breakdown = computeBreakdown(state, fees, policyOn);
  return { ledger, fees, breakdown, policy: input.interestOnFeesPolicy, statementDate };
}

/** Interest-bearing running balance (principal + charged interest [+ fees if ON]). */
function currentBalance(s: EngineState, policyOn: boolean): Decimal {
  const core = s.principal.plus(s.interestCharged);
  return policyOn ? core.plus(s.feeBalance).plus(s.feeInterestCharged) : core;
}

/** Apply a credit: interest first, then principal, then fees (Principle 4). */
function creditPayment(s: EngineState, p: PaymentInput, policyOn: boolean): void {
  let remaining = p.amount;
  s.paymentsCredited = s.paymentsCredited.plus(p.amount);

  const payInterest = Decimal.min(remaining, s.interestCharged.plus(s.accruedUncharged));
  // Reduce charged interest first, then uncharged accrual.
  const fromCharged = Decimal.min(payInterest, s.interestCharged);
  s.interestCharged = s.interestCharged.minus(fromCharged);
  s.accruedUncharged = s.accruedUncharged.minus(payInterest.minus(fromCharged));
  remaining = remaining.minus(payInterest);

  const payPrincipal = Decimal.min(remaining, s.principal);
  s.principal = s.principal.minus(payPrincipal);
  remaining = remaining.minus(payPrincipal);

  if (remaining.gt(0)) {
    const payFee = Decimal.min(remaining, s.feeBalance.plus(s.feeInterestCharged));
    const feeFromBal = Decimal.min(payFee, s.feeBalance);
    s.feeBalance = s.feeBalance.minus(feeFromBal);
    if (policyOn) s.feeInterestCharged = s.feeInterestCharged.minus(payFee.minus(feeFromBal));
  }
}

/** Assess late & default fees from the schedule + payment coverage (FR-10/11). */
function assessFees(
  input: EngineInput,
  schedule: EngineInput['schedule'],
  cumulativeDue: Decimal[],
  cfg: ReturnType<typeof configForDate>,
  statementDate: string,
  policyOn: boolean,
): AssessedFee[] {
  const fees: AssessedFee[] = [];

  // Payments credited on/before a date, by effective date (early → due date).
  const paymentsBy = (date: string): Decimal =>
    input.payments.reduce((acc, p) => {
      const eff = effectiveCreditDate(schedule, p.receivedDate);
      return eff <= date ? acc.plus(p.amount) : acc;
    }, ZERO);

  let defaultAssessed = false;
  schedule.forEach((s, i) => {
    // Late Payment Fee — instalment unpaid/short more than 3 days past due (day 3).
    const lateDate = shiftYmd(s.dueDate, cfg.grace.latePaymentDays);
    if (lateDate <= statementDate && paymentsBy(lateDate).lt(cumulativeDue[i])) {
      fees.push({
        feeType: 'late_payment',
        amount: cfg.fees.latePayment,
        assessedDate: lateDate,
        triggerRef: `instalment_${s.sequence}`,
        interestBearing: policyOn,
      });
    }

    // Payment Default Fee — once only, first instalment 7 days past due (day 7).
    if (!defaultAssessed) {
      const defaultDate = shiftYmd(s.dueDate, cfg.grace.paymentDefaultDays);
      if (defaultDate <= statementDate && paymentsBy(defaultDate).lt(cumulativeDue[i])) {
        fees.push({
          feeType: 'payment_default',
          amount: cfg.fees.paymentDefault,
          assessedDate: defaultDate,
          triggerRef: `instalment_${s.sequence}`,
          interestBearing: policyOn,
        });
        defaultAssessed = true;
      }
    }
  });

  return fees;
}

function feeLabel(f: AssessedFee): string {
  switch (f.feeType) {
    case 'late_payment':
      return 'Late Payment Fee';
    case 'payment_default':
      return 'Payment Default Fee';
    case 'early_full_repayment':
      return 'Early Full Repayment Fee';
  }
}

/** Build the honest, separately-labelled component breakdown (FR-14/FR-15). */
function computeBreakdown(s: EngineState, fees: AssessedFee[], policyOn: boolean): ComponentBreakdown {
  const lateFees = fees.filter((f) => f.feeType === 'late_payment');
  const defaultFees = fees.filter((f) => f.feeType === 'payment_default');
  const earlyFees = fees.filter((f) => f.feeType === 'early_full_repayment');

  const principalOutstanding = toCents(s.principal);
  const coreInterest = s.interestCharged.plus(s.accruedUncharged);
  const feeInterest = policyOn ? s.feeInterestCharged.plus(s.feeAccruedUncharged) : ZERO;
  const interestAccruedToDate = toCents(coreInterest);
  const interestOnFees = toCents(feeInterest);

  const lateFeesTotal = toCents(lateFees.reduce((a, f) => a.plus(f.amount), ZERO));
  const defaultFee = toCents(defaultFees.reduce((a, f) => a.plus(f.amount), ZERO));
  const earlyRepaymentFee = toCents(earlyFees.reduce((a, f) => a.plus(f.amount), ZERO));

  const totalOwing = toCents(
    s.principal.plus(coreInterest).plus(s.feeBalance).plus(policyOn ? feeInterest : ZERO),
  );

  return {
    principalOutstanding,
    interestAccruedToDate,
    totalInterestAccrued: toCents(s.totalInterestAccrued),
    lateFeeCount: lateFees.length,
    lateFeesTotal,
    defaultFeeTriggered: defaultFees.length > 0,
    defaultFee,
    earlyRepaymentFee,
    interestOnFees,
    paymentsCredited: toCents(s.paymentsCredited),
    totalOwing,
  };
}
