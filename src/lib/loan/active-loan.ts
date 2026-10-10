import type {
  LoanApplication,
  LoanLedger,
  LoanLedgerLine,
  ScheduledPayment,
  AnyApplicationStatus,
} from '@/types/application';
import { arrearsChargeTotals } from './arrears-charges';
import { toDate } from './format';

/**
 * Statuses where a loan has been disbursed and is being (or has been) repaid.
 * These represent a *live* loan obligation on the applicant.
 */
const LIVE_LOAN_STATUSES: ReadonlySet<string> = new Set([
  'disbursed',
  'active',
  'funded',
]);

/** Statuses where the loan is fully settled. */
const CLOSED_LOAN_STATUSES: ReadonlySet<string> = new Set([
  'closed_repaid',
  'completed',
]);

export type DerivedInstallmentStatus =
  | 'paid'
  | 'scheduled'
  | 'upcoming'
  | 'retrying'
  | 'failed'
  | 'cancelled'
  | 'overdue';

export interface DerivedInstallment {
  installmentNumber: number;
  dueDate: string; // YYYY-MM-DD
  amount: number; // NZD
  status: DerivedInstallmentStatus;
}

/**
 * How an early payoff actually settled the loan. Every figure comes from the
 * quote snapshotted at initiation (`earlyRepayment.quote`) — the amount the
 * borrower's bank really moved — never from instalment face values.
 */
export interface EarlySettlement {
  /** ISO datetime the PayBy payment was confirmed, when known. */
  settledAt: string | null;
  /** NZ calendar date (YYYY-MM-DD) interest was charged up to. */
  settlementDate: string | null;
  /** Total the borrower paid to settle (NZD). */
  amountPaid: number;
  /** Face value of the instalments the payoff replaced (NZD). */
  instalmentsReplaced: number;
  instalmentsCleared: number[];
  /** Principal still owed at settlement (actuarial loans only). */
  outstandingPrincipal?: number;
  /** Interest accrued from the last charge date to settlement (actuarial loans only). */
  accruedInterest?: number;
  accrualFromDate?: string;
  accrualDays?: number;
  /** Interest the borrower did not have to pay by settling early (≥ 0). */
  interestRebate: number;
  /** Fixed prepayment fee charged. */
  fee: number;
  /** Late fees, default fee and overdue interest collected in the payoff. */
  arrearsCharges: number;
  method?: string;
}

export interface ActiveLoanSummary {
  /** Contractual total across the whole loan (principal + scheduled interest). */
  totalRepayable: number;
  /**
   * Cash actually received from the borrower. Instalments collected by direct
   * debit count at face value; an early payoff counts at the amount paid
   * (principal + interest accrued to settlement + fee + arrears charges), not
   * at the face value of the instalments it replaced.
   */
  totalPaid: number;
  /**
   * Instalment balance still owing before arrears charges — never negative,
   * and 0 once the loan is settled early. The arrears engine accrues interest
   * on this figure, so it deliberately excludes fees.
   */
  remainingBalance: number;
  /** Late fees, default fee and overdue interest still owing (NZD; 0 once settled). */
  arrearsChargesOutstanding: number;
  /** remainingBalance + arrearsChargesOutstanding — what the borrower must pay. */
  totalOwing: number;
  /** ISO date of the next instalment still owing, or null when nothing is due. */
  nextPaymentDate: string | null;
  /** Full ordered instalment list with per-instalment status. */
  installments: DerivedInstallment[];
  /** True once the whole balance has been collected. */
  isFullyPaid: boolean;
  /** True when an instalment is past due and still unpaid. */
  isDelinquent: boolean;
  /** True once the borrower settled the loan early via PayBy. */
  settledEarly: boolean;
  settlement: EarlySettlement | null;
  /** Itemised cost of the loan — the one breakdown every surface renders. */
  ledger: LoanLedger;
}

/** Only the fields of an application needed to derive the loan summary. */
export type LoanSummarySource = Pick<
  LoanApplication,
  | 'loanDetails'
  | 'scheduledPayments'
  | 'paymentConsent'
  | 'repaymentSchedule'
  | 'earlyRepayment'
  | 'feeAssessments'
  | 'arrears'
> & { timeline?: Partial<LoanApplication['timeline']> };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapScheduledStatus(
  status: ScheduledPayment['status'],
  dueDate: string,
): DerivedInstallmentStatus {
  switch (status) {
    case 'success':
      return 'paid';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'retrying':
      return 'retrying';
    case 'scheduled':
    case 'pending':
      // Anything still owing whose due date has passed is overdue.
      return dueDate < todayYmd() ? 'overdue' : status === 'scheduled' ? 'scheduled' : 'upcoming';
    default:
      return 'upcoming';
  }
}

const SETTLED_STATUSES: ReadonlySet<DerivedInstallmentStatus> = new Set([
  'paid',
  'cancelled',
]);

/**
 * Derive a borrower-facing loan summary (balance, next payment, full schedule)
 * from a loan application.
 *
 * The canonical source of repayment data, in priority order:
 *   1. `scheduledPayments` — created at disbursement, carries live per-instalment status.
 *   2. `paymentConsent.scheduleSummary.installments` — the schedule the applicant
 *      authorised when they linked their bank (pre-disbursement).
 *   3. `repaymentSchedule.installments` — legacy field.
 *
 * Note: the dedicated `loans` collection is not relied upon here because the
 * disbursement flow does not populate it — the application document is the
 * source of truth.
 */
export function deriveLoanSummary(app: LoanSummarySource): ActiveLoanSummary {
  const installments: DerivedInstallment[] = [];

  const scheduled = app.scheduledPayments ?? [];
  const consentInstallments = app.paymentConsent?.scheduleSummary?.installments ?? [];
  const legacy = app.repaymentSchedule?.installments ?? [];

  if (scheduled.length > 0) {
    for (const p of [...scheduled].sort((a, b) => a.installmentNumber - b.installmentNumber)) {
      installments.push({
        installmentNumber: p.installmentNumber,
        dueDate: p.dueDate,
        amount: round2(p.amountCents / 100),
        status: mapScheduledStatus(p.status, p.dueDate),
      });
    }
  } else if (consentInstallments.length > 0) {
    consentInstallments.forEach((inst, i) => {
      installments.push({
        installmentNumber: i + 1,
        dueDate: inst.dueDate,
        amount: round2(inst.amountCents / 100),
        status: inst.dueDate < todayYmd() ? 'overdue' : 'scheduled',
      });
    });
  } else if (legacy.length > 0) {
    for (const inst of legacy) {
      installments.push({
        installmentNumber: inst.installmentNumber,
        dueDate: inst.dueDate,
        amount: round2(inst.amount),
        status:
          inst.status === 'paid'
            ? 'paid'
            : inst.status === 'overdue'
              ? 'overdue'
              : inst.status === 'retrying'
                ? 'retrying'
                : 'scheduled',
      });
    }
  }

  const scheduleTotal = installments.reduce((acc, i) => acc + i.amount, 0);
  const totalRepayable = round2(app.loanDetails?.totalRepayment ?? scheduleTotal);

  // Face value of every instalment marked paid. An early payoff marks the
  // instalments it clears as paid at face value so the schedule reads as
  // complete — the cash actually received is reconciled below.
  const paidInstalments = installments.filter((i) => i.status === 'paid');
  const paidFaceValue = round2(paidInstalments.reduce((acc, i) => acc + i.amount, 0));

  const settlement = deriveSettlement(app, paidInstalments);
  const settledEarly = settlement !== null;

  const totalPaid = settledEarly
    ? round2(paidFaceValue - settlement.instalmentsReplaced + settlement.amountPaid)
    : paidFaceValue;

  const remainingBalance = settledEarly ? 0 : round2(Math.max(0, totalRepayable - paidFaceValue));

  // Arrears charges: owed while the loan is live; once settled early they were
  // either collected in the payoff (`arrearsCharges`) or never charged.
  const charges = arrearsChargeTotals(app.feeAssessments, app.arrears);
  const arrearsChargesOutstanding = settledEarly ? 0 : round2(charges.totalCents / 100);
  const totalOwing = round2(remainingBalance + arrearsChargesOutstanding);

  const nextOwing = settledEarly
    ? undefined
    : installments.find((i) => !SETTLED_STATUSES.has(i.status));
  const nextPaymentDate = nextOwing ? new Date(`${nextOwing.dueDate}T00:00:00.000Z`).toISOString() : null;

  const isFullyPaid = settledEarly || (totalRepayable > 0 && remainingBalance <= 0.01);
  const isDelinquent =
    !settledEarly && installments.some((i) => i.status === 'overdue' || i.status === 'failed');

  const ledger = buildLedger({
    app,
    totalRepayable,
    totalPaid,
    totalOwing,
    settlement,
  });

  return {
    totalRepayable,
    totalPaid,
    remainingBalance,
    arrearsChargesOutstanding,
    totalOwing,
    nextPaymentDate,
    installments,
    isFullyPaid,
    isDelinquent,
    settledEarly,
    settlement,
    ledger,
  };
}

/**
 * Read the early settlement off a paid `earlyRepayment`, or null when the loan
 * was not (or not yet) settled early.
 */
function deriveSettlement(
  app: LoanSummarySource,
  paidInstalments: DerivedInstallment[],
): EarlySettlement | null {
  const er = app.earlyRepayment;
  if (!er || er.status !== 'paid') return null;
  const quote = er.quote;
  if (!quote || typeof quote.totalPayoffCents !== 'number') return null;

  const cleared = new Set(quote.installmentsCleared ?? []);
  const instalmentsReplaced = round2(
    paidInstalments
      .filter((i) => cleared.has(i.installmentNumber))
      .reduce((acc, i) => acc + i.amount, 0),
  );
  const breakdown = quote.rebateBreakdown;

  return {
    settledAt: toDate(er.paidAt as Parameters<typeof toDate>[0])?.toISOString() ?? null,
    settlementDate: breakdown?.settlementDate ?? null,
    amountPaid: round2(quote.totalPayoffCents / 100),
    instalmentsReplaced,
    instalmentsCleared: [...cleared].sort((a, b) => a - b),
    outstandingPrincipal: breakdown?.outstandingPrincipal,
    accruedInterest: breakdown?.accruedInterest,
    accrualFromDate: breakdown?.accrualFromDate,
    accrualDays: breakdown?.accrualDays,
    interestRebate: round2(Math.max(0, quote.unearnedInterestRebateCents ?? 0) / 100),
    fee: round2((quote.prepaymentFeeCents ?? 0) / 100),
    arrearsCharges: round2(Math.max(0, quote.arrearsChargesCents ?? 0) / 100),
    method: breakdown?.method,
  };
}

function isoOf(value: unknown): string | undefined {
  return toDate(value as Parameters<typeof toDate>[0])?.toISOString();
}

/**
 * Itemise what the loan has cost. Lines are ordered the way a statement reads
 * them: what was borrowed, the interest it was priced with, any arrears
 * charges, then the adjustments an early settlement made.
 */
function buildLedger(params: {
  app: LoanSummarySource;
  totalRepayable: number;
  totalPaid: number;
  totalOwing: number;
  settlement: EarlySettlement | null;
}): LoanLedger {
  const { app, totalRepayable, totalPaid, totalOwing, settlement } = params;
  const ld = app.loanDetails;

  const principal = round2(
    typeof ld?.approvedAmount === 'number' && ld.approvedAmount > 0
      ? ld.approvedAmount
      : totalRepayable,
  );
  const scheduledInterest = round2(Math.max(0, totalRepayable - principal));
  const ratePct =
    typeof ld?.interestRate === 'number' ? Math.round(ld.interestRate * 1000) / 10 : null;
  const disbursedAt = isoOf(app.timeline?.disbursedAt) ?? ld?.disbursementDate;

  const lines: LoanLedgerLine[] = [
    { id: 'principal', kind: 'principal', label: 'Amount borrowed', amount: principal, date: disbursedAt },
    {
      id: 'scheduled_interest',
      kind: 'scheduled_interest',
      label: ratePct !== null && ld?.rateModel
        ? `Interest over the scheduled term (${ratePct}% p.a. on the reducing balance)`
        : 'Interest over the scheduled term',
      amount: scheduledInterest,
    },
  ];

  // Arrears charges are part of the cost once the loan is live. After an early
  // settlement only the charges actually collected in the payoff count.
  const fees = Array.isArray(app.feeAssessments) ? app.feeAssessments : [];
  const chargesCounted = settlement ? settlement.arrearsCharges > 0 : true;
  const totals = arrearsChargeTotals(fees, app.arrears);
  const lateFees = chargesCounted ? round2(totals.lateFeeCents / 100) : 0;
  const lateFeeCount = chargesCounted ? totals.lateFeeCount : 0;
  const defaultFee = chargesCounted ? round2(totals.defaultFeeCents / 100) : 0;
  const overdueInterest = chargesCounted ? round2(totals.accruedInterestCents / 100) : 0;

  if (chargesCounted) {
    const feeLines = [...fees].sort((a, b) =>
      (isoOf(a.assessedAt) ?? '').localeCompare(isoOf(b.assessedAt) ?? ''),
    );
    for (const f of feeLines) {
      lines.push({
        id: `fee:${f.id}`,
        kind: f.type === 'late_payment' ? 'late_fee' : 'default_fee',
        label:
          f.type === 'late_payment'
            ? `Late payment fee${f.installmentNumber ? ` — instalment ${f.installmentNumber}` : ''}`
            : 'Payment default fee',
        amount: round2(f.amountCents / 100),
        date: isoOf(f.assessedAt),
      });
    }
    if (overdueInterest > 0) {
      lines.push({
        id: 'overdue_interest',
        kind: 'overdue_interest',
        label: 'Interest on overdue balance',
        amount: overdueInterest,
        date: app.arrears?.lastAssessedDate,
        note: app.arrears?.earliestMissDate
          ? `Charged daily from ${app.arrears.earliestMissDate}`
          : undefined,
      });
    }
  }

  const interestRebate = settlement?.interestRebate ?? 0;
  const earlyRepaymentFee = settlement?.fee ?? 0;
  if (settlement) {
    const when = settlement.settlementDate ?? settlement.settledAt ?? undefined;
    if (interestRebate > 0) {
      lines.push({
        id: 'interest_rebate',
        kind: 'interest_rebate',
        label: 'Interest not charged — loan settled early',
        amount: -interestRebate,
        date: when,
        note:
          typeof settlement.accrualDays === 'number' && typeof settlement.accruedInterest === 'number'
            ? `Interest stopped at settlement; ${settlement.accrualDays} day${settlement.accrualDays === 1 ? '' : 's'} of interest (${fmtNzd(settlement.accruedInterest)}) charged since the last instalment`
            : undefined,
      });
    }
    if (earlyRepaymentFee > 0) {
      lines.push({
        id: 'early_repayment_fee',
        kind: 'early_repayment_fee',
        label: 'Early repayment fee',
        amount: earlyRepaymentFee,
        date: when,
      });
    }
  }

  const interestCharged = round2(scheduledInterest - interestRebate + overdueInterest);
  const feesCharged = round2(earlyRepaymentFee + lateFees + defaultFee);
  const totalCost = round2(principal + interestCharged + feesCharged);

  return {
    principal,
    scheduledInterest,
    interestRebate,
    earlyRepaymentFee,
    lateFees,
    lateFeeCount,
    defaultFee,
    overdueInterest,
    interestCharged,
    feesCharged,
    totalCost,
    totalPaid,
    outstanding: totalOwing,
    lines,
  };
}

function fmtNzd(n: number): string {
  return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(n);
}

/**
 * Strip Firestore `Timestamp` fields (`scheduledAt`, `completedAt`, `failedAt`,
 * `lastAttemptAt`) so the instalment array can be safely passed from a Server
 * Component to a Client Component — Timestamps are class instances and Next.js
 * refuses to serialise them across that boundary.
 */
export function toPlainScheduledPayments(payments: ScheduledPayment[]): ScheduledPayment[] {
  return payments.map((p) => ({
    installmentNumber: p.installmentNumber,
    dueDate: p.dueDate,
    ...(p.dueAt ? { dueAt: p.dueAt } : {}),
    amountCents: p.amountCents,
    status: p.status,
    retryCount: p.retryCount,
    ...(p.qippayPaymentId ? { qippayPaymentId: p.qippayPaymentId } : {}),
    ...(p.failureReason ? { failureReason: p.failureReason } : {}),
    ...(p.scheduleAttempts !== undefined ? { scheduleAttempts: p.scheduleAttempts } : {}),
  }));
}

/** True when the application represents a disbursed loan still being repaid. */
export function isLiveLoanStatus(status: AnyApplicationStatus | string | undefined): boolean {
  return status !== undefined && LIVE_LOAN_STATUSES.has(status);
}

/** True when the application represents a fully-settled loan. */
export function isClosedLoanStatus(status: AnyApplicationStatus | string | undefined): boolean {
  return status !== undefined && CLOSED_LOAN_STATUSES.has(status);
}
