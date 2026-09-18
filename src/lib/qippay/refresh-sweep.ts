import { adminDb } from '@/lib/firebase/admin';
import { reconcilePaymentStatus } from '@/lib/qippay/reconcile-payments';
import { assessArrearsForApplication } from '@/lib/loan/assess-arrears';
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
 */
export async function runPaymentRefreshSweep(opts: {
  actor: string;
  ip?: string;
  /** Audit label stamped on each per-application reconciliation. */
  auditAction: string;
  maxApplications?: number;
}): Promise<RefreshSweepResult> {
  const { actor, ip, auditAction, maxApplications = DEFAULT_MAX_APPLICATIONS } = opts;

  const snap = await adminDb
    .collection('loanApplications')
    .where('paymentConsent.status', '==', 'active')
    .limit(maxApplications)
    .get();

  const result: RefreshSweepResult = {
    total: snap.size,
    processed: 0,
    changed: 0,
    errored: 0,
    feesAssessed: 0,
    remindersSent: 0,
    inArrears: 0,
    applications: [],
  };

  for (const doc of snap.docs) {
    const consent = doc.data().paymentConsent as PaymentConsent | undefined;
    const entry: RefreshSweepApplication = {
      applicationId: doc.id,
      consentStatus: consent?.status ?? 'not_started',
      changed: false,
      paidCount: 0,
      totalCount: 0,
      testCadenceMinutes: consent?.testCadence?.intervalMinutes ?? null,
    };

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

    // Arrears assessment runs after reconciliation so fees/interest reflect
    // the freshest payment state. Independent try/catch — an arrears failure
    // never aborts the sweep. No-op for loans without a fee-policy stamp.
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

    result.applications.push(entry);
  }

  return result;
}
