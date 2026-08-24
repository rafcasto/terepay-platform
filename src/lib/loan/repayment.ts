import Decimal from 'decimal.js';
import { configForDate } from '@/lib/collections/config';
import { money, toCents, toNumber, ZERO } from '@/lib/collections/money';
import { daysBetween, shiftYmd } from '@/lib/collections/dates';

/**
 * Origination repayment maths — the single source of truth for what a TerePay
 * loan costs and what each instalment is.
 *
 * The product is a **reducing-balance annuity**: a level fortnightly payment
 * sized so the loan amortises to exactly zero over its term, with interest
 * charged on the balance actually outstanding in each period.
 *
 *   dailyRate      = annualRate / 365                (0.49 / 365 = 0.134247%)
 *   periodicRate   = dailyRate × chargeIntervalDays  (× 14 = 1.87945%)
 *   instalment     = PMT(periodicRate, n, principal)
 *   interest_k     = openingBalance_k × dailyRate × daysInPeriod_k
 *   principal_k    = amount_k − interest_k
 *
 * Rates and the charge cadence are read from the effective-dated collections
 * config (src/lib/collections/config.ts) so a rate change is a config entry,
 * never an edit here, and any historical schedule stays reproducible.
 *
 * All intermediate arithmetic runs through decimal.js at full precision; we
 * round to cents only when a figure becomes a real money movement. This mirrors
 * the collections engine's discipline — see src/lib/collections/money.ts.
 *
 * Model marker persisted alongside stored figures so read paths can tell an
 * amortised loan from a legacy flat-rate one.
 */
export const RATE_MODEL = 'amortised_v1' as const;

/** Number of instalments in the standard TerePay product (8 weeks, fortnightly). */
export const DEFAULT_INSTALMENTS = 4;

export interface ScheduleRow {
  installmentNumber: number;
  /** YYYY-MM-DD (NZ calendar date). */
  dueDate: string;
  /** Actual calendar days this period covers — normally 14. */
  daysInPeriod: number;
  openingBalance: number;
  interest: number;
  principal: number;
  amount: number;
  closingBalance: number;
}

export interface AmortisedSchedule {
  rateModel: typeof RATE_MODEL;
  /** Level payment for instalments 1..n−1 (the headline "per fortnight" figure). */
  fortnightlyPayment: number;
  /** Annual rate applied, e.g. 0.49. */
  annualRate: number;
  startDate: string;
  rows: ScheduleRow[];
  totalInterest: number;
  totalRepayable: number;
}

/** Rate parameters in force on a given date. */
function rateParams(onDate: string) {
  const cfg = configForDate(onDate);
  return {
    annualRate: cfg.annualRate,
    dailyRate: cfg.dailyRate,
    intervalDays: cfg.chargeIntervalDays,
  };
}

/** Normalise a Date | YYYY-MM-DD into a YYYY-MM-DD NZ calendar date. */
export function toYmd(value: Date | string): string {
  if (typeof value === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}/.test(value)) {
      throw new Error(`Expected a YYYY-MM-DD date, got "${value}"`);
    }
    return value.slice(0, 10);
  }
  return value.toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });
}

/**
 * Excel-compatible PMT: the level payment that amortises `principal` to zero
 * over `periods` at `rate` per period, paid in arrears.
 *
 *   PMT = P × r / (1 − (1 + r)^−n)
 *
 * Falls back to straight-line when the rate is zero. Full precision — the
 * caller decides when to round.
 */
export function pmt(
  rate: Decimal.Value,
  periods: number,
  principal: Decimal.Value,
): Decimal {
  const r = money(rate);
  const p = money(principal);
  if (periods <= 0) throw new Error('pmt: periods must be > 0');
  if (r.isZero()) return p.div(periods);
  const discount = ZERO.plus(1).minus(r.plus(1).pow(-periods));
  return p.times(r).div(discount);
}

/**
 * The level fortnightly instalment for a loan of `principal`, rounded to cents.
 * `onDate` selects the rate config in force (defaults to today in NZ).
 */
export function fortnightlyPayment(principal: number, onDate?: string): number {
  if (!(principal > 0)) return 0;
  const date = onDate ?? nzToday();
  const { dailyRate, intervalDays } = rateParams(date);
  const periodicRate = dailyRate.times(intervalDays);
  return toNumber(pmt(periodicRate, DEFAULT_INSTALMENTS, principal));
}

export interface BuildScheduleOptions {
  principal: number;
  /** Anchor date — instalment k falls due `startDate + intervalDays × k`. */
  startDate: Date | string;
  instalments?: number;
  /** Rate config selector; defaults to `startDate`. */
  onDate?: string;
}

/**
 * Build the full amortisation schedule.
 *
 * Instalments 1..n−1 carry the level payment; the **final instalment is trued
 * up** to whatever clears the balance (opening + its interest), so the closing
 * balance lands on exactly 0.00 and the borrower is never left owing a stray
 * cent or overpaying one.
 */
export function buildSchedule(opts: BuildScheduleOptions): AmortisedSchedule {
  const startDate = toYmd(opts.startDate);
  const n = opts.instalments ?? DEFAULT_INSTALMENTS;
  const { annualRate, dailyRate, intervalDays } = rateParams(opts.onDate ?? startDate);

  if (n <= 0) throw new Error('buildSchedule: instalments must be > 0');
  if (!(opts.principal > 0)) {
    return {
      rateModel: RATE_MODEL,
      fortnightlyPayment: 0,
      annualRate: annualRate.toNumber(),
      startDate,
      rows: [],
      totalInterest: 0,
      totalRepayable: 0,
    };
  }

  const periodicRate = dailyRate.times(intervalDays);
  const level = toCents(pmt(periodicRate, n, opts.principal));

  const rows: ScheduleRow[] = [];
  let balance = toCents(opts.principal);
  let cursor = startDate;
  let totalInterest = ZERO;
  let totalRepayable = ZERO;

  for (let k = 1; k <= n; k += 1) {
    const dueDate = shiftYmd(startDate, intervalDays * k);
    const daysInPeriod = daysBetween(cursor, dueDate);
    const opening = balance;
    const interest = toCents(opening.times(dailyRate).times(daysInPeriod));

    // Final instalment clears whatever is left, so rounding drift across the
    // schedule can never leave a residual balance.
    const isFinal = k === n;
    let amount = isFinal ? toCents(opening.plus(interest)) : level;

    // Defensive: a level payment that does not cover the period's interest
    // would amortise negatively. Cannot happen at 49% over 4 fortnights, but
    // clamp rather than silently grow the borrower's balance.
    if (!isFinal && amount.lte(interest)) {
      amount = toCents(opening.plus(interest));
    }

    const principalPart = toCents(amount.minus(interest));
    const closing = toCents(opening.minus(principalPart));

    rows.push({
      installmentNumber: k,
      dueDate,
      daysInPeriod,
      openingBalance: opening.toNumber(),
      interest: interest.toNumber(),
      principal: principalPart.toNumber(),
      amount: amount.toNumber(),
      closingBalance: closing.toNumber(),
    });

    totalInterest = totalInterest.plus(interest);
    totalRepayable = totalRepayable.plus(amount);
    balance = closing;
    cursor = dueDate;
  }

  return {
    rateModel: RATE_MODEL,
    fortnightlyPayment: level.toNumber(),
    annualRate: annualRate.toNumber(),
    startDate,
    rows,
    totalInterest: toNumber(totalInterest),
    totalRepayable: toNumber(totalRepayable),
  };
}

/**
 * Quote to settle a loan in full, part-way through its term.
 *
 * Actuarial (reducing-balance) basis: the borrower pays the principal still
 * outstanding plus interest accrued on that principal from the last charge date
 * to the settlement date. Interest that would have accrued after settlement is
 * never charged, so it needs no separate "rebate" step.
 *
 *   payoff = outstandingPrincipal
 *          + outstandingPrincipal × dailyRate × daysSinceLastCharge
 *          + prepaymentFee
 */
export interface PayoffBasis {
  outstandingPrincipal: number;
  accruedInterest: number;
  accrualFromDate: string;
  accrualDays: number;
  settlementDate: string;
  /** Interest the borrower avoids versus running the schedule to term. */
  interestSaved: number;
}

export function payoffBasis(opts: {
  schedule: AmortisedSchedule;
  /** How many instalments have actually settled (0 = none). */
  instalmentsPaid: number;
  settlementDate: Date | string;
}): PayoffBasis {
  const { schedule } = opts;
  const settlementDate = toYmd(opts.settlementDate);
  const paid = Math.max(0, Math.min(opts.instalmentsPaid, schedule.rows.length));

  const lastPaidRow = paid > 0 ? schedule.rows[paid - 1] : null;
  const outstandingPrincipal = lastPaidRow
    ? lastPaidRow.closingBalance
    : (schedule.rows[0]?.openingBalance ?? 0);
  const accrualFromDate = lastPaidRow ? lastPaidRow.dueDate : schedule.startDate;

  const { dailyRate } = rateParams(schedule.startDate);
  const accrualDays = Math.max(0, daysBetween(accrualFromDate, settlementDate));
  const accruedInterest = toNumber(
    money(outstandingPrincipal).times(dailyRate).times(accrualDays),
  );

  // Interest still sitting in the unpaid instalments if the loan ran to term.
  const futureInterest = schedule.rows
    .slice(paid)
    .reduce((acc, r) => acc.plus(r.interest), ZERO);

  return {
    outstandingPrincipal,
    accruedInterest,
    accrualFromDate,
    accrualDays,
    settlementDate,
    interestSaved: toNumber(futureInterest.minus(accruedInterest)),
  };
}

/** Today's NZ calendar date as YYYY-MM-DD. */
function nzToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });
}
