import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { encrypt } from '@/lib/encryption/crypto';
import { auditLog } from '@/lib/utils/audit';
import {
  getDetailedConsentStatus,
  getMandateStatus,
  getMode,
  isRecognisedConsentStatus,
  normaliseProviderStatus,
  normaliseStatus,
  type GetMandateStatusOptions,
  type NormalisedConsentStatus,
  type SetPayMandate,
} from './setpay-client';
import type { PaymentConsent } from '@/types/application';

const STALE_THRESHOLD_MS = 10_000;
const TERMINAL: ReadonlySet<PaymentConsent['status']> = new Set([
  'active',
  'failed',
  'expired',
  'cancelled',
]);

/**
 * Who asked for the reconciliation. `webhook` and `cron` are the server-side
 * paths that make consent activation independent of the applicant's browser;
 * the others are user-driven.
 */
export type ReconcileCaller =
  | 'applicant'
  | 'lender'
  | 'return-page'
  | 'webhook'
  | 'cron'
  | 'admin';

export type ReconcileResult = {
  status: PaymentConsent['status'];
  providerStatus?: string;
  activatedAt?: string;
  failureReason?: string;
  hostedUrl?: string;
  mandateId?: string;
  scheduleSummary?: PaymentConsent['scheduleSummary'];
  /** True when this call moved the consent to a new status. */
  changed?: boolean;
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

type UpstreamVerdict = {
  normalised: NormalisedConsentStatus;
  /** Raw status string we persist as `lastStatusFromProvider`. */
  rawStatus: string;
  /** Bank-side status from the detailed endpoint, when it was consulted. */
  providerStatus?: string;
  /** False when neither endpoint returned a status we know how to read. */
  recognised: boolean;
  verifiedBankAccount?: SetPayMandate['verifiedBankAccount'];
};

/**
 * Ask Qippay what state the mandate is in and translate it into our
 * vocabulary. The plain `GET /v1/enduring_initiation/{id}` status is the
 * primary source. When it is a string we do not recognise (a wording change
 * upstream, a new intermediate state) we do NOT silently treat it as
 * "still pending": we consult the detailed status endpoint and use the
 * bank-side `providerStatus.Status` (NZ open-banking vocabulary) as a second
 * opinion. Only when both are unreadable is the state left untouched — and
 * that is reported to the caller so it can be audited and surfaced.
 */
async function fetchUpstreamVerdict(
  mandateId: string,
  stubHint: GetMandateStatusOptions['stubHint'],
): Promise<UpstreamVerdict> {
  const upstream = await getMandateStatus(mandateId, { stubHint });
  const rawStatus = upstream.status ?? '';
  const primary = normaliseStatus(rawStatus);

  if (isRecognisedConsentStatus(rawStatus)) {
    return {
      normalised: primary,
      rawStatus,
      recognised: true,
      verifiedBankAccount: upstream.verifiedBankAccount,
    };
  }

  // Stub mode always returns a recognised status; the detailed stub would
  // report success unconditionally, so never fall back to it there.
  if (getMode() === 'stub') {
    return { normalised: primary, rawStatus, recognised: false, verifiedBankAccount: upstream.verifiedBankAccount };
  }

  let detailedStatus: string | undefined;
  let providerStatus: string | undefined;
  try {
    const detailed = await getDetailedConsentStatus(mandateId);
    detailedStatus = detailed.status;
    providerStatus = detailed.providerStatus?.status;
  } catch (err) {
    console.warn('[reconcile-consent] detailed status fallback failed', {
      mandateId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const fromProvider = normaliseProviderStatus(providerStatus);
  if (fromProvider) {
    return {
      normalised: fromProvider,
      rawStatus: `${rawStatus || 'unknown'} / bank:${providerStatus}`,
      providerStatus,
      recognised: true,
      verifiedBankAccount: upstream.verifiedBankAccount,
    };
  }
  if (detailedStatus && isRecognisedConsentStatus(detailedStatus)) {
    return {
      normalised: normaliseStatus(detailedStatus),
      rawStatus: `${rawStatus || 'unknown'} / detail:${detailedStatus}`,
      providerStatus,
      recognised: true,
      verifiedBankAccount: upstream.verifiedBankAccount,
    };
  }

  return {
    normalised: 'initiated',
    rawStatus: rawStatus || 'unknown',
    providerStatus,
    recognised: false,
    verifiedBankAccount: upstream.verifiedBankAccount,
  };
}

/**
 * Refresh `paymentConsent` against the upstream SetPay status. Idempotent:
 * - returns cached state when terminal or fetched within STALE_THRESHOLD_MS
 *   (pass `force` to skip the freshness window — the webhook does, because
 *   it knows something just changed)
 * - otherwise calls SetPay, atomically writes the next state, and audits
 *   any terminal transition. On `active`, also overwrites the application's
 *   `bankDetails.accountNumber` with the bank-verified one when they differ.
 *
 * Upstream/network errors propagate to the caller: a failed check must never
 * look like "still pending" to the person waiting on it.
 */
export async function reconcileConsent(params: {
  applicationId: string;
  caller: ReconcileCaller;
  callerUid: string;
  stubHint?: GetMandateStatusOptions['stubHint'];
  ipAddress?: string;
  /** Skip the 10 s freshness window and always ask Qippay. */
  force?: boolean;
}): Promise<ReconcileResult> {
  const { applicationId, caller, callerUid, stubHint, ipAddress, force = false } = params;
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
    !force &&
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
      changed: false,
    };
  }

  // Phase 2: call upstream.
  const verdict = await fetchUpstreamVerdict(consent.mandateId, stubHint);
  const { normalised } = verdict;

  // Phase 3: atomic write of the next state.
  let transitionedToActive = false;
  let transitionedToFailure = false;
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
      'paymentConsent.lastStatusFromProvider': verdict.rawStatus,
    };

    if (normalised === 'active' && current.status !== 'active') {
      updates['paymentConsent.status'] = 'active';
      updates['paymentConsent.activatedAt'] = now;
      updates['timeline.updatedAt'] = now;
      transitionedToActive = true;

      if (verdict.verifiedBankAccount) {
        updates['paymentConsent.verifiedBankAccount'] = {
          accountNumber: encrypt(verdict.verifiedBankAccount.accountNumber),
          ...(verdict.verifiedBankAccount.accountName
            ? { accountName: verdict.verifiedBankAccount.accountName }
            : {}),
          ...(verdict.verifiedBankAccount.bankName
            ? { bankName: verdict.verifiedBankAccount.bankName }
            : {}),
        };

        const previousAccount = data.bankDetails?.accountNumber;
        const prevLast4 = last4(previousAccount);
        const newLast4 = last4(verdict.verifiedBankAccount.accountNumber);
        if (prevLast4 !== newLast4) {
          updates['bankDetails.accountNumber'] = encrypt(
            verdict.verifiedBankAccount.accountNumber,
          );
          bankAccountOverwriteAudit = { oldLast4: prevLast4, newLast4 };
        }
      }
    } else if (
      normalised === 'failed' ||
      normalised === 'expired' ||
      normalised === 'cancelled'
    ) {
      updates['paymentConsent.status'] = normalised;
      updates['paymentConsent.failureReason'] = verdict.rawStatus;
      updates['timeline.updatedAt'] = now;
      transitionedToFailure = true;
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
        providerStatus: verdict.rawStatus,
        caller,
      },
    });
  } else if (transitionedToFailure) {
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
        providerStatus: verdict.rawStatus,
        caller,
      },
    });
  }

  if (!verdict.recognised) {
    // Loud, not silent: an unknown status means our vocabulary has drifted
    // from Qippay's and a mandate the customer may well have authorised is
    // sitting in "pending" on our side.
    console.warn('[reconcile-consent] unrecognised SetPay status', {
      applicationId,
      mandateId: consent.mandateId,
      status: verdict.rawStatus,
      providerStatus: verdict.providerStatus,
      caller,
    });
    await auditLog({
      userId: callerUid,
      action: 'payment_consent_status_unrecognised',
      targetId: applicationId,
      targetType: 'application',
      outcome: 'failure',
      ipAddress,
      changes: {
        mandateId: consent.mandateId,
        providerStatus: verdict.rawStatus,
        bankStatus: verdict.providerStatus,
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
      providerStatus: verdict.rawStatus,
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
    changed: transitionedToActive || transitionedToFailure,
  };
}
