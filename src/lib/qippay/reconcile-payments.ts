import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { auditLog } from '@/lib/utils/audit';
import { getDetailedConsentStatus } from './setpay-client';
import type { PaymentConsent, ScheduledPayment } from '@/types/application';

type OverallStatus = Awaited<
  ReturnType<typeof getDetailedConsentStatus>
>['consentOverallStatus'];

export type ReconcilePaymentsResult = {
  scheduledPayments: ScheduledPayment[];
  consentStatus: PaymentConsent['status'];
  consentOverallStatus: OverallStatus | null;
  /** True when the reconciliation wrote a change to Firestore. */
  changed: boolean;
};

/**
 * Refresh an application's `scheduledPayments` against the upstream Qippay
 * SetPay detailed status endpoint (real-time bank check with count_complete).
 *
 * Shared by the on-demand "Check Status" API route and the daily cron sweep:
 *   - advances 'scheduled'/'retrying' instalments to 'success' once
 *     count_complete has caught up to their installmentNumber
 *   - marks pending/scheduled/retrying instalments 'cancelled' and the consent
 *     'cancelled' when the provider reports the mandate revoked
 *
 * Only calls upstream when the consent is `active`; otherwise returns the
 * stored state untouched. Never throws for a missing app/consent — callers
 * treat that as "nothing to do".
 */
export async function reconcilePaymentStatus(params: {
  applicationId: string;
  callerUid: string;
  ipAddress?: string;
  /** Audit action label. Defaults to the on-demand check label. */
  auditAction?: string;
}): Promise<ReconcilePaymentsResult> {
  const {
    applicationId,
    callerUid,
    ipAddress,
    auditAction = 'setpay_payment_status_checked',
  } = params;

  const appRef = adminDb.collection('loanApplications').doc(applicationId);
  const appSnap = await appRef.get();
  if (!appSnap.exists) {
    return { scheduledPayments: [], consentStatus: 'not_started', consentOverallStatus: null, changed: false };
  }

  const appData = appSnap.data()!;
  const consent = appData.paymentConsent as PaymentConsent | undefined;

  const storedPayments: ScheduledPayment[] = Array.isArray(appData.scheduledPayments)
    ? (appData.scheduledPayments as ScheduledPayment[])
    : [];

  // Nothing to poll unless there is an active mandate.
  if (!consent || !consent.mandateId || consent.status !== 'active') {
    return {
      scheduledPayments: storedPayments,
      consentStatus: consent?.status ?? 'not_started',
      consentOverallStatus: null,
      changed: false,
    };
  }

  const detailed = await getDetailedConsentStatus(consent.mandateId);
  const countComplete = detailed.consentOverallStatus?.countComplete ?? 0;

  const providerRevoked =
    detailed.providerStatus?.status?.toLowerCase() === 'revoked' ||
    detailed.status?.toLowerCase() === 'revoked';

  let changed = false;
  const updates: Record<string, unknown> = {
    'timeline.updatedAt': FieldValue.serverTimestamp(),
  };

  if (storedPayments.length > 0) {
    const reconciled = storedPayments.map((p) => {
      if (p.status === 'success') return p; // already terminal
      if (providerRevoked && (p.status === 'pending' || p.status === 'scheduled' || p.status === 'retrying')) {
        changed = true;
        return { ...p, status: 'cancelled' as const };
      }
      if (p.installmentNumber <= countComplete && (p.status === 'scheduled' || p.status === 'retrying')) {
        changed = true;
        // Timestamp.now(), not FieldValue.serverTimestamp() — sentinels are
        // rejected inside array elements by Firestore.
        return { ...p, status: 'success' as const, completedAt: Timestamp.now() };
      }
      return p;
    });
    if (changed) {
      updates.scheduledPayments = reconciled;
    }
  }

  if (providerRevoked && consent.status === 'active') {
    changed = true;
    updates['paymentConsent.status'] = 'cancelled';
    updates['paymentConsent.failureReason'] = 'revoked_by_customer';
  }

  if (changed) {
    await appRef.update(updates);
  }

  const finalSnap = await appRef.get();
  const finalData = finalSnap.data()!;
  const finalPayments: ScheduledPayment[] = Array.isArray(finalData.scheduledPayments)
    ? (finalData.scheduledPayments as ScheduledPayment[])
    : [];

  await auditLog({
    userId: callerUid,
    action: auditAction,
    targetId: applicationId,
    targetType: 'application',
    outcome: 'success',
    ipAddress,
    changes: {
      mandateId: consent.mandateId,
      countComplete,
      providerRevoked,
      ...(changed
        ? { reconciledCount: finalPayments.filter((p) => p.status === 'success').length }
        : {}),
    },
  });

  return {
    scheduledPayments: finalPayments,
    consentStatus: (finalData.paymentConsent?.status as PaymentConsent['status']) ?? consent.status,
    consentOverallStatus: detailed.consentOverallStatus,
    changed,
  };
}
