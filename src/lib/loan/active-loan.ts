import type {
  LoanApplication,
  ScheduledPayment,
  AnyApplicationStatus,
} from '@/types/application';

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

export interface ActiveLoanSummary {
  /** Total amount to repay across the whole loan (principal + fee + interest). */
  totalRepayable: number;
  /** Sum of instalments collected so far. */
  totalPaid: number;
  /** Outstanding balance — never negative. */
  remainingBalance: number;
  /** ISO date of the next instalment still owing, or null when nothing is due. */
  nextPaymentDate: string | null;
  /** Full ordered instalment list with per-instalment status. */
  installments: DerivedInstallment[];
  /** True once the whole balance has been collected. */
  isFullyPaid: boolean;
  /** True when an instalment is past due and still unpaid. */
  isDelinquent: boolean;
}

/** Only the fields of an application needed to derive the loan summary. */
export type LoanSummarySource = Pick<
  LoanApplication,
  'loanDetails' | 'scheduledPayments' | 'paymentConsent' | 'repaymentSchedule'
>;

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
  const totalPaid = round2(
    installments.filter((i) => i.status === 'paid').reduce((acc, i) => acc + i.amount, 0),
  );
  const remainingBalance = round2(Math.max(0, totalRepayable - totalPaid));

  const nextOwing = installments.find((i) => !SETTLED_STATUSES.has(i.status));
  const nextPaymentDate = nextOwing ? new Date(`${nextOwing.dueDate}T00:00:00.000Z`).toISOString() : null;

  const isFullyPaid = totalRepayable > 0 && remainingBalance <= 0.01;
  const isDelinquent = installments.some((i) => i.status === 'overdue' || i.status === 'failed');

  return {
    totalRepayable,
    totalPaid,
    remainingBalance,
    nextPaymentDate,
    installments,
    isFullyPaid,
    isDelinquent,
  };
}

/** True when the application represents a disbursed loan still being repaid. */
export function isLiveLoanStatus(status: AnyApplicationStatus | string | undefined): boolean {
  return status !== undefined && LIVE_LOAN_STATUSES.has(status);
}

/** True when the application represents a fully-settled loan. */
export function isClosedLoanStatus(status: AnyApplicationStatus | string | undefined): boolean {
  return status !== undefined && CLOSED_LOAN_STATUSES.has(status);
}
