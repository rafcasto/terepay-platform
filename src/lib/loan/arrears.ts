import { Timestamp } from 'firebase-admin/firestore';
import {
  DAILY_INTEREST_RATE,
  LATE_PAYMENT_FEE,
  LATE_PAYMENT_FEE_MAX,
  LATE_PAYMENT_GRACE_DAYS,
  PAYMENT_DEFAULT_FEE,
  PAYMENT_DEFAULT_GRACE_DAYS,
} from '@/lib/constants/fees';
import type { DerivedInstallment } from './active-loan';
import type { ArrearsState, FeeAssessment } from '@/types/application';

/**
 * Pure arrears engine. Given a loan's derived instalment schedule and today's
 * NZ date, it decides which default fees are now due and how much post-default
 * interest has accrued. No I/O — the orchestrator (assess-arrears.ts) loads the
 * application, calls this, and persists the result idempotently.
 *
 * Policy (see docs / src/lib/constants/fees.ts):
 *   - Late Payment Fee: $10 per instalment once it is > 3 calendar days past
 *     due, one charge per instalment, capped at $40 (4 instalments) per loan.
 *   - Payment Default Fee: $25 charged once per loan when any instalment is
 *     > 7 calendar days past due, in addition to the late fee.
 *   - Post-default interest: the flat 4.7% stays for on-time loans; once an
 *     instalment is missed, 49% p.a. (daily-balance method) accrues on the
 *     outstanding balance from the miss date because the money is still owed.
 *
 * Interest accrual uses the true daily-balance method incrementally: each run
 * adds `outstandingBalance × dailyRate × (days since last accrual)`. Driven by
 * the daily cron, that reduces to one day's interest per run at whatever the
 * outstanding balance is that day (so it self-adjusts as payments land).
 */

const DAY_MS = 86_400_000;

/** Parse a YYYY-MM-DD calendar date to its UTC-midnight epoch (TZ-stable). */
function ymdToUtc(ymd: string): number {
  return Date.parse(`${ymd}T00:00:00.000Z`);
}

/** Whole days between two YYYY-MM-DD calendar dates (later − earlier). */
export function daysBetween(fromYmd: string, toYmd: string): number {
  return Math.round((ymdToUtc(toYmd) - ymdToUtc(fromYmd)) / DAY_MS);
}

/** An instalment counts as unpaid unless it has settled or been cancelled. */
function isUnpaid(inst: DerivedInstallment): boolean {
  return inst.status !== 'paid' && inst.status !== 'cancelled';
}

export interface AssessArrearsInput {
  /** Ordered instalment schedule from `deriveLoanSummary`. */
  installments: DerivedInstallment[];
  /** Current outstanding balance in cents. */
  remainingBalanceCents: number;
  /** Today's NZ calendar date (YYYY-MM-DD). */
  today: string;
  /** Fees already assessed on this loan (for idempotency). */
  existingFeeAssessments: FeeAssessment[];
  /** Prior arrears state, if any (for incremental interest accrual). */
  existingArrears: ArrearsState | null;
  /** Timestamp to stamp new records with. */
  now: Timestamp;
}

export interface AssessArrearsResult {
  /** True when at least one instalment is currently past due and unpaid. */
  isInArrears: boolean;
  /** Fee assessments not already on the loan — append these. */
  newFeeAssessments: FeeAssessment[];
  /** Updated arrears/interest state, or null when the loan is not in arrears. */
  arrears: ArrearsState | null;
}

/**
 * Compute the default fees now due and the post-default interest accrued since
 * the last run. Idempotent with respect to `existingFeeAssessments`: a fee is
 * only returned when its `id` is not already present.
 */
export function assessArrears(input: AssessArrearsInput): AssessArrearsResult {
  const { installments, remainingBalanceCents, today, existingFeeAssessments, existingArrears, now } =
    input;

  const existingIds = new Set(existingFeeAssessments.map((f) => f.id));

  // Instalments that are unpaid AND past their due date, with days overdue.
  const overdue = installments
    .filter((inst) => isUnpaid(inst) && daysBetween(inst.dueDate, today) > 0)
    .map((inst) => ({ inst, daysPastDue: daysBetween(inst.dueDate, today) }));

  const isInArrears = overdue.length > 0 && remainingBalanceCents > 0;
  if (!isInArrears) {
    // Nothing overdue (or fully repaid) — no new fees, no accrual.
    return { isInArrears: false, newFeeAssessments: [], arrears: null };
  }

  const newFeeAssessments: FeeAssessment[] = [];

  // --- Late Payment Fee: one per instalment past the 3-day grace, capped -----
  const alreadyLateCents = existingFeeAssessments
    .filter((f) => f.type === 'late_payment')
    .reduce((sum, f) => sum + f.amountCents, 0);
  let lateTotalCents = alreadyLateCents;

  for (const { inst, daysPastDue } of overdue) {
    if (daysPastDue <= LATE_PAYMENT_GRACE_DAYS) continue; // still within grace
    const id = `late:${inst.installmentNumber}`;
    if (existingIds.has(id)) continue; // already charged for this instalment
    if (lateTotalCents + LATE_PAYMENT_FEE * 100 > LATE_PAYMENT_FEE_MAX * 100) break; // cap reached
    newFeeAssessments.push({
      id,
      type: 'late_payment',
      amountCents: LATE_PAYMENT_FEE * 100,
      installmentNumber: inst.installmentNumber,
      reason: `Instalment ${inst.installmentNumber} unpaid ${daysPastDue} days (> ${LATE_PAYMENT_GRACE_DAYS}-day grace)`,
      assessedAt: now,
    });
    lateTotalCents += LATE_PAYMENT_FEE * 100;
  }

  // --- Payment Default Fee: once per loan past the 7-day grace ----------------
  const worstDaysPastDue = overdue.reduce((max, o) => Math.max(max, o.daysPastDue), 0);
  if (worstDaysPastDue > PAYMENT_DEFAULT_GRACE_DAYS && !existingIds.has('default')) {
    newFeeAssessments.push({
      id: 'default',
      type: 'payment_default',
      amountCents: PAYMENT_DEFAULT_FEE * 100,
      reason: `Instalment unpaid ${worstDaysPastDue} days (> ${PAYMENT_DEFAULT_GRACE_DAYS}-day grace)`,
      assessedAt: now,
    });
  }

  // --- Post-default interest (daily-balance, incremental) --------------------
  const earliestMissDate = overdue
    .map((o) => o.inst.dueDate)
    .sort()[0];

  // Accrue from the last assessed date (or the miss date on the first run) up to
  // today, at the current outstanding balance. Never re-accrues a day already
  // counted, and never accrues negatively.
  const priorAccrued = existingArrears?.accruedInterestCents ?? 0;
  const lastAssessed =
    existingArrears && existingArrears.earliestMissDate === earliestMissDate
      ? existingArrears.lastAssessedDate
      : earliestMissDate;
  const daysToAccrue = Math.max(0, daysBetween(lastAssessed, today));
  const addedInterest = Math.round(remainingBalanceCents * DAILY_INTEREST_RATE * daysToAccrue);

  const arrears: ArrearsState = {
    accruedInterestCents: priorAccrued + Math.max(0, addedInterest),
    dailyRate: DAILY_INTEREST_RATE,
    earliestMissDate,
    lastAssessedDate: today,
  };

  return { isInArrears: true, newFeeAssessments, arrears };
}
