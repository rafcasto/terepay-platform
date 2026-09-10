import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { AppError } from '@/lib/utils/api-error';
import { auditLog } from '@/lib/utils/audit';
import {
  schedulePayment,
  getBeneficiaryId,
  getDefaultSetPayMockFailure,
  isSetPayMockFailureEnabled,
  parseSetPayMockFailureFromEmail,
} from './setpay-client';
import { syncLoanRecord } from '@/lib/loan/loan-record';
import type {
  LoanApplication,
  PaymentConsent,
  ScheduledPayment,
  SetPayMockFailure,
} from '@/types/application';

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
/**
 * Days Qippay will auto-retry a failed instalment (insufficient funds etc.).
 * Retries land on the following calendar day, but ONLY while still inside the
 * instalment's active fortnightly period (SetPay Integrated rev 1, p.6) — so a
 * miss near the period boundary may get fewer than this many attempts. Our
 * arrears engine + Resend reminders are the resolution flow Qippay recommends.
 */
const SETPAY_MAX_RETRY_DAYS = 4;

type MockFailureSource = 'request' | 'email' | 'env';

/**
 * UAT only — decide which Qippay failure simulation (if any) applies to this
 * run. Precedence: explicit request body → applicant email tag
 * (`setpayfail-…`) → QIPPAY_MOCK_SETPAY_FAILURE_DEFAULT. Skips the extra
 * Firestore read entirely when simulation is disabled (always on production).
 */
async function resolveMockFailure(
  explicit: SetPayMockFailure[] | undefined,
  applicantId: string,
): Promise<{ sequence: SetPayMockFailure[]; source: MockFailureSource } | undefined> {
  if (!isSetPayMockFailureEnabled()) return undefined;
  if (explicit && explicit.length > 0) return { sequence: explicit, source: 'request' };

  try {
    const userSnap = await adminDb.collection('users').doc(applicantId).get();
    const user = userSnap.data() as { email?: string } | undefined;
    const fromEmail = parseSetPayMockFailureFromEmail(user?.email);
    if (fromEmail) return { sequence: fromEmail, source: 'email' };
  } catch (err) {
    console.warn('[setpay] Could not read applicant email for mock-failure tag', err);
  }

  const fromEnv = getDefaultSetPayMockFailure();
  return fromEnv ? { sequence: fromEnv, source: 'env' } : undefined;
}

export async function scheduleInstallments(opts: {
  applicationId: string;
  actor: string;
  ip?: string;
  /**
   * UAT only — Qippay failure simulation attached to every instalment lodged
   * in this run. When omitted, falls back to the applicant's `setpayfail-…`
   * email tag, then QIPPAY_MOCK_SETPAY_FAILURE_DEFAULT. Ignored (never sent)
   * unless `isSetPayMockFailureEnabled()`.
   */
  mockFailure?: SetPayMockFailure[];
}): Promise<ScheduleInstallmentsResult> {
  const { applicationId, actor, ip } = opts;
  const appRef = adminDb.collection('loanApplications').doc(applicationId);
  const snap = await appRef.get();
  if (!snap.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');
  const app = snap.data() as LoanApplication;

  const mock = await resolveMockFailure(opts.mockFailure, app.applicantId);
  const mockFailure = mock?.sequence;

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
  const failures: { installmentNumber: number; code: string; reason: string }[] = [];

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
        maxRetry: SETPAY_MAX_RETRY_DAYS,
        mockFailure,
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
        // Record what we asked Qippay to simulate so the lender panel can
        // explain the eventual retry/failure and the audit trail is explicit.
        ...(mockFailure && mockFailure.length > 0 ? { mockFailure: [...mockFailure] } : {}),
      };
    } catch (err) {
      const reason =
        err instanceof AppError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      const code = err instanceof AppError ? err.code : 'UNKNOWN';
      failures.push({ installmentNumber: p.installmentNumber, code, reason });
      // The failure is persisted as `failureReason` and the run continues, so
      // this is the only place the underlying cause reaches the server logs.
      console.error('[setpay] schedulePayment failed', {
        applicationId,
        installmentNumber: p.installmentNumber,
        dueDate: p.dueDate,
        amountCents: p.amountCents,
        code,
        reason,
        details: err instanceof AppError ? err.details : undefined,
        ...(mock ? { mockSetpayFailure: mock.sequence, mockSetpayFailureSource: mock.source } : {}),
      });
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
      outcome: failures.length > 0 ? 'failure' : 'success',
      ipAddress: ip,
      ...(failures.length > 0
        ? { errorDetail: failures.map((f) => `#${f.installmentNumber} ${f.code}: ${f.reason}`).join('; ') }
        : {}),
      changes: {
        mandateId: consent.mandateId,
        totalInstallments: payments.length,
        attempted,
        scheduledCount,
        pendingCount,
        failedCount: failures.length,
        ...(failures.length > 0 ? { failures } : {}),
        ...(mock ? { mockSetpayFailure: mock.sequence, mockSetpayFailureSource: mock.source } : {}),
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
