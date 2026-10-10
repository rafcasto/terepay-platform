import {
  ANNUAL_INTEREST_RATE,
  LATE_PAYMENT_FEE,
  LATE_PAYMENT_FEE_MAX,
  LATE_PAYMENT_GRACE_DAYS,
  PAYMENT_DEFAULT_FEE,
  PAYMENT_DEFAULT_GRACE_DAYS,
} from '@/lib/constants/fees';
import type { ArrearsState, FeeAssessment } from '@/types/application';
import type { DerivedInstallment } from './active-loan';

/**
 * Read-only view of what the arrears engine (src/lib/loan/arrears.ts) has
 * charged on a loan: late payment fees, the one-off payment default fee and
 * the post-default interest accrued on the overdue balance.
 *
 * Pure and free of server-only imports, and every field is a plain value, so
 * the result can be rendered by Server Components and handed to Client
 * Components alike. It never assesses anything — it only reports what is
 * already on the application document (`feeAssessments`, `arrears`).
 */

export interface ArrearsChargeLine {
  id: string;
  type: FeeAssessment['type'];
  label: string;
  amountCents: number;
  /** ISO 8601 date the fee was charged, when known. */
  assessedAt?: string;
}

export interface ArrearsChargesSummary {
  /** The loan is subject to late / default fees and post-default interest. */
  policyApplies: boolean;
  /** At least one instalment is past due and still unpaid. */
  isOverdue: boolean;
  /** Days past due of the oldest unpaid instalment (0 when nothing is overdue). */
  daysPastDue: number;
  /** Due date (YYYY-MM-DD) of the oldest unpaid instalment, if any. */
  earliestMissDate: string | null;
  /** Sum of the overdue instalments themselves (cents), before any charges. */
  overdueAmountCents: number;
  lateFeeCents: number;
  lateFeeCount: number;
  defaultFeeCents: number;
  accruedInterestCents: number;
  /** Late fees + default fee + accrued interest (cents). */
  totalChargesCents: number;
  hasCharges: boolean;
  /** Individual fee charges, oldest first. */
  lines: ArrearsChargeLine[];
  /** NZ date interest was last accrued to (YYYY-MM-DD). */
  interestAccruedTo: string | null;
  /** Days until the next fee applies if nothing is paid (null when none is pending). */
  daysUntilLateFee: number | null;
  daysUntilDefaultFee: number | null;
}

/** The disclosed arrears policy, for display beside any overdue amount. */
export const ARREARS_POLICY = {
  lateFee: LATE_PAYMENT_FEE,
  lateFeeGraceDays: LATE_PAYMENT_GRACE_DAYS,
  lateFeeMax: LATE_PAYMENT_FEE_MAX,
  defaultFee: PAYMENT_DEFAULT_FEE,
  defaultFeeGraceDays: PAYMENT_DEFAULT_GRACE_DAYS,
  annualInterestRatePct: Math.round(ANNUAL_INTEREST_RATE * 100),
} as const;

const DAY_MS = 86_400_000;

function daysBetween(fromYmd: string, toYmd: string): number {
  return Math.round(
    (Date.parse(`${toYmd}T00:00:00.000Z`) - Date.parse(`${fromYmd}T00:00:00.000Z`)) / DAY_MS,
  );
}

/** Today's NZ calendar date (YYYY-MM-DD) — the same clock the arrears engine uses. */
export function nzTodayYmd(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });
}

type TimestampLike = { toDate?: () => Date; _seconds?: number; seconds?: number } | Date | string;

function toIso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  const v = value as Exclude<TimestampLike, Date | string>;
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  const s = v._seconds ?? v.seconds;
  return typeof s === 'number' ? new Date(s * 1000).toISOString() : undefined;
}

export interface ArrearsChargeTotals {
  lateFeeCents: number;
  lateFeeCount: number;
  defaultFeeCents: number;
  accruedInterestCents: number;
  /** Late fees + default fee + accrued interest (cents). */
  totalCents: number;
}

/**
 * Sum what the arrears engine has charged on a loan so far. Shared by the
 * loan summary (so charges form part of the balance), the early-payoff quote
 * (so settling early collects them) and the detailed summary below.
 */
export function arrearsChargeTotals(
  feeAssessments: FeeAssessment[] | null | undefined,
  arrears: ArrearsState | null | undefined,
): ArrearsChargeTotals {
  const fees = Array.isArray(feeAssessments) ? feeAssessments : [];
  const lateFees = fees.filter((f) => f.type === 'late_payment');
  const lateFeeCents = lateFees.reduce((sum, f) => sum + f.amountCents, 0);
  const defaultFeeCents = fees
    .filter((f) => f.type === 'payment_default')
    .reduce((sum, f) => sum + f.amountCents, 0);
  const accruedInterestCents = Math.max(0, arrears?.accruedInterestCents ?? 0);
  return {
    lateFeeCents,
    lateFeeCount: lateFees.length,
    defaultFeeCents,
    accruedInterestCents,
    totalCents: lateFeeCents + defaultFeeCents + accruedInterestCents,
  };
}

export function summariseArrearsCharges(input: {
  installments: DerivedInstallment[];
  feeAssessments?: FeeAssessment[] | null;
  arrears?: ArrearsState | null;
  /**
   * Whether the loan is under the arrears-fee policy (`feePolicyVersion` is
   * stamped at disbursement). Loans without the stamp are never assessed, so
   * no upcoming fee is predicted for them.
   */
  policyApplies: boolean;
  /** NZ calendar date to measure against; defaults to today. */
  today?: string;
}): ArrearsChargesSummary {
  const today = input.today ?? nzTodayYmd();
  const fees = Array.isArray(input.feeAssessments) ? input.feeAssessments : [];

  const overdue = input.installments.filter(
    (i) => i.status !== 'paid' && i.status !== 'cancelled' && daysBetween(i.dueDate, today) > 0,
  );
  const earliestMissDate = overdue.map((i) => i.dueDate).sort()[0] ?? null;
  const daysPastDue = earliestMissDate ? daysBetween(earliestMissDate, today) : 0;
  const overdueAmountCents = overdue.reduce((sum, i) => sum + Math.round(i.amount * 100), 0);

  const lateFees = fees.filter((f) => f.type === 'late_payment');
  const defaultFees = fees.filter((f) => f.type === 'payment_default');
  const totals = arrearsChargeTotals(fees, input.arrears);
  const { lateFeeCents, defaultFeeCents, accruedInterestCents } = totals;
  const totalChargesCents = totals.totalCents;

  const lines: ArrearsChargeLine[] = fees
    .map((f) => ({
      id: f.id,
      type: f.type,
      label:
        f.type === 'late_payment'
          ? `Late payment fee${f.installmentNumber ? ` — instalment ${f.installmentNumber}` : ''}`
          : 'Payment default fee',
      amountCents: f.amountCents,
      assessedAt: toIso(f.assessedAt),
    }))
    .sort((a, b) => (a.assessedAt ?? '').localeCompare(b.assessedAt ?? ''));

  // What happens next if nothing is paid — only meaningful while overdue.
  const lateFeeIds = new Set(lateFees.map((f) => f.id));
  const lateFeeCapReached = lateFeeCents + LATE_PAYMENT_FEE * 100 > LATE_PAYMENT_FEE_MAX * 100;
  const pendingLateDays = lateFeeCapReached || !input.policyApplies
    ? []
    : overdue
        .filter((i) => !lateFeeIds.has(`late:${i.installmentNumber}`))
        .map((i) => Math.max(0, LATE_PAYMENT_GRACE_DAYS + 1 - daysBetween(i.dueDate, today)));
  const daysUntilLateFee = pendingLateDays.length > 0 ? Math.min(...pendingLateDays) : null;
  const daysUntilDefaultFee =
    input.policyApplies && overdue.length > 0 && defaultFees.length === 0
      ? Math.max(0, PAYMENT_DEFAULT_GRACE_DAYS + 1 - daysPastDue)
      : null;

  return {
    policyApplies: input.policyApplies,
    isOverdue: overdue.length > 0,
    daysPastDue,
    earliestMissDate,
    overdueAmountCents,
    lateFeeCents,
    lateFeeCount: lateFees.length,
    defaultFeeCents,
    accruedInterestCents,
    totalChargesCents,
    hasCharges: totalChargesCents > 0,
    lines,
    interestAccruedTo: input.arrears?.lastAssessedDate ?? null,
    daysUntilLateFee,
    daysUntilDefaultFee,
  };
}
