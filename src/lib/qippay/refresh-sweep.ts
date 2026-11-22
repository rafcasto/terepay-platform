import { adminDb } from '@/lib/firebase/admin';
import { reconcilePaymentStatus } from '@/lib/qippay/reconcile-payments';
import { assessArrearsForApplication } from '@/lib/loan/assess-arrears';
import { sendUpcomingReminders } from '@/lib/loan/upcoming-reminders';
import { isQippayEnabled } from '@/lib/qippay/feature';
import { isArrearsAutoEnabled } from '@/lib/loan/arrears-feature';
import { isQippayManagedLoan } from '@/lib/loan/collection-mode';
import type { PaymentConsent, ScheduledPayment } from '@/types/application';

const DEFAULT_MAX_APPLICATIONS = 500;

export type RefreshSweepApplication = {
  applicationId: string;
  consentStatus: PaymentConsent['status'];
  changed: boolean;
  paidCount: number;
  totalCount: number;
  /** Interval in minutes when the consent uses the admin test cadence. */
  testCadenceMinutes: number | null;
  error?: string;
};

export type RefreshSweepResult = {
  /** `qippay` reconciles against the provider first; `manual` skips reconciliation. */
  mode: 'qippay' | 'manual';
  /** `auto` ran the arrears engine on every loan; `manual` left it to the lender. */
  arrearsMode: 'auto' | 'manual';
  total: number;
  processed: number;
  changed: number;
  errored: number;
  feesAssessed: number;
  remindersSent: number;
  inArrears: number;
  applications: RefreshSweepApplication[];
};

/**
 * Reconcile every active-consent loan against Qippay, then run each through
 * the arrears engine. Shared by the hourly cron (gated to once a day by the
 * admin Payment Refresh settings) and the admin "Verify now" action on the
 * SetPay Testing page, so both paths behave identically.
 *
 * While the Qippay feature flag is OFF there is nothing to reconcile — the
 * lender records repayments by hand — so the sweep instead walks every live
 * loan and only counts their state. With the flag ON, live loans that Qippay
 * is not collecting (written by hand before the flag went on) are still
 * walked the same way, so their reminders and arrears are never skipped.
 *
 * The arrears step runs only while the `arrears_auto_enabled` flag is ON.
 * With it off, late fees, overdue interest and the overdue reminder sequence
 * are applied solely when a lender runs "Assess arrears now" on the
 * application page — but the **upcoming-payment reminder** (1–3 days before
 * each instalment) is still sent by this sweep in both modes, so every
 * borrower is told before each collection / due date.
 */
export async function runPaymentRefreshSweep(opts: {
  actor: string;
  ip?: string;
  /** Audit label stamped on each per-application reconciliation. */
  auditAction: string;
  maxApplications?: number;
}): Promise<RefreshSweepResult> {
  const { actor, ip, auditAction, maxApplications = DEFAULT_MAX_APPLICATIONS } = opts;

  const [qippayOn, arrearsAuto] = await Promise.all([isQippayEnabled(), isArrearsAutoEnabled()]);

  const liveSnap = await adminDb
    .collection('loanApplications')
    .where('status', 'in', ['disbursed', 'active'])
    .limit(maxApplications)
    .get();

  // Qippay mode: every active-consent loan is reconciled (as before), and any
  // live loan Qippay is not collecting is walked as a manual loan.
  const docs = [...liveSnap.docs];
  if (qippayOn) {
    const consentSnap = await adminDb
      .collection('loanApplications')
      .where('paymentConsent.status', '==', 'active')
      .limit(maxApplications)
      .get();
    const seen = new Set(docs.map((d) => d.id));
    for (const d of consentSnap.docs) {
      if (!seen.has(d.id)) {
        docs.push(d);
        seen.add(d.id);
      }
    }
  }

  const result: RefreshSweepResult = {
    mode: qippayOn ? 'qippay' : 'manual',
    arrearsMode: arrearsAuto ? 'auto' : 'manual',
    total: docs.length,
    processed: 0,
    changed: 0,
    errored: 0,
    feesAssessed: 0,
    remindersSent: 0,
    inArrears: 0,
    applications: [],
  };

  for (const doc of docs) {
    const data = doc.data();
    const consent = data.paymentConsent as PaymentConsent | undefined;
    const reconcileWithQippay = qippayOn && isQippayManagedLoan(data);
    const entry: RefreshSweepApplication = {
      applicationId: doc.id,
      consentStatus: consent?.status ?? 'not_started',
      changed: false,
      paidCount: 0,
      totalCount: 0,
      testCadenceMinutes: consent?.testCadence?.intervalMinutes ?? null,
    };

    if (!reconcileWithQippay) {
      // Manual loan: the lender-recorded instalments are already the truth.
      const payments = (data.scheduledPayments as ScheduledPayment[] | undefined) ?? [];
      entry.totalCount = payments.length;
      entry.paidCount = payments.filter((p) => p.status === 'success').length;
      result.processed += 1;
    } else {
      try {
        const r = await reconcilePaymentStatus({
          applicationId: doc.id,
          callerUid: actor,
          ipAddress: ip,
          auditAction,
        });
        result.processed += 1;
        if (r.changed) result.changed += 1;
        const payments = r.scheduledPayments as ScheduledPayment[];
        entry.changed = r.changed;
        entry.consentStatus = r.consentStatus;
        entry.totalCount = payments.length;
        entry.paidCount = payments.filter((p) => p.status === 'success').length;
      } catch (err) {
        result.errored += 1;
        entry.error = 'reconcile_failed';
        console.error('[payment-refresh] failed to reconcile', doc.id, err);
      }
    }

    // Arrears assessment runs after reconciliation so fees/interest reflect
    // the freshest payment state. Independent try/catch — an arrears failure
    // never aborts the sweep. No-op for loans without a fee-policy stamp.
    // Skipped entirely while automatic arrears is behind its flag — the
    // lender triggers it per loan instead.
    if (arrearsAuto) {
      try {
        const arrears = await assessArrearsForApplication({
          applicationId: doc.id,
          actor,
          ip,
        });
        result.feesAssessed += arrears.newFeeCount;
        result.remindersSent += arrears.remindersSent;
        if (arrears.isInArrears) result.inArrears += 1;
      } catch (err) {
        result.errored += 1;
        entry.error = entry.error ?? 'arrears_failed';
        console.error('[payment-refresh] failed to assess arrears', doc.id, err);
      }
    } else {
      // Fees stay a lender decision, but the pre-due reminder always goes out.
      try {
        const upcoming = await sendUpcomingReminders({ applicationId: doc.id, actor, ip });
        result.remindersSent += upcoming.remindersSent;
      } catch (err) {
        result.errored += 1;
        entry.error = entry.error ?? 'reminders_failed';
        console.error('[payment-refresh] failed to send upcoming reminders', doc.id, err);
      }
    }

    result.applications.push(entry);
  }

  return result;
}
