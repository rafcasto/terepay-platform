import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { AppError } from '@/lib/utils/api-error';
import { auditLog } from '@/lib/utils/audit';
import {
  schedulePayment,
  getBeneficiaryId,
  getReturnBaseUrl,
  getDetailedConsentStatus,
} from './setpay-client';
import type { SetPayConsentOverallStatus, SetPayDetailedStatus } from './setpay-client';
import { syncLoanRecord } from '@/lib/loan/loan-record';
import { buildTestCadenceTimes } from '@/lib/admin/setpay-test-settings';
import type { LoanApplication, PaymentConsent, ScheduledPayment } from '@/types/application';

/** ISO datetime Qippay should collect this instalment at. */
function scheduledForOf(p: Pick<ScheduledPayment, 'dueDate' | 'dueAt'>): string {
  return p.dueAt ?? `${p.dueDate}T00:00:00.000Z`;
}

/** Today's calendar date in NZ (Pacific/Auckland) as YYYY-MM-DD. */
export function nzToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });
}

/** Instalment statuses that mean Qippay already holds a payment for it. */
const LODGED_STATUSES: ReadonlyArray<ScheduledPayment['status']> = ['scheduled', 'retrying', 'success'];

/** True when `iso` falls inside the consent period (inclusive bounds). */
function inPeriod(iso: string, period: SetPayConsentOverallStatus): boolean {
  if (!period.periodStart || !period.periodEnd) return false;
  const t = Date.parse(iso);
  return t >= Date.parse(period.periodStart) && t <= Date.parse(period.periodEnd);
}

type UpstreamCheck =
  /** Qippay already holds a payment for this instalment's period that we have no record of. */
  | { outcome: 'already_scheduled'; periodIndex: number }
  /** Nothing unaccounted for in the period — safe to (re-)send. */
  | { outcome: 'not_found' }
  /** Qippay does not report the instalment's period, so nothing can have been lodged in it yet. */
  | { outcome: 'period_not_open' };

/**
 * Duplicate-payment guard for re-sends (Qippay integration review, point 2).
 *
 * A `POST /v1/setpay` that failed on our side — the 8s fetch timeout, a 5xx, a
 * dropped connection — may still have been accepted by Qippay. Re-sending the
 * instalment blindly would then collect it twice. So before any instalment
 * that has already been attempted is sent again, the scheduler reads the
 * consent's detailed status (`GET /v1/enduring_initiation/{epcId}/status`) and
 * checks whether a payment is already scheduled for that instalment's period.
 *
 * The endpoint reports per-period totals rather than per-payment IDs, so the
 * check compares the upstream `count_scheduled + count_complete` for the period
 * against the instalments we already know are lodged in that same period (the
 * admin test cadence can place several in one Daily period). An upstream count
 * higher than ours is the lost lodgement, and the instalment is adopted as
 * `scheduled` instead of being sent again.
 */
function checkAlreadyScheduledUpstream(
  p: ScheduledPayment,
  all: ScheduledPayment[],
  detailed: SetPayDetailedStatus,
): UpstreamCheck {
  const when = scheduledForOf(p);
  const periods: SetPayConsentOverallStatus[] =
    detailed.periodStatus.length > 0
      ? detailed.periodStatus
      : detailed.consentOverallStatus
        ? [detailed.consentOverallStatus]
        : [];
  const period = periods.find((per) => inPeriod(when, per));
  if (!period) return { outcome: 'period_not_open' };

  const knownInPeriod = all.filter(
    (q) =>
      q.installmentNumber !== p.installmentNumber &&
      LODGED_STATUSES.includes(q.status) &&
      inPeriod(scheduledForOf(q), period),
  ).length;
  const upstreamInPeriod = period.countScheduled + period.countComplete;

  return upstreamInPeriod > knownInPeriod
    ? { outcome: 'already_scheduled', periodIndex: period.periodIndex }
    : { outcome: 'not_found' };
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
  // Extra document fields written alongside the instalment array.
  const extraUpdates: Record<string, unknown> = {};
  if (payments.length === 0) {
    const summary = consent.scheduleSummary?.installments ?? [];
    // Test cadence (non-production): start the minute clock *now*, at first
    // lodgement, rather than at consent — otherwise a lender disbursing an
    // hour after the applicant consented would find every window missed.
    const testTimes = consent.testCadence
      ? buildTestCadenceTimes(summary.length, consent.testCadence.intervalMinutes)
      : undefined;
    payments = summary.map((inst, i) => ({
      installmentNumber: i + 1,
      dueDate: testTimes ? testTimes[i].dueDate : inst.dueDate,
      ...(testTimes ? { dueAt: testTimes[i].dueAt } : {}),
      amountCents: inst.amountCents,
      status: 'pending',
      retryCount: 0,
    }));
    if (testTimes) {
      extraUpdates['paymentConsent.testCadence.anchoredAt'] = new Date().toISOString();
      extraUpdates['paymentConsent.scheduleSummary.installments'] = summary.map((inst, i) => ({
        ...inst,
        dueDate: testTimes[i].dueDate,
        dueAt: testTimes[i].dueAt,
      }));
    }
  }
  if (payments.length === 0) return emptyResult('no_schedule');

  let beneficiaryId = '';
  try {
    beneficiaryId = getBeneficiaryId();
  } catch {
    // Not configured — every pending instalment will be recorded as such.
  }

  // Qippay requires a `success_url` on every POST /v1/setpay (used by its
  // Hosted fallback page when a payer resolves a failed instalment via a
  // different bank/account). Reuse the consent-return page — it is the URL
  // already registered with Qippay for this application.
  let successUrl = '';
  let failureUrl = '';
  try {
    const returnBaseUrl = getReturnBaseUrl();
    successUrl = `${returnBaseUrl}/applicant/applications/${applicationId}/consent/return?outcome=success`;
    failureUrl = `${returnBaseUrl}/applicant/applications/${applicationId}/consent/return?outcome=failure`;
  } catch {
    // Not configured — handled per-instalment below, like beneficiaryId.
  }

  const today = nzToday();
  const shortRef = applicationId.slice(0, 12);
  let attempted = 0;
  const failures: { installmentNumber: number; code: string; reason: string }[] = [];
  // Instalments found already scheduled at Qippay and adopted without a re-send.
  const adopted: number[] = [];
  // Detailed consent status, fetched lazily the first time a re-send is
  // considered and invalidated after every POST so the per-period counts
  // always include what this run has already lodged.
  let detailed: SetPayDetailedStatus | null = null;

  // Schedule sequentially (lowest instalment first) so the consent's per-period
  // availability is consumed near-term-first and we don't race Qippay's checks.
  payments.sort((a, b) => a.installmentNumber - b.installmentNumber);

  for (let i = 0; i < payments.length; i++) {
    const p = payments[i];
    if (p.status !== 'pending') continue; // already lodged / terminal — leave it

    // Qippay requires a future NZ calendar date (cannot be today or past).
    // Test-cadence instalments carry an exact `dueAt` and are compared by time.
    const isPast = p.dueAt ? Date.parse(p.dueAt) <= Date.now() : p.dueDate <= today;
    if (isPast) {
      payments[i] = {
        ...p,
        failureReason: p.dueAt
          ? 'Due time has passed — instalment can no longer be scheduled'
          : 'Due date has passed — instalment can no longer be scheduled',
        lastAttemptAt: Timestamp.now(),
        scheduleAttempts: (p.scheduleAttempts ?? 0) + 1,
      };
      continue;
    }

    // Re-send guard: this instalment has been attempted before, so confirm
    // Qippay is not already holding it before sending it again.
    if ((p.scheduleAttempts ?? 0) > 0) {
      if (!detailed) {
        try {
          detailed = await getDetailedConsentStatus(consent.mandateId);
        } catch (err) {
          // Fail closed: without the status we cannot rule out a duplicate, so
          // leave the instalment pending for the next run rather than collect twice.
          const reason = err instanceof Error ? err.message : String(err);
          console.error('[setpay] status check before re-send failed', {
            applicationId,
            installmentNumber: p.installmentNumber,
            reason,
          });
          payments[i] = {
            ...p,
            failureReason:
              'Could not confirm with Qippay whether this instalment is already scheduled — not re-sent, will retry',
            lastAttemptAt: Timestamp.now(),
          };
          continue;
        }
      }
      const check = checkAlreadyScheduledUpstream(p, payments, detailed);
      if (check.outcome === 'already_scheduled') {
        console.warn('[setpay] instalment already scheduled at Qippay — not re-sent', {
          applicationId,
          installmentNumber: p.installmentNumber,
          periodIndex: check.periodIndex,
          previousFailure: p.failureReason,
        });
        const { failureReason: _drop, ...rest } = p;
        void _drop;
        payments[i] = {
          ...rest,
          status: 'scheduled',
          scheduledAt: Timestamp.now(),
          lastAttemptAt: Timestamp.now(),
        };
        adopted.push(p.installmentNumber);
        continue;
      }
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

    if (!successUrl) {
      payments[i] = {
        ...p,
        failureReason: 'Payment return URL is not configured',
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
        scheduledFor: scheduledForOf(p),
        statementParticulars: 'TerePay',
        statementCode: `Inst${p.installmentNumber}`,
        statementReference: shortRef,
        maxRetry: SETPAY_MAX_RETRY_DAYS,
        successUrl,
        failureUrl,
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
      detailed = null; // upstream counts changed
    } catch (err) {
      detailed = null; // the request may have landed — never reuse stale counts
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
    ...extraUpdates,
    scheduledPayments: payments,
    'timeline.updatedAt': FieldValue.serverTimestamp(),
  });

  const lodgedStatuses: ScheduledPayment['status'][] = ['scheduled', 'retrying', 'success'];
  const scheduledCount = payments.filter((p) => lodgedStatuses.includes(p.status)).length;
  const pendingCount = payments.filter((p) => p.status === 'pending').length;

  if (attempted > 0 || adopted.length > 0) {
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
        testCadence: consent.testCadence?.intervalMinutes ?? false,
        attempted,
        scheduledCount,
        pendingCount,
        failedCount: failures.length,
        ...(failures.length > 0 ? { failures } : {}),
        ...(adopted.length > 0 ? { adoptedFromStatus: adopted } : {}),
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
