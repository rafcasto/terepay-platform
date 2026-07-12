import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { auditLog } from '@/lib/utils/audit';
import { getPaymentStatus, normalisePayByStatus, type GetPayByStatusOptions } from './payby-client';
import { syncLoanRecord } from '@/lib/loan/loan-record';
import { deriveLoanSummary } from '@/lib/loan/active-loan';
import type {
  EarlyRepayment,
  EarlyRepaymentStatus,
  LoanApplication,
  ScheduledPayment,
} from '@/types/application';

const STALE_THRESHOLD_MS = 10_000;
const TERMINAL: ReadonlySet<EarlyRepaymentStatus> = new Set([
  'paid',
  'expired',
  'failed',
  'cancelled',
]);

export type ReconcileEarlyRepaymentResult = {
  status: EarlyRepaymentStatus;
  providerStatus?: string;
  paidAt?: string;
  failureReason?: string;
  hostedUrl?: string;
  paymentId?: string;
  totalPayoffCents?: number;
};

function tsToIso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'object' && value !== null && '_seconds' in value) {
    const seconds = (value as { _seconds: number })._seconds;
    return new Date(seconds * 1000).toISOString();
  }
  return undefined;
}

function resultFrom(er: EarlyRepayment): ReconcileEarlyRepaymentResult {
  return {
    status: er.status,
    providerStatus: er.lastStatusFromProvider,
    paidAt: tsToIso(er.paidAt),
    failureReason: er.failureReason,
    hostedUrl: er.hostedUrl,
    paymentId: er.paymentId,
    totalPayoffCents: er.quote?.totalPayoffCents,
  };
}

/**
 * Build the "everything settled" scheduledPayments array used when an early
 * payoff succeeds: every not-already-cancelled instalment becomes `success`.
 * Sourced from the live derived schedule so it works whether the loan carried
 * `scheduledPayments`, `paymentConsent.scheduleSummary`, or the legacy field.
 */
function buildSettledSchedule(app: LoanApplication): ScheduledPayment[] {
  const existing: ScheduledPayment[] = Array.isArray(app.scheduledPayments)
    ? (app.scheduledPayments as ScheduledPayment[])
    : [];
  const byNumber = new Map(existing.map((p) => [p.installmentNumber, p]));

  const summary = deriveLoanSummary(app);
  const now = Timestamp.now();

  return summary.installments.map((inst) => {
    const prev = byNumber.get(inst.installmentNumber);
    const alreadyCancelled = inst.status === 'cancelled' || prev?.status === 'cancelled';
    if (prev?.status === 'success') return prev;
    return {
      installmentNumber: inst.installmentNumber,
      dueDate: inst.dueDate,
      amountCents: Math.round(inst.amount * 100),
      status: alreadyCancelled ? ('cancelled' as const) : ('success' as const),
      ...(prev?.qippayPaymentId ? { qippayPaymentId: prev.qippayPaymentId } : {}),
      ...(alreadyCancelled ? {} : { completedAt: now }),
      retryCount: prev?.retryCount ?? 0,
    };
  });
}

/**
 * Refresh an application's `earlyRepayment` against the upstream PayBy payment
 * status and, on `success`, settle the loan in full: mark all outstanding
 * instalments paid, close the loan, and sync the `loans` record. Idempotent —
 * returns cached state when terminal or checked within STALE_THRESHOLD_MS, and
 * never applies the payoff twice.
 */
export async function reconcileEarlyRepayment(params: {
  applicationId: string;
  caller: 'applicant' | 'lender' | 'return-page' | 'cron';
  callerUid: string;
  stubHint?: GetPayByStatusOptions['stubHint'];
  ipAddress?: string;
}): Promise<ReconcileEarlyRepaymentResult> {
  const { applicationId, caller, callerUid, stubHint, ipAddress } = params;
  const appRef = adminDb.collection('loanApplications').doc(applicationId);

  const before = await appRef.get();
  if (!before.exists) return { status: 'not_started' };
  const beforeApp = before.data() as LoanApplication;
  const er = beforeApp.earlyRepayment;
  if (!er || !er.paymentId) return { status: er?.status ?? 'not_started' };

  const lastCheckedAt = tsToIso(er.lastStatusCheckedAt);
  const fresh =
    lastCheckedAt && Date.now() - new Date(lastCheckedAt).getTime() < STALE_THRESHOLD_MS;
  if (TERMINAL.has(er.status) || fresh) return resultFrom(er);

  // Call upstream.
  const upstream = await getPaymentStatus(er.paymentId, { stubHint });
  const normalised = normalisePayByStatus(upstream.status);

  let settled = false;

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(appRef);
    if (!snap.exists) return;
    const app = snap.data() as LoanApplication;
    const current = app.earlyRepayment;
    if (!current || current.paymentId !== er.paymentId) return;
    if (TERMINAL.has(current.status)) return;

    const now = FieldValue.serverTimestamp();
    const updates: Record<string, unknown> = {
      'earlyRepayment.lastStatusCheckedAt': now,
      'earlyRepayment.lastStatusFromProvider': upstream.status,
      'timeline.updatedAt': now,
    };

    if (normalised === 'paid') {
      settled = true;
      updates['earlyRepayment.status'] = 'paid';
      updates['earlyRepayment.paidAt'] = now;
      updates['earlyRepayment.appliedAt'] = now;
      // Settle the loan: every outstanding instalment is now paid.
      updates.scheduledPayments = buildSettledSchedule(app);
      updates.status = 'closed_repaid';
      updates['timeline.closedAt'] = now;
    } else if (normalised === 'expired' || normalised === 'failed' || normalised === 'cancelled') {
      updates['earlyRepayment.status'] = normalised;
      updates['earlyRepayment.failureReason'] = upstream.status;
    } else {
      updates['earlyRepayment.status'] = normalised; // 'pending' | 'initiated'
    }

    tx.update(appRef, updates);
  });

  if (settled) {
    // Best-effort: keep the canonical `loans` record in step (closed + zero balance).
    await syncLoanRecord(applicationId);
    await auditLog({
      userId: callerUid,
      action: 'early_repayment_settled',
      targetId: applicationId,
      targetType: 'application',
      outcome: 'success',
      ipAddress,
      changes: {
        paymentId: er.paymentId,
        providerStatus: upstream.status,
        totalPayoffCents: er.quote?.totalPayoffCents,
        caller,
      },
    });
  } else if (normalised === 'expired' || normalised === 'failed' || normalised === 'cancelled') {
    await auditLog({
      userId: callerUid,
      action: 'early_repayment_failed',
      targetId: applicationId,
      targetType: 'application',
      outcome: 'failure',
      ipAddress,
      changes: { paymentId: er.paymentId, finalStatus: normalised, providerStatus: upstream.status, caller },
    });
  } else {
    await auditLog({
      userId: callerUid,
      action: 'early_repayment_status_checked',
      targetId: applicationId,
      targetType: 'application',
      outcome: 'success',
      ipAddress,
      changes: { paymentId: er.paymentId, providerStatus: upstream.status, caller },
    });
  }

  const after = await appRef.get();
  const finalEr = (after.data() as LoanApplication | undefined)?.earlyRepayment;
  if (!finalEr) return { status: 'not_started' };
  return resultFrom(finalEr);
}
