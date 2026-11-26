import { adminDb } from '@/lib/firebase/admin';
import { reconcileConsent } from '@/lib/qippay/reconcile-consent';
import { isQippayEnabled } from '@/lib/qippay/feature';
import type { PaymentConsent, PaymentConsentStatus } from '@/types/application';

const DEFAULT_MAX_APPLICATIONS = 200;

/** SetPay consent states that still need an upstream check. */
const IN_FLIGHT: readonly PaymentConsentStatus[] = ['initiated', 'redirected'];

export type ConsentSweepApplication = {
  applicationId: string;
  before: PaymentConsentStatus;
  after: PaymentConsentStatus;
  error?: string;
};

export type ConsentSweepResult = {
  /** `qippay` checked SetPay upstream; `disabled` means the flag is off and nothing ran. */
  mode: 'qippay' | 'disabled';
  total: number;
  processed: number;
  /** Mandates confirmed `active` by this sweep — the lender can now disburse. */
  activated: number;
  /** Mandates that ended `failed` / `expired` / `cancelled` upstream. */
  ended: number;
  /** Still `initiated` / `redirected` after the check. */
  stillPending: number;
  errored: number;
  applications: ConsentSweepApplication[];
};

/**
 * Background reconciliation for in-flight SetPay consents.
 *
 * Until this sweep existed, a mandate only became `active` on our side when
 * the APPLICANT's browser told us: the return page after the bank redirect, or
 * the CIBA poller on their application page. An applicant who approved the
 * "ongoing payment" in their banking app and never came back (closed the tab,
 * the bank bounced them into a browser without our session, the push was
 * approved later on the phone) left the application at
 * `awaiting_payment_consent` with the consent still `redirected` — and the
 * lender saw "Awaiting Bank Authorisation" for a loan the customer had in
 * fact authorised.
 *
 * This walks every application still gated on consent and runs the same
 * idempotent reconciler the return page uses, so the state converges within
 * the hour without any customer action. The `enduring.status.success`
 * webhook does the same thing immediately; this is the safety net for a
 * missed or misconfigured webhook.
 *
 * Runs on EVERY hourly cron tick (not behind the once-a-day payment-refresh
 * gate) and from the admin "Verify now" action. Safe to call as often as you
 * like: `reconcileConsent` never overwrites a terminal state.
 */
export async function runConsentSweep(opts: {
  actor: string;
  ip?: string;
  maxApplications?: number;
}): Promise<ConsentSweepResult> {
  const { actor, ip, maxApplications = DEFAULT_MAX_APPLICATIONS } = opts;

  const result: ConsentSweepResult = {
    mode: 'disabled',
    total: 0,
    processed: 0,
    activated: 0,
    ended: 0,
    stillPending: 0,
    errored: 0,
    applications: [],
  };

  // Flag off → no consent gate, so there is nothing in flight to check.
  if (!(await isQippayEnabled())) return result;
  result.mode = 'qippay';

  const snap = await adminDb
    .collection('loanApplications')
    .where('status', '==', 'awaiting_payment_consent')
    .limit(maxApplications)
    .get();

  const docs = snap.docs.filter((d) => {
    const consent = d.data().paymentConsent as PaymentConsent | undefined;
    return Boolean(consent?.mandateId) && IN_FLIGHT.includes(consent!.status);
  });
  result.total = docs.length;

  for (const doc of docs) {
    const before = (doc.data().paymentConsent as PaymentConsent).status;
    const entry: ConsentSweepApplication = { applicationId: doc.id, before, after: before };

    try {
      const r = await reconcileConsent({
        applicationId: doc.id,
        caller: 'cron',
        callerUid: actor,
        ipAddress: ip,
        // The sweep is the slow path; a user may have checked seconds ago.
        force: false,
      });
      entry.after = r.status;
      result.processed += 1;
      if (r.status === 'active') result.activated += 1;
      else if (r.status === 'failed' || r.status === 'expired' || r.status === 'cancelled') {
        result.ended += 1;
      } else result.stillPending += 1;
    } catch (err) {
      result.errored += 1;
      entry.error = err instanceof Error ? err.message : String(err);
      console.error('[consent-sweep] reconcile failed', { applicationId: doc.id, error: entry.error });
    }

    result.applications.push(entry);
  }

  return result;
}
