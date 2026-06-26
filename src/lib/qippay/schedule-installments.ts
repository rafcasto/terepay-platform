import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { AppError } from '@/lib/utils/api-error';
import { auditLog } from '@/lib/utils/audit';
import { schedulePayment, getBeneficiaryId } from './setpay-client';
import { syncLoanRecord } from '@/lib/loan/loan-record';
import type { LoanApplication, PaymentConsent, ScheduledPayment } from '@/types/application';

/** Today's calendar date in NZ (Pacific/Auckland) as YYYY-MM-DD. */
export function nzToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });
}

export type ScheduleInstallmentsResult = {
  /** Instalments now lodged with Qippay (scheduled/retrying/success). */
  scheduledCount: number;
  /** Instalments still awaiting scheduling. */
  pendingCount: number;
  /** Instalments we actually attempted a POST /v1/setpay for this run. */
  attemptedCount: number;
  totalCount: number;
  /** The full, freshly-updated instalment array (for UI refresh). */
  payments: ScheduledPayment[];
  /** Set when nothing could be attempted (e.g. consent not active). */
  skippedReason?: string;
};

/**
 * Schedule every not-yet-lodged instalment of an application with Qippay.
 *
 * SetPay is a rolling-period consent: a future instalment can only be lodged
 * once its period is open, so this is designed to be **idempotent and
 * repeatable** — it lodges what it can now and leaves the rest `pending` for a
 * later run (the daily cron or the lender's manual trigger). Already-scheduled
 * or completed instalments are never touched.
 *
 * Used by:
 *   - the disbursement action (initial scheduling),
 *   - POST /api/applications/[id]/schedule-payments (manual retry),
 *   - GET /api/cron/schedule-payments (daily backfill).
 */
export async function scheduleInstallments(opts: {
  applicationId: string;
  actor: string;
  ip?: string;
}): Promise<ScheduleInstallmentsResult> {
  const { applicationId, actor, ip } = opts;
  const appRef = adminDb.collection('loanApplications').doc(applicationId);
  const snap = await appRef.get();
  if (!snap.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');
  const app = snap.data() as LoanApplication;

  const consent = app.paymentConsent as PaymentConsent | undefined;

  const emptyResult = (skippedReason: string): ScheduleInstallmentsResult => ({
    scheduledCount: 0,
    pendingCount: 0,
    attemptedCount: 0,
    totalCount: Array.isArray(app.scheduledPayments) ? app.scheduledPayments.length : 0,
    payments: (app.scheduledPayments as ScheduledPayment[]) ?? [],
    skippedReason,
  });

  if (!consent?.mandateId) return emptyResult('no_mandate');
  if (consent.status !== 'active') return emptyResult('consent_not_active');

  // Initialise the instalment array from the bank-authorised schedule the
  // first time (e.g. straight after disbursement).
  let payments: ScheduledPayment[] = Array.isArray(app.scheduledPayments)
    ? [...(app.scheduledPayments as ScheduledPayment[])]
    : [];
  if (payments.length === 0) {
    const summary = consent.scheduleSummary?.installments ?? [];
    payments = summary.map((inst, i) => ({
      installmentNumber: i + 1,
      dueDate: inst.dueDate,
      amountCents: inst.amountCents,
      status: 'pending',
      retryCount: 0,
    }));
  }
  if (payments.length === 0) return emptyResult('no_schedule');

  let beneficiaryId = '';
  try {
    beneficiaryId = getBeneficiaryId();
  } catch {
    // Not configured — every pending instalment will be recorded as such.
  }

  const today = nzToday();
  const shortRef = applicationId.slice(0, 12);
  let attempted = 0;

  // Schedule sequentially (lowest instalment first) so the consent's per-period
  // availability is consumed near-term-first and we don't race Qippay's checks.
  payments.sort((a, b) => a.installmentNumber - b.installmentNumber);

  for (let i = 0; i < payments.length; i++) {
    const p = payments[i];
    if (p.status !== 'pending') continue; // already lodged / terminal — leave it

    // Qippay requires a future NZ calendar date (cannot be today or past).
    if (p.dueDate <= today) {
      payments[i] = {
        ...p,
        failureReason: 'Due date has passed — instalment can no longer be scheduled',
        lastAttemptAt: Timestamp.now(),
        scheduleAttempts: (p.scheduleAttempts ?? 0) + 1,
      };
      continue;
    }

    if (!beneficiaryId) {
      payments[i] = {
        ...p,
        failureReason: 'Payment beneficiary is not configured',
        lastAttemptAt: Timestamp.now(),
        scheduleAttempts: (p.scheduleAttempts ?? 0) + 1,
      };
      continue;
    }

    attempted++;
    try {
      const scheduled = await schedulePayment({
        epcId: consent.mandateId,
        beneficiaryId,
        amountCents: p.amountCents,
        scheduledFor: `${p.dueDate}T00:00:00.000Z`,
        statementParticulars: 'TerePay',
        statementCode: `Inst${p.installmentNumber}`,
        statementReference: shortRef,
      });

      // Success — drop any prior failureReason for a clean row.
      const { failureReason: _drop, ...rest } = p;
      void _drop;
      payments[i] = {
        ...rest,
        status: 'scheduled',
        qippayPaymentId: scheduled.paymentId,
        scheduledAt: Timestamp.now(),
        lastAttemptAt: Timestamp.now(),
        scheduleAttempts: (p.scheduleAttempts ?? 0) + 1,
      };
    } catch (err) {
      const reason =
        err instanceof AppError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      payments[i] = {
        ...p,
        status: 'pending',
        failureReason: reason,
        lastAttemptAt: Timestamp.now(),
        scheduleAttempts: (p.scheduleAttempts ?? 0) + 1,
      };
    }
  }

  await appRef.update({
    scheduledPayments: payments,
    'timeline.updatedAt': FieldValue.serverTimestamp(),
  });

  const lodgedStatuses: ScheduledPayment['status'][] = ['scheduled', 'retrying', 'success'];
  const scheduledCount = payments.filter((p) => lodgedStatuses.includes(p.status)).length;
  const pendingCount = payments.filter((p) => p.status === 'pending').length;

  if (attempted > 0) {
    await auditLog({
      userId: actor,
      action: 'setpay_payments_scheduled',
      targetId: applicationId,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
      changes: {
        mandateId: consent.mandateId,
        totalInstallments: payments.length,
        attempted,
        scheduledCount,
        pendingCount,
      },
    });
  }

  // Keep the canonical loan record in sync (no-op until it exists).
  await syncLoanRecord(applicationId);

  return {
    scheduledCount,
    pendingCount,
    attemptedCount: attempted,
    totalCount: payments.length,
    payments,
  };
}
