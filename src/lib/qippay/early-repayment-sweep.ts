import { adminDb } from '@/lib/firebase/admin';
import { reconcileEarlyRepayment } from '@/lib/qippay/reconcile-early-repayment';
import { isQippayEnabled } from '@/lib/qippay/feature';
import type { EarlyRepaymentStatus } from '@/types/application';

const DEFAULT_MAX_APPLICATIONS = 200;

/** PayBy states that still need an upstream check. */
const IN_FLIGHT: readonly EarlyRepaymentStatus[] = ['initiated', 'pending'];

export type EarlyRepaymentSweepApplication = {
  applicationId: string;
  before: EarlyRepaymentStatus;
  after: EarlyRepaymentStatus;
  error?: string;
};

export type EarlyRepaymentSweepResult = {
  /** `qippay` checked PayBy upstream; `disabled` means the flag is off and nothing ran. */
  mode: 'qippay' | 'disabled';
  total: number;
  processed: number;
  /** Payoffs confirmed `paid` by this sweep — loan closed, SetPay consent cancelled. */
  settled: number;
  /** Payoffs that ended `expired` / `failed` / `cancelled` upstream. */
  ended: number;
  /** Still `initiated` / `pending` after the check. */
  stillPending: number;
  errored: number;
  applications: EarlyRepaymentSweepApplication[];
};

/**
 * Background reconciliation for in-flight PayBy early payoffs.
 *
 * A borrower can approve the payoff in their banking app and never come back
 * to our return page (closed the tab, lost signal, CIBA push approved later).
 * Until this sweep existed we only learned the outcome when they next opened
 * the early-repayment screen. This walks every application whose
 * `earlyRepayment.status` is still `initiated` or `pending` and runs the same
 * idempotent reconciler the return page uses — so a confirmed payoff settles
 * the loan and cancels the SetPay consent without any customer action.
 *
 * Runs on EVERY hourly cron tick (not behind the once-a-day payment-refresh
 * gate): a PayBy payment expires 24 h after initiation, so hourly is the right
 * cadence to catch a success before the customer wonders why their loan still
 * shows open. Also run by the admin "Verify now" action for parity.
 *
 * Safe to call as often as you like: `reconcileEarlyRepayment` never
 * overwrites a terminal state and skips the upstream call when the last check
 * was under 10 s ago.
 */
export async function runEarlyRepaymentSweep(opts: {
  actor: string;
  ip?: string;
  maxApplications?: number;
}): Promise<EarlyRepaymentSweepResult> {
  const { actor, ip, maxApplications = DEFAULT_MAX_APPLICATIONS } = opts;

  const result: EarlyRepaymentSweepResult = {
    mode: 'disabled',
    total: 0,
    processed: 0,
    settled: 0,
    ended: 0,
    stillPending: 0,
    errored: 0,
    applications: [],
  };

  // Flag off → PayBy is never offered, so there is nothing in flight to check.
  if (!(await isQippayEnabled())) return result;
  result.mode = 'qippay';

  const snap = await adminDb
    .collection('loanApplications')
    .where('earlyRepayment.status', 'in', [...IN_FLIGHT])
    .limit(maxApplications)
    .get();

  result.total = snap.size;

  for (const doc of snap.docs) {
    const before = (doc.data().earlyRepayment?.status as EarlyRepaymentStatus | undefined) ?? 'not_started';
    const entry: EarlyRepaymentSweepApplication = { applicationId: doc.id, before, after: before };

    try {
      const r = await reconcileEarlyRepayment({
        applicationId: doc.id,
        caller: 'cron',
        callerUid: actor,
        ipAddress: ip,
      });
      entry.after = r.status;
      result.processed += 1;
      if (r.status === 'paid') result.settled += 1;
      else if (r.status === 'expired' || r.status === 'failed' || r.status === 'cancelled') result.ended += 1;
      else result.stillPending += 1;
    } catch (err) {
      result.errored += 1;
      entry.error = 'reconcile_failed';
      // Never abort the sweep — one bad payment must not block the others.
      console.error('[early-repayment-sweep] failed to reconcile', doc.id, err);
    }

    result.applications.push(entry);
  }

  return result;
}
