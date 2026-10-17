import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { AppError } from '@/lib/utils/api-error';
import { auditLog } from '@/lib/utils/audit';
import { buildSchedule } from '@/lib/loan/repayment';
import { deriveLoanSummary } from '@/lib/loan/active-loan';
import { syncLoanRecord } from '@/lib/loan/loan-record';
import type {
  LoanApplication,
  ManualPaymentRecord,
  ScheduledPayment,
} from '@/types/application';

/**
 * Manual repayment mode — the path the platform runs on while the Qippay
 * feature flag (`qippayEnabled`) is OFF.
 *
 * Without a SetPay mandate nothing populates `scheduledPayments`, so at
 * disbursement we write the instalment schedule ourselves from the figures
 * agreed at approval, and the lender then marks each instalment as received
 * from the application page. Everything downstream (balances, arrears engine,
 * statements, the borrower's tracker) already reads `scheduledPayments`, so
 * recording a payment here is enough to keep every surface consistent.
 */

/** Today's NZ calendar date (YYYY-MM-DD). */
export function nzToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });
}

export type InitialiseManualScheduleResult = {
  created: boolean;
  payments: ScheduledPayment[];
  skippedReason?: 'already_scheduled' | 'no_approved_amount' | 'not_found';
};

/**
 * Write the instalment schedule for a freshly disbursed loan when Qippay is
 * not collecting it. Idempotent: an application that already has instalments
 * (Qippay-lodged or manual) is left untouched.
 *
 * Mirrors the consent flow's maths — a real reducing-balance amortisation
 * anchored on the disbursement date, so the final instalment trues up to the
 * cent rather than splitting a total four ways.
 */
export async function initialiseManualSchedule(opts: {
  applicationId: string;
  actor: string;
  ip?: string;
}): Promise<InitialiseManualScheduleResult> {
  const { applicationId, actor, ip } = opts;
  const appRef = adminDb.collection('loanApplications').doc(applicationId);
  const snap = await appRef.get();
  if (!snap.exists) return { created: false, payments: [], skippedReason: 'not_found' };
  const app = snap.data() as LoanApplication;

  const existing = Array.isArray(app.scheduledPayments)
    ? (app.scheduledPayments as ScheduledPayment[])
    : [];
  if (existing.length > 0) {
    return { created: false, payments: existing, skippedReason: 'already_scheduled' };
  }

  const approvedAmount = app.loanDetails?.approvedAmount;
  if (typeof approvedAmount !== 'number' || !(approvedAmount > 0)) {
    return { created: false, payments: [], skippedReason: 'no_approved_amount' };
  }

  const startDate = app.loanDetails?.disbursementDate ?? nzToday();
  const schedule = buildSchedule({ principal: approvedAmount, startDate });

  const payments: ScheduledPayment[] = schedule.rows.map((row) => ({
    installmentNumber: row.installmentNumber,
    dueDate: row.dueDate,
    amountCents: Math.round(row.amount * 100),
    status: 'pending',
    retryCount: 0,
  }));

  // Prefer the total agreed at approval: if it differs from the fresh
  // amortisation by a few cents (older rate config, rounding), true up the
  // final instalment so the borrower owes exactly what they signed for.
  const agreedTotal = app.loanDetails?.totalRepayment;
  if (typeof agreedTotal === 'number' && payments.length > 0) {
    const agreedCents = Math.round(agreedTotal * 100);
    const scheduledCents = payments.reduce((acc, p) => acc + p.amountCents, 0);
    const drift = agreedCents - scheduledCents;
    const last = payments[payments.length - 1];
    if (drift !== 0 && last.amountCents + drift > 0) {
      last.amountCents += drift;
    }
  }

  await appRef.update({
    scheduledPayments: payments,
    'timeline.updatedAt': FieldValue.serverTimestamp(),
  });

  await auditLog({
    userId: actor,
    action: 'manual_schedule_initialised',
    targetId: applicationId,
    targetType: 'application',
    outcome: 'success',
    ipAddress: ip,
    changes: {
      installments: payments.length,
      totalCents: payments.reduce((acc, p) => acc + p.amountCents, 0),
      startDate,
    },
  });

  return { created: true, payments };
}

export type RecordManualPaymentInput = {
  applicationId: string;
  installmentNumber: number;
  action: 'mark_paid' | 'mark_unpaid';
  /** Required for `mark_paid`. NZ calendar date, not in the future. */
  paidOn?: string;
  reference?: string;
  actor: { uid: string; name?: string };
  ip?: string;
};

export type RecordManualPaymentResult = {
  payments: ScheduledPayment[];
  /** Application status after the update (`closed_repaid` once every instalment is in). */
  status: string;
  paidCount: number;
  totalCount: number;
};

/**
 * Mark one instalment as received (or reverse a mistaken entry).
 *
 * Runs in a transaction against the application document so two lenders
 * cannot clobber each other's edits. Marking the final outstanding instalment
 * paid closes the loan (`closed_repaid`); reversing a payment on a closed loan
 * reopens it as `active`. The canonical `loans` record is re-synced after.
 */
export async function recordManualPayment(
  input: RecordManualPaymentInput,
): Promise<RecordManualPaymentResult> {
  const { applicationId, installmentNumber, action, paidOn, reference, actor, ip } = input;
  const appRef = adminDb.collection('loanApplications').doc(applicationId);

  if (action === 'mark_paid') {
    if (!paidOn) throw new AppError('VALIDATION_ERROR', 422, 'paidOn is required');
    if (paidOn > nzToday()) {
      throw new AppError('VALIDATION_ERROR', 422, 'Payment date cannot be in the future');
    }
  }

  const result = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(appRef);
    if (!snap.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');
    const app = snap.data() as LoanApplication;

    if (app.assignedLenderId && app.assignedLenderId !== actor.uid) {
      throw new AppError('FORBIDDEN', 403, 'Only the assigned lender can record repayments');
    }
    if (app.status !== 'disbursed' && app.status !== 'active' && app.status !== 'closed_repaid') {
      throw new AppError(
        'BAD_REQUEST',
        400,
        `Repayments can only be recorded on a disbursed loan (status: ${app.status})`,
      );
    }

    const payments: ScheduledPayment[] = Array.isArray(app.scheduledPayments)
      ? [...(app.scheduledPayments as ScheduledPayment[])]
      : [];
    const idx = payments.findIndex((p) => p.installmentNumber === installmentNumber);
    if (idx === -1) throw new AppError('NOT_FOUND', 404, 'Instalment not found');
    const current = payments[idx];

    // Never overwrite something Qippay actually collected or has in flight.
    if (current.qippayPaymentId) {
      throw new AppError(
        'CONFLICT',
        409,
        'This instalment is managed by Qippay and cannot be recorded manually',
      );
    }

    if (action === 'mark_paid') {
      if (current.status === 'success') {
        throw new AppError('CONFLICT', 409, 'This instalment is already marked paid');
      }
      const record: ManualPaymentRecord = {
        paidOn: paidOn!,
        recordedBy: actor.uid,
        recordedAt: Timestamp.now(),
        ...(reference ? { reference } : {}),
        ...(actor.name ? { recordedByName: actor.name } : {}),
      };
      const { failureReason: _drop, failedAt: _drop2, ...rest } = current;
      void _drop;
      void _drop2;
      payments[idx] = {
        ...rest,
        status: 'success',
        completedAt: Timestamp.fromDate(new Date(`${paidOn}T12:00:00+12:00`)),
        manualRecord: record,
      };
    } else {
      if (current.status !== 'success' || !current.manualRecord) {
        throw new AppError(
          'CONFLICT',
          409,
          'Only an instalment that was recorded manually can be reversed',
        );
      }
      const { completedAt: _c, manualRecord: _m, ...rest } = current;
      void _c;
      void _m;
      payments[idx] = { ...rest, status: 'pending' };
    }

    const summary = deriveLoanSummary({ ...app, scheduledPayments: payments });
    const paidCount = payments.filter((p) => p.status === 'success').length;

    let nextStatus: string = app.status;
    if (summary.isFullyPaid) {
      nextStatus = 'closed_repaid';
    } else if (app.status === 'closed_repaid') {
      nextStatus = 'active';
    }

    const now = FieldValue.serverTimestamp();
    const updates: Record<string, unknown> = {
      scheduledPayments: payments,
      'timeline.updatedAt': now,
    };
    if (nextStatus !== app.status) {
      updates.status = nextStatus;
      if (nextStatus === 'closed_repaid') updates['timeline.closedAt'] = now;
      else updates['timeline.closedAt'] = FieldValue.delete();
    }
    tx.update(appRef, updates);

    return {
      payments,
      status: nextStatus,
      previousStatus: app.status,
      paidCount,
      totalCount: payments.length,
      amountCents: current.amountCents,
    };
  });

  await auditLog({
    userId: actor.uid,
    action: action === 'mark_paid' ? 'manual_payment_recorded' : 'manual_payment_reversed',
    targetId: applicationId,
    targetType: 'application',
    outcome: 'success',
    ipAddress: ip,
    changes: {
      installmentNumber,
      amountCents: result.amountCents,
      ...(paidOn ? { paidOn } : {}),
      ...(reference ? { reference } : {}),
      paidCount: result.paidCount,
      totalCount: result.totalCount,
      ...(result.status !== result.previousStatus
        ? { statusFrom: result.previousStatus, statusTo: result.status }
        : {}),
    },
  });

  // Keep the canonical loan record (portfolio, statements) in step.
  await syncLoanRecord(applicationId);

  return {
    payments: result.payments,
    status: result.status,
    paidCount: result.paidCount,
    totalCount: result.totalCount,
  };
}
