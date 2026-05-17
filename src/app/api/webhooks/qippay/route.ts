import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { verifyQippayWebhook } from '@/lib/qippay/webhook-verify';
import type { Loan, RepaymentInstallment } from '@/types/application';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/qippay
 *
 * Receives event notifications from Qippay (docs rev 1, p.27). Payload
 * shape: `{ event, payload }`. Payload only contains identifiers — we
 * mutate Firestore state based on the event id and rely on the loan doc's
 * `installments[].paymentId` for correlation back to a specific instalment.
 *
 * Events handled:
 *   payment.status.success      → mark instalment paid, advance loan state
 *   setpay.status.retry         → mark instalment retrying
 *   setpay.status.failure       → mark instalment overdue, loan delinquent
 *   enduring.status.revoked     → halt collection (mandate cancelled at bank)
 *   enduring.status.cancelled   → halt collection (mandate cancelled by us)
 *   enduring.status.success     → no-op (consent activation handled by reconcile-consent)
 *
 * Behaviour:
 *   - Idempotent. Re-delivery of the same event makes no further changes.
 *   - All transitions use Firestore transactions on the loan doc + app doc.
 *   - Verification: HMAC-SHA256 if QIPPAY_WEBHOOK_SECRET set, else static
 *     bearer token via QIPPAY_WEBHOOK_TOKEN. Stub/dev mode skips checks.
 *   - All events are audit-logged for traceability (success and failure).
 */

type QippayWebhookEvent =
  | 'enduring.status.success'
  | 'enduring.status.revoked'
  | 'enduring.status.cancelled'
  | 'payment.status.success'
  | 'setpay.status.retry'
  | 'setpay.status.failure';

interface WebhookBody {
  event: QippayWebhookEvent | string;
  payload?: {
    epcId?: string;
    paymentId?: string;
    [k: string]: unknown;
  };
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // Read raw body BEFORE parsing — HMAC verification needs the exact bytes.
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { success: false, error: 'invalid body' },
      { status: 400 },
    );
  }

  const verify = verifyQippayWebhook(rawBody, request.headers);
  if (!verify.ok) {
    await auditLog({
      userId: 'qippay-webhook',
      action: 'qippay_webhook_rejected',
      outcome: 'failure',
      errorDetail: verify.reason,
      ipAddress: ip,
    });
    return NextResponse.json(
      { success: false, error: 'verification failed' },
      { status: 401 },
    );
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    return NextResponse.json(
      { success: false, error: 'invalid JSON' },
      { status: 400 },
    );
  }

  const { event, payload } = body;
  if (!event || typeof event !== 'string') {
    return NextResponse.json(
      { success: false, error: 'missing event' },
      { status: 400 },
    );
  }

  try {
    switch (event) {
      case 'payment.status.success':
        await handlePaymentSuccess(payload?.paymentId);
        break;
      case 'setpay.status.retry':
        await handlePaymentRetry(payload?.paymentId);
        break;
      case 'setpay.status.failure':
        await handlePaymentFailure(payload?.paymentId);
        break;
      case 'enduring.status.revoked':
      case 'enduring.status.cancelled':
        await handleMandateCancelled(payload?.epcId, event);
        break;
      case 'enduring.status.success':
        // Consent activation is handled by the existing reconcile-consent
        // path when the user lands on the return page. No-op here.
        break;
      default:
        // Unknown event — log and 200 so Qippay doesn't endlessly retry.
        await auditLog({
          userId: 'qippay-webhook',
          action: 'qippay_webhook_unknown',
          outcome: 'success',
          changes: { event, payload: payload ?? null },
          ipAddress: ip,
        });
    }

    await auditLog({
      userId: 'qippay-webhook',
      action: `qippay_webhook_${event.replace(/\./g, '_')}`,
      outcome: 'success',
      changes: { paymentId: payload?.paymentId, epcId: payload?.epcId },
      ipAddress: ip,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await auditLog({
      userId: 'qippay-webhook',
      action: `qippay_webhook_${event.replace(/\./g, '_')}`,
      outcome: 'failure',
      errorDetail: detail,
      changes: { paymentId: payload?.paymentId, epcId: payload?.epcId },
      ipAddress: ip,
    });
    return NextResponse.json(
      { success: false, error: 'handler failed' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function findLoanByPaymentId(
  paymentId: string,
): Promise<FirebaseFirestore.QueryDocumentSnapshot | null> {
  // Array-contains query on a nested object field isn't supported directly
  // for object members; we query on the flattened paymentIds index instead.
  // To keep this simple without adding a denormalised field, fetch all
  // non-terminal loans and filter in memory. Volume is small (one loan per
  // active customer); revisit with a `paymentIds: string[]` mirror field if
  // this becomes hot.
  const snap = await adminDb
    .collection('loans')
    .where('status', 'in', ['disbursed', 'active', 'delinquent'])
    .get();
  for (const doc of snap.docs) {
    const loan = doc.data() as Loan;
    if (loan.installments?.some((i) => i.paymentId === paymentId)) {
      return doc;
    }
  }
  return null;
}

async function handlePaymentSuccess(paymentId: string | undefined): Promise<void> {
  if (!paymentId) throw new Error('payment.status.success missing paymentId');
  const loanSnap = await findLoanByPaymentId(paymentId);
  if (!loanSnap) {
    // Not finding the loan is suspicious but not fatal — could be a re-delivery
    // after the loan was already closed. Log and bail.
    return;
  }
  const loanRef = loanSnap.ref;

  await adminDb.runTransaction(async (tx) => {
    const fresh = await tx.get(loanRef);
    if (!fresh.exists) return;
    const loan = fresh.data() as Loan;

    const idx = loan.installments.findIndex((i) => i.paymentId === paymentId);
    if (idx < 0) return;
    if (loan.installments[idx].status === 'paid') return; // already processed

    const paidAmount = loan.installments[idx].amount;
    const nextInstallments: RepaymentInstallment[] = loan.installments.map((i, k) =>
      k === idx
        ? {
            ...i,
            status: 'paid' as const,
            paidAt: Timestamp.now(),
          }
        : i,
    );

    const newTotalPaid = +(loan.totalPaid + paidAmount).toFixed(2);
    const newRemaining = +(loan.totalRepayable - newTotalPaid).toFixed(2);
    const nextScheduled = nextInstallments.find((i) => i.status === 'scheduled' || i.status === 'retrying');
    const allPaid = nextInstallments.every((i) => i.status === 'paid');

    // Status transitions
    let newStatus: Loan['status'] = loan.status;
    if (allPaid) newStatus = 'closed_repaid';
    else if (loan.status === 'disbursed') newStatus = 'active';
    else if (loan.status === 'delinquent' && !nextInstallments.some((i) => i.status === 'overdue')) {
      // Recovered: no overdue remain after this success.
      newStatus = 'active';
    }

    const now = FieldValue.serverTimestamp();
    const updates: Record<string, unknown> = {
      installments: nextInstallments,
      totalPaid: newTotalPaid,
      remainingBalance: newRemaining,
      status: newStatus,
      'timeline.updatedAt': now,
    };
    if (nextScheduled) {
      updates.nextPaymentDate = Timestamp.fromDate(
        new Date(`${nextScheduled.dueDate}T12:00:00+12:00`),
      );
    } else {
      updates.nextPaymentDate = null;
    }
    if (newStatus === 'active' && !loan.timeline?.activatedAt) {
      updates['timeline.activatedAt'] = now;
    }
    if (newStatus === 'closed_repaid') {
      updates['timeline.closedAt'] = now;
    }
    tx.update(loanRef, updates);

    // Mirror onto the application doc.
    const appRef = adminDb.collection('loanApplications').doc(loan.applicationId);
    const appUpdates: Record<string, unknown> = {
      'repaymentSchedule.installments': nextInstallments,
      'timeline.updatedAt': now,
    };
    if (newStatus === 'active' && loan.status !== 'active') {
      appUpdates.status = 'active';
    }
    if (newStatus === 'closed_repaid') {
      appUpdates.status = 'closed_repaid';
      appUpdates['timeline.closedAt'] = now;
    }
    tx.update(appRef, appUpdates);
  });
}

async function handlePaymentRetry(paymentId: string | undefined): Promise<void> {
  if (!paymentId) throw new Error('setpay.status.retry missing paymentId');
  const loanSnap = await findLoanByPaymentId(paymentId);
  if (!loanSnap) return;
  const loanRef = loanSnap.ref;

  await adminDb.runTransaction(async (tx) => {
    const fresh = await tx.get(loanRef);
    if (!fresh.exists) return;
    const loan = fresh.data() as Loan;
    const idx = loan.installments.findIndex((i) => i.paymentId === paymentId);
    if (idx < 0) return;
    if (loan.installments[idx].status !== 'scheduled') return;

    const next = loan.installments.map((i, k) =>
      k === idx ? { ...i, status: 'retrying' as const } : i,
    );
    tx.update(loanRef, {
      installments: next,
      'timeline.updatedAt': FieldValue.serverTimestamp(),
    });
  });
}

async function handlePaymentFailure(paymentId: string | undefined): Promise<void> {
  if (!paymentId) throw new Error('setpay.status.failure missing paymentId');
  const loanSnap = await findLoanByPaymentId(paymentId);
  if (!loanSnap) return;
  const loanRef = loanSnap.ref;

  await adminDb.runTransaction(async (tx) => {
    const fresh = await tx.get(loanRef);
    if (!fresh.exists) return;
    const loan = fresh.data() as Loan;
    const idx = loan.installments.findIndex((i) => i.paymentId === paymentId);
    if (idx < 0) return;
    if (loan.installments[idx].status === 'overdue') return; // already processed

    const next = loan.installments.map((i, k) =>
      k === idx
        ? { ...i, status: 'overdue' as const, failureReason: 'Qippay setpay.status.failure' }
        : i,
    );
    tx.update(loanRef, {
      installments: next,
      status: 'delinquent',
      'timeline.updatedAt': FieldValue.serverTimestamp(),
    });

    const appRef = adminDb.collection('loanApplications').doc(loan.applicationId);
    tx.update(appRef, {
      'repaymentSchedule.installments': next,
      'timeline.updatedAt': FieldValue.serverTimestamp(),
    });
  });
}

async function handleMandateCancelled(
  epcId: string | undefined,
  event: 'enduring.status.revoked' | 'enduring.status.cancelled',
): Promise<void> {
  if (!epcId) throw new Error(`${event} missing epcId`);
  const snap = await adminDb
    .collection('loans')
    .where('mandateId', '==', epcId)
    .get();
  if (snap.empty) return;

  await Promise.all(
    snap.docs.map((doc) =>
      adminDb.runTransaction(async (tx) => {
        const fresh = await tx.get(doc.ref);
        if (!fresh.exists) return;
        const loan = fresh.data() as Loan;
        if (loan.status === 'closed_repaid') return;
        tx.update(doc.ref, {
          status: 'delinquent',
          'timeline.updatedAt': FieldValue.serverTimestamp(),
        });
        const appRef = adminDb.collection('loanApplications').doc(loan.applicationId);
        tx.update(appRef, {
          'paymentConsent.status': event === 'enduring.status.revoked' ? 'cancelled' : 'cancelled',
          'timeline.updatedAt': FieldValue.serverTimestamp(),
        });
      }),
    ),
  );
}
