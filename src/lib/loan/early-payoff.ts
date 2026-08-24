import { EARLY_REPAYMENT_FEE } from '@/lib/constants/fees';
import { deriveLoanSummary, type LoanSummarySource } from './active-loan';
import type { DerivedInstallmentStatus } from './active-loan';
import type { LoanApplication } from '@/types/application';
import { buildSchedule, payoffBasis, RATE_MODEL, type PayoffBasis } from './repayment';

/**
 * Method used to price an early full repayment on the current (amortised)
 * product: actuarial reducing balance — principal still owed plus interest
 * accrued to the settlement date. Documented in
 * docs/EARLY_REPAYMENT_INTEREST_REBATE.md.
 */
export const INTEREST_REBATE_METHOD = 'actuarial_reducing_balance' as const;

/**
 * Method used for loans written before the amortised product (no
 * `loanDetails.rateModel` stamp). Those contracts were priced on a flat 4.7%,
 * so they keep the straight-line rebate they were sold under — a borrower is
 * never re-based onto a method their contract did not disclose.
 */
export const LEGACY_INTEREST_REBATE_METHOD = 'pro_rata_time_apportionment' as const;

export type InterestRebateMethod =
  | typeof INTEREST_REBATE_METHOD
  | typeof LEGACY_INTEREST_REBATE_METHOD;

/**
 * The early-repayment payoff figure a borrower must pay to settle their loan in
 * full ahead of schedule.
 *
 * Policy (kept in ONE place so it is easy to audit / tune — see
 * docs/EARLY_REPAYMENT_INTEREST_REBATE.md for the full write-up and worked
 * examples):
 *
 * Amortised loans (`loanDetails.rateModel === 'amortised_v1'`) settle on an
 * ACTUARIAL reducing-balance basis, matching how the loan was priced:
 *
 *   netOutstanding  = outstandingPrincipal
 *                     + outstandingPrincipal × dailyRate × daysSinceLastCharge
 *   totalPayoff     = netOutstanding + EARLY_REPAYMENT_FEE
 *
 * Interest simply stops accruing at settlement, so nothing needs rebating; the
 * `unearnedInterestRebate` field is reported as the difference between running
 * the schedule to term and settling now, purely for disclosure.
 *
 * Legacy flat-rate loans keep the straight-line rebate they were sold under:
 *
 *   rebate          = I × remainingDays / termDays, capped at future interest
 *   netOutstanding  = grossRemaining − rebate
 *
 * The borrower is charged the principal still owed, the interest that has
 * accrued up to the settlement date, and the disclosed prepayment fee. Future
 * (unearned) interest is refunded. All money values are returned in dollars and
 * cents. Returns `null` when there is nothing left to pay off.
 */
export interface EarlyPayoffBreakdown {
  method: InterestRebateMethod;
  /** Total contractual interest charged over the life of the loan (NZD). */
  totalInterest: number;
  totalInstalments: number;
  remainingInstalments: number;
  /** Interest sitting in the remaining instalments on a flat allocation (NZD). */
  grossFutureInterest: number;
  /** Whole days from loan start to the final instalment due date. */
  termDays: number;
  /** Whole days elapsed from loan start to the settlement date (clamped to term). */
  elapsedDays: number;
  /** termDays − elapsedDays. */
  remainingDays: number;
  loanStartDate: string; // YYYY-MM-DD
  finalDueDate: string; // YYYY-MM-DD
  settlementDate: string; // YYYY-MM-DD
  /** Actuarial only: principal still owed at the settlement date (NZD). */
  outstandingPrincipal?: number;
  /** Actuarial only: interest accrued on that principal since the last charge. */
  accruedInterest?: number;
  /** Actuarial only: date interest has been charged up to. */
  accrualFromDate?: string;
  /** Actuarial only: days of accrual applied. */
  accrualDays?: number;
}

export interface EarlyPayoffQuote {
  currency: 'NZD';
  /** Sum of not-yet-paid instalments (principal + interest), in NZD. */
  outstandingBalance: number;
  outstandingBalanceCents: number;
  /** Unearned interest refunded on early settlement, in NZD. */
  unearnedInterestRebate: number;
  unearnedInterestRebateCents: number;
  /** outstandingBalance − rebate (principal owed + interest earned to date), NZD. */
  netOutstanding: number;
  netOutstandingCents: number;
  /** Fixed prepayment/administrative fee, in NZD. */
  prepaymentFee: number;
  prepaymentFeeCents: number;
  /** netOutstanding + prepaymentFee, in NZD — the amount charged via PayBy. */
  totalPayoff: number;
  totalPayoffCents: number;
  /** installmentNumbers this payoff would clear. */
  installmentsCleared: number[];
  /** Full working for audit / legal review. */
  breakdown: EarlyPayoffBreakdown;
}

/** Instalment statuses that count as already settled (nothing left to pay). */
const SETTLED: ReadonlySet<DerivedInstallmentStatus> = new Set(['paid', 'cancelled']);
const DAY_MS = 86_400_000;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function toCents(n: number): number {
  return Math.round(n * 100);
}

/** Today's calendar date in NZ (Pacific/Auckland) as YYYY-MM-DD. */
function nzTodayYmd(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });
}

/** Parse a YYYY-MM-DD calendar date to its UTC-midnight epoch (TZ-stable). */
function ymdToUtc(ymd: string): number {
  return Date.parse(`${ymd}T00:00:00.000Z`);
}

/** Format any Date as an NZ (Pacific/Auckland) YYYY-MM-DD calendar date. */
function dateToNzYmd(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });
}

/** Shift a YYYY-MM-DD date by whole days, returning a YYYY-MM-DD date. */
function shiftYmd(ymd: string, days: number): string {
  return new Date(ymdToUtc(ymd) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days between two YYYY-MM-DD calendar dates (later − earlier). */
function daysBetween(fromYmd: string, toYmd: string): number {
  return Math.round((ymdToUtc(toYmd) - ymdToUtc(fromYmd)) / DAY_MS);
}

/** Best-effort NZ calendar date of the loan's disbursement, if recorded. */
function disbursedYmd(app: LoanSummarySource): string | null {
  const ts = (app as Partial<LoanApplication>).timeline?.disbursedAt as
    | { toDate?: () => Date; _seconds?: number; seconds?: number }
    | undefined;
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return dateToNzYmd(ts.toDate());
  const s = ts._seconds ?? ts.seconds;
  if (typeof s === 'number') return dateToNzYmd(new Date(s * 1000));
  return null;
}

/** Total contractual interest on the loan (NZD), or 0 when it can't be derived. */
function totalContractInterest(app: LoanSummarySource): number {
  const approved = app.loanDetails?.approvedAmount;
  const totalRepay = app.loanDetails?.totalRepayment;
  if (typeof totalRepay === 'number' && typeof approved === 'number') {
    return Math.max(0, round2(totalRepay - approved));
  }
  if (typeof approved === 'number') {
    // No stored total (pre-pricing application): fall back to the amortised
    // interest this loan would carry.
    return Math.max(0, buildSchedule({ principal: approved, startDate: new Date() }).totalInterest);
  }
  return 0;
}

export type ComputeEarlyPayoffOptions = {
  /** Override the settlement date (YYYY-MM-DD). Defaults to today in NZ. */
  settlementDate?: string;
};

/**
 * Compute the early-repayment payoff quote for a live loan, or `null` when
 * there is nothing left to pay off (fully repaid, or no schedule yet).
 */
export function computeEarlyPayoff(
  app: LoanSummarySource,
  options: ComputeEarlyPayoffOptions = {},
): EarlyPayoffQuote | null {
  const summary = deriveLoanSummary(app);

  const totalInstalments = summary.installments.length;
  const unpaid = summary.installments.filter((i) => !SETTLED.has(i.status));
  if (totalInstalments === 0 || unpaid.length === 0 || summary.isFullyPaid) return null;

  // Gross remaining: instalments the borrower would otherwise still be charged.
  const grossRemaining = round2(unpaid.reduce((acc, i) => acc + i.amount, 0));
  if (grossRemaining <= 0) return null;

  const remainingInstalments = unpaid.length;

  // --- Dates -------------------------------------------------------------
  const firstDue = summary.installments[0].dueDate;
  const finalDueDate = summary.installments[totalInstalments - 1].dueDate;
  // Loan start: recorded disbursement date, else one fortnight before the first
  // instalment (the TerePay product schedules the first instalment 14 days out).
  const loanStartDate = disbursedYmd(app) ?? shiftYmd(firstDue, -14);
  const settlementDate = options.settlementDate ?? nzTodayYmd();

  const termDays = Math.max(1, daysBetween(loanStartDate, finalDueDate));
  const elapsedDays = Math.min(Math.max(0, daysBetween(loanStartDate, settlementDate)), termDays);
  const remainingDays = termDays - elapsedDays;

  // --- Settlement basis --------------------------------------------------
  const totalInterest = totalContractInterest(app);
  // Interest embedded in the remaining instalments (flat/even allocation).
  const grossFutureInterest = round2((totalInterest * remainingInstalments) / totalInstalments);

  const approvedAmount = app.loanDetails?.approvedAmount;
  const isAmortised = app.loanDetails?.rateModel === RATE_MODEL;

  let method: InterestRebateMethod = LEGACY_INTEREST_REBATE_METHOD;
  let unearnedInterestRebate: number;
  let netOutstanding: number;
  let actuarial: PayoffBasis | null = null;

  if (isAmortised && typeof approvedAmount === 'number' && approvedAmount > 0) {
    // Rebuild the amortisation this loan was priced on and settle against the
    // principal actually outstanding — the basis the borrower contracted to.
    const schedule = buildSchedule({
      principal: approvedAmount,
      startDate: loanStartDate,
    });
    const paidCount = totalInstalments - remainingInstalments;
    actuarial = payoffBasis({ schedule, instalmentsPaid: paidCount, settlementDate });
    method = INTEREST_REBATE_METHOD;
    netOutstanding = Math.max(
      0,
      round2(actuarial.outstandingPrincipal + actuarial.accruedInterest),
    );
    // Reported for disclosure: what settling now saves against running to term.
    unearnedInterestRebate = Math.max(0, round2(grossRemaining - netOutstanding));
  } else {
    // Legacy flat-rate contract: straight-line rebate, capped so we never
    // rebate interest already paid in earlier instalments.
    const timeRebate = round2((totalInterest * remainingDays) / termDays);
    unearnedInterestRebate = Math.min(Math.max(0, timeRebate), grossFutureInterest);
    netOutstanding = Math.max(0, round2(grossRemaining - unearnedInterestRebate));
  }

  const prepaymentFee = EARLY_REPAYMENT_FEE;
  const totalPayoff = round2(netOutstanding + prepaymentFee);

  return {
    currency: 'NZD',
    outstandingBalance: grossRemaining,
    outstandingBalanceCents: toCents(grossRemaining),
    unearnedInterestRebate,
    unearnedInterestRebateCents: toCents(unearnedInterestRebate),
    netOutstanding,
    netOutstandingCents: toCents(netOutstanding),
    prepaymentFee,
    prepaymentFeeCents: toCents(prepaymentFee),
    totalPayoff,
    totalPayoffCents: toCents(totalPayoff),
    installmentsCleared: unpaid.map((i) => i.installmentNumber),
    breakdown: {
      method,
      totalInterest,
      totalInstalments,
      remainingInstalments,
      grossFutureInterest,
      termDays,
      elapsedDays,
      remainingDays,
      loanStartDate,
      finalDueDate,
      settlementDate,
      outstandingPrincipal: actuarial?.outstandingPrincipal,
      accruedInterest: actuarial?.accruedInterest,
      accrualFromDate: actuarial?.accrualFromDate,
      accrualDays: actuarial?.accrualDays,
    },
  };
}
