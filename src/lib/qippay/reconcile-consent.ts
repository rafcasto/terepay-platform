import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { encrypt } from '@/lib/encryption/crypto';
import { auditLog } from '@/lib/utils/audit';
import {
  getMandateStatus,
  normaliseStatus,
  type GetMandateStatusOptions,
} from './setpay-client';
import type { PaymentConsent } from '@/types/application';

const STALE_THRESHOLD_MS = 10_000;
const TERMINAL: ReadonlySet<PaymentConsent['status']> = new Set([
  'active',
  'failed',
  'expired',
  'cancelled',
]);

export type ReconcileResult = {
  status: PaymentConsent['status'];
  providerStatus?: string;
  activatedAt?: string;
  failureReason?: string;
  hostedUrl?: string;
  mandateId?: string;
  scheduleSummary?: PaymentConsent['scheduleSummary'];
};

function last4(account: string | undefined): string {
  if (!account) return '';
  const digits = account.replace(/\D/g, '');
  return digits.length <= 4 ? digits : digits.slice(-4);
}

function tsToIso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'object' && value !== null && '_seconds' in value) {
    const seconds = (value as { _seconds: number })._seconds;
    return new Date(seconds * 1000).toISOString();
  }
  return undefined;
}

/**
 * Refresh `paymentConsent` against the upstream SetPay status. Idempotent:
 * - returns cached state when terminal or fetched within STALE_THRESHOLD_MS
 * - otherwise calls SetPay, atomically writes the next state, and audits
 *   any terminal transition. On `active`, also overwrites the application's
 *   `bankDetails.accountNumber` with the bank-verified one when they differ.
 */
export async function reconcileConsent(params: {
  applicationId: string;
  caller: 'applicant' | 'lender' | 'return-page';
  callerUid: string;
  stubHint?: GetMandateStatusOptions['stubHint'];
  ipAddress?: string;
}): Promise<ReconcileResult> {
  const { applicationId, caller, callerUid, stubHint, ipAddress } = params;
  const appRef = adminDb.collection('loanApplications').doc(applicationId);

  // Phase 1: read current state, decide whether to fetch upstream.
  const before = await appRef.get();
  if (!before.exists) {
    return { status: 'not_started' };
  }
  const beforeData = before.data() as {
    paymentConsent?: PaymentConsent;
    bankDetails?: { accountNumber?: string };
  };
  const consent = beforeData.paymentConsent;
  if (!consent) {
    return { status: 'not_started' };
  }

  const lastCheckedAt = tsToIso(consent.lastStatusCheckedAt);
  const fresh =
    lastCheckedAt &&
    Date.now() - new Date(lastCheckedAt).getTime() < STALE_THRESHOLD_MS;

  if (TERMINAL.has(consent.status) || fresh) {
    return {
      status: consent.status,
      providerStatus: consent.lastStatusFromProvider,
      activatedAt: tsToIso(consent.activatedAt),
      failureReason: consent.failureReason,
      hostedUrl: consent.hostedUrl,
      mandateId: consent.mandateId,
      scheduleSummary: consent.scheduleSummary,
    };
  }

  // Phase 2: call upstream.
  const upstream = await getMandateStatus(consent.mandateId, { stubHint });
  const normalised = normaliseStatus(upstream.status);

  // Phase 3: atomic write of the next state.
  let transitionedToActive = false;
  let bankAccountOverwriteAudit: { oldLast4: string; newLast4: string } | null =
    null;

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(appRef);
    if (!snap.exists) return;
    const data = snap.data() as {
      paymentConsent?: PaymentConsent;
      bankDetails?: { accountNumber?: string };
    };
    const current = data.paymentConsent;
    if (!current || current.mandateId !== consent.mandateId) return;
    if (TERMINAL.has(current.status)) return;

    const now = FieldValue.serverTimestamp();
    const updates: Record<string, unknown> = {
      'paymentConsent.lastStatusCheckedAt': now,
      'paymentConsent.lastStatusFromProvider': upstream.status,
    };

    if (normalised === 'active' && current.status !== 'active') {
      updates['paymentConsent.status'] = 'active';
      updates['paymentConsent.activatedAt'] = now;
      transitionedToActive = true;

      if (upstream.verifiedBankAccount) {
        updates['paymentConsent.verifiedBankAccount'] = {
          accountNumber: encrypt(upstream.verifiedBankAccount.accountNumber),
          ...(upstream.verifiedBankAccount.accountName
            ? { accountName: upstream.verifiedBankAccount.accountName }
            : {}),
          ...(upstream.verifiedBankAccount.bankName
            ? { bankName: upstream.verifiedBankAccount.bankName }
            : {}),
        };

        const previousAccount = data.bankDetails?.accountNumber;
        const prevLast4 = last4(previousAccount);
        const newLast4 = last4(upstream.verifiedBankAccount.accountNumber);
        if (prevLast4 !== newLast4) {
          updates['bankDetails.accountNumber'] = encrypt(
            upstream.verifiedBankAccount.accountNumber,
          );
          bankAccountOverwriteAudit = { oldLast4: prevLast4, newLast4 };
        }
      }
    } else if (
      (normalised === 'failed' ||
        normalised === 'expired' ||
        normalised === 'cancelled') &&
      !TERMINAL.has(current.status)
    ) {
      updates['paymentConsent.status'] = normalised;
      updates['paymentConsent.failureReason'] = upstream.status;
    }

    tx.update(appRef, updates);
  });

  // Phase 4: side-effects after the transaction commits.
  if (transitionedToActive) {
    await auditLog({
      userId: callerUid,
      action: 'payment_consent_activated',
      targetId: applicationId,
      targetType: 'application',
      outcome: 'success',
      ipAddress,
      changes: {
        mandateId: consent.mandateId,
        providerStatus: upstream.status,
        caller,
      },
    });
  } else if (
    normalised === 'failed' ||
    normalised === 'expired' ||
    normalised === 'cancelled'
  ) {
    await auditLog({
      userId: callerUid,
      action: 'payment_consent_failed',
      targetId: applicationId,
      targetType: 'application',
      outcome: 'failure',
      ipAddress,
      changes: {
        mandateId: consent.mandateId,
        finalStatus: normalised,
        providerStatus: upstream.status,
        caller,
      },
    });
  }

  if (bankAccountOverwriteAudit) {
    await auditLog({
      userId: callerUid,
      action: 'bank_account_overwritten_by_consent',
      targetId: applicationId,
      targetType: 'application',
      outcome: 'success',
      ipAddress,
      changes: bankAccountOverwriteAudit,
    });
  }

  await auditLog({
    userId: callerUid,
    action: 'payment_consent_status_checked',
    targetId: applicationId,
    targetType: 'application',
    outcome: 'success',
    ipAddress,
    changes: {
      mandateId: consent.mandateId,
      providerStatus: upstream.status,
      caller,
    },
  });

  // Phase 5: re-read final state and return.
  const after = await appRef.get();
  const finalConsent = (after.data() as { paymentConsent?: PaymentConsent })
    ?.paymentConsent;
  if (!finalConsent) return { status: 'not_started' };

  return {
    status: finalConsent.status,
    providerStatus: finalConsent.lastStatusFromProvider,
    activatedAt: tsToIso(finalConsent.activatedAt),
    failureReason: finalConsent.failureReason,
    hostedUrl: finalConsent.hostedUrl,
    mandateId: finalConsent.mandateId,
    scheduleSummary: finalConsent.scheduleSummary,
  };
}
