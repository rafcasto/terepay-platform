import { adminDb } from '@/lib/firebase/admin';
import { deriveLoanSummary, isClosedLoanStatus, isLiveLoanStatus } from '@/lib/loan/active-loan';
import type { LoanApplication } from '@/types/application';
import type { BehaviourFlags } from '@/types/credit-assessment';

const DAY_MS = 86_400_000;
/** A new request this soon after (or on top of) a previous loan counts as "too fast". */
const TOO_FAST_WINDOW_DAYS = 90;
/** …when it is also this much larger than the last principal. */
const TOO_FAST_GROWTH = 1.5;

function toMs(v: unknown): number | undefined {
  const t = v as { toMillis?: () => number; _seconds?: number } | undefined;
  if (!t) return undefined;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (typeof t._seconds === 'number') return t._seconds * 1000;
  return undefined;
}

export interface DerivedBehaviour {
  flags: BehaviourFlags;
  /** Prior disbursed loans the flags were derived from. */
  historyCount: number;
}

/**
 * Borrower Behaviour Scorecard ticks from TerePay's own repayment history.
 * These are authoritative for the agent (`behaviour_*` columns in its README);
 * anything not derivable from data (communication style, excuses) is left to
 * the analyst model, which may only tick it with evidence in a history note.
 *
 * Only prior loans that were actually disbursed count. No history → no flags,
 * which the rules engine treats as "no behaviour history evidenced".
 */
export async function deriveBehaviourFlags(
  applicantId: string | undefined,
  currentApplicationId: string,
  requestedAmount: number,
): Promise<DerivedBehaviour> {
  const flags: BehaviourFlags = {};
  if (!applicantId) return { flags, historyCount: 0 };

  const snap = await adminDb.collection('loanApplications').where('applicantId', '==', applicantId).get();
  const priors = snap.docs
    .filter((d) => d.id !== currentApplicationId)
    .map((d) => ({ id: d.id, ...(d.data() as LoanApplication) }))
    .filter((a) => isLiveLoanStatus(a.status) || isClosedLoanStatus(a.status));

  if (priors.length === 0) return { flags, historyCount: 0 };

  let missed = false;
  let currentlyDelinquent = false;
  let paidEarly = false;
  let closedClean = 0;
  let latestEndMs = 0;
  let latestPrincipal = 0;

  for (const a of priors) {
    const summary = deriveLoanSummary(a);
    const hadMiss =
      summary.installments.some((i) => i.status === 'overdue' || i.status === 'failed' || i.status === 'retrying') ||
      Boolean(a.arrears) ||
      (a.feeAssessments?.length ?? 0) > 0;
    if (hadMiss) missed = true;
    if (isLiveLoanStatus(a.status) && summary.isDelinquent) currentlyDelinquent = true;
    if (a.earlyRepayment?.status === 'paid') paidEarly = true;
    if (isClosedLoanStatus(a.status) && !hadMiss) closedClean += 1;

    const endMs = toMs(a.timeline?.closedAt) ?? toMs(a.timeline?.disbursedAt) ?? 0;
    const principal = a.loanDetails?.disbursedAmount ?? a.loanDetails?.approvedAmount ?? 0;
    if (endMs >= latestEndMs) {
      latestEndMs = endMs;
      latestPrincipal = principal;
    }
  }

  if (paidEarly) flags.behaviour_paid_previous_loan_early = true;
  if (closedClean > 0 && !missed) flags.behaviour_paid_on_time_consistently = true;
  if (missed) flags.behaviour_missed_payments_before = true;
  if (currentlyDelinquent) flags.behaviour_existing_defaults = true;

  const stillLive = priors.some((a) => isLiveLoanStatus(a.status));
  const recent = latestEndMs > 0 && Date.now() - latestEndMs < TOO_FAST_WINDOW_DAYS * DAY_MS;
  if ((stillLive || recent) && latestPrincipal > 0 && requestedAmount > latestPrincipal * TOO_FAST_GROWTH) {
    flags.behaviour_requests_bigger_loan_too_fast = true;
  }

  return { flags, historyCount: priors.length };
}
