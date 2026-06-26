import { type NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { auditLog } from '@/lib/utils/audit';
import { getQippayWebhookConfig } from '@/lib/qippay/webhook-config';
import {
  verifyWebhookSignature,
  WEBHOOK_SIG_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from '@/lib/qippay/verify-webhook';
import { getDetailedConsentStatus } from '@/lib/qippay/setpay-client';
import { syncLoanRecord } from '@/lib/loan/loan-record';

export const dynamic = 'force-dynamic';

// Always return 200 — non-2xx responses cause Qippay to retry indefinitely.
// We return { received: true } on success, { received: false, reason } on
// soft-skip (disabled, unknown event etc.) and 401 only for invalid signatures
// (Qippay retrying on 401 is acceptable — it means our secret is wrong).

type QippayWebhookBody = {
  event: string;
  payload: { epcId: string };
};

async function findApplicationByMandateId(epcId: string) {
  const snap = await adminDb
    .collection('loanApplications')
    .where('paymentConsent.mandateId', '==', epcId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { ref: snap.docs[0].ref, data: snap.docs[0].data() };
}

export async function POST(request: NextRequest) {
  // 1. Read raw body before anything else (needed for signature verification)
  const rawBody = await request.text();

  // 2. Load webhook config from Firestore
  const config = await getQippayWebhookConfig();

  // 3. Verify signature — return 401 if invalid so Qippay knows something is wrong
  if (config.webhookSecret) {
    const sig = request.headers.get(WEBHOOK_SIG_HEADER);
    const timestamp = request.headers.get(WEBHOOK_TIMESTAMP_HEADER);
    if (!verifyWebhookSignature(rawBody, sig, config.webhookSecret, timestamp)) {
      console.warn('[webhooks/qippay] Invalid signature — rejecting request');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  // 4. If webhook receiver is disabled, acknowledge but do not process
  if (!config.webhookEnabled) {
    return NextResponse.json({ received: false, reason: 'webhook_disabled' });
  }

  // 5. Parse body
  let body: QippayWebhookBody;
  try {
    body = JSON.parse(rawBody) as QippayWebhookBody;
  } catch {
    console.warn('[webhooks/qippay] Non-JSON body received');
    return NextResponse.json({ received: false, reason: 'invalid_json' });
  }

  const { event, payload } = body;
  const epcId = payload?.epcId;

  if (!epcId) {
    console.warn('[webhooks/qippay] Missing epcId in payload', { event });
    return NextResponse.json({ received: false, reason: 'missing_epc_id' });
  }

  // 6. Dispatch by event type
  try {
    switch (event) {
      case 'payment.status.success':
        await handlePaymentSuccess(epcId);
        break;

      case 'setpay.status.retry':
        await handlePaymentRetry(epcId);
        break;

      case 'setpay.status.failure':
        await handlePaymentFailure(epcId);
        break;

      case 'enduring.status.revoked':
        await handleConsentRevoked(epcId);
        break;

      case 'enduring.status.cancelled':
      case 'enduring.status.success':
        // These are handled by the redirect flow. Log only.
        await auditLog({
          userId: 'system:qippay_webhook',
          action: `qippay_webhook_${event.replace(/\./g, '_')}`,
          targetType: 'application',
          outcome: 'success',
          changes: { epcId, event },
        });
        break;

      default:
        console.warn('[webhooks/qippay] Unknown event type', { event, epcId });
        await auditLog({
          userId: 'system:qippay_webhook',
          action: 'qippay_webhook_unknown_event',
          targetType: 'application',
          outcome: 'failure',
          changes: { epcId, event },
        });
    }
  } catch (err) {
    // Log but still return 200 — we don't want Qippay to retry a processing error
    console.error('[webhooks/qippay] Error processing event', { event, epcId, err });
    await auditLog({
      userId: 'system:qippay_webhook',
      action: 'qippay_webhook_processing_error',
      targetType: 'application',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : String(err),
      changes: { epcId, event },
    });
  }

  return NextResponse.json({ received: true });
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handlePaymentSuccess(epcId: string): Promise<void> {
  const app = await findApplicationByMandateId(epcId);
  if (!app) {
    console.warn('[webhooks/qippay] payment.status.success — no app found for epcId', epcId);
    return;
  }

  // Query Qippay for the real-time count_complete so we know which instalment settled
  const detailed = await getDetailedConsentStatus(epcId);
  const countComplete = detailed.consentOverallStatus?.countComplete ?? 0;

  if (countComplete === 0) {
    console.warn('[webhooks/qippay] payment.status.success but count_complete=0', { epcId });
    return;
  }

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(app.ref);
    if (!snap.exists) return;
    const data = snap.data()!;

    const payments: Record<string, unknown>[] = Array.isArray(data.scheduledPayments)
      ? (data.scheduledPayments as Record<string, unknown>[])
      : [];

    // Mark all instalments whose installmentNumber ≤ countComplete as success
    // (handles the case where multiple payments settle between webhook calls).
    let changed = false;
    const updated = payments.map((p) => {
      const num = p.installmentNumber as number;
      if (num <= countComplete && p.status !== 'success') {
        changed = true;
        return { ...p, status: 'success', completedAt: FieldValue.serverTimestamp() };
      }
      return p;
    });

    if (!changed) return;

    tx.update(app.ref, {
      scheduledPayments: updated,
      'timeline.updatedAt': FieldValue.serverTimestamp(),
    });
  });

  // Keep the canonical loan record (portfolio + statements) in sync.
  await syncLoanRecord(app.ref.id);

  await auditLog({
    userId: 'system:qippay_webhook',
    action: 'setpay_payment_success',
    targetId: app.ref.id,
    targetType: 'application',
    outcome: 'success',
    changes: { epcId, countComplete },
  });
}

async function handlePaymentRetry(epcId: string): Promise<void> {
  const app = await findApplicationByMandateId(epcId);
  if (!app) return;

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(app.ref);
    if (!snap.exists) return;
    const data = snap.data()!;

    const payments: Record<string, unknown>[] = Array.isArray(data.scheduledPayments)
      ? (data.scheduledPayments as Record<string, unknown>[])
      : [];

    // Mark the first scheduled/retrying payment as retrying and bump retryCount
    let applied = false;
    const updated = payments.map((p) => {
      if (!applied && (p.status === 'scheduled' || p.status === 'retrying')) {
        applied = true;
        return {
          ...p,
          status: 'retrying',
          retryCount: ((p.retryCount as number) ?? 0) + 1,
        };
      }
      return p;
    });

    if (!applied) return;
    tx.update(app.ref, {
      scheduledPayments: updated,
      'timeline.updatedAt': FieldValue.serverTimestamp(),
    });
  });

  await syncLoanRecord(app.ref.id);

  await auditLog({
    userId: 'system:qippay_webhook',
    action: 'setpay_payment_retry',
    targetId: app.ref.id,
    targetType: 'application',
    outcome: 'success',
    changes: { epcId },
  });
}

async function handlePaymentFailure(epcId: string): Promise<void> {
  const app = await findApplicationByMandateId(epcId);
  if (!app) return;

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(app.ref);
    if (!snap.exists) return;
    const data = snap.data()!;

    const payments: Record<string, unknown>[] = Array.isArray(data.scheduledPayments)
      ? (data.scheduledPayments as Record<string, unknown>[])
      : [];

    let applied = false;
    const updated = payments.map((p) => {
      if (!applied && (p.status === 'scheduled' || p.status === 'retrying')) {
        applied = true;
        return {
          ...p,
          status: 'failed',
          failedAt: FieldValue.serverTimestamp(),
          failureReason: 'setpay.status.failure — max retries exceeded',
        };
      }
      return p;
    });

    if (!applied) return;
    tx.update(app.ref, {
      scheduledPayments: updated,
      'timeline.updatedAt': FieldValue.serverTimestamp(),
    });
  });

  await syncLoanRecord(app.ref.id);

  await auditLog({
    userId: 'system:qippay_webhook',
    action: 'setpay_payment_failed',
    targetId: app.ref.id,
    targetType: 'application',
    outcome: 'failure',
    changes: { epcId },
  });
}

async function handleConsentRevoked(epcId: string): Promise<void> {
  const app = await findApplicationByMandateId(epcId);
  if (!app) return;

  const now = FieldValue.serverTimestamp();
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(app.ref);
    if (!snap.exists) return;
    const data = snap.data()!;

    // Cancel any pending/scheduled payments
    const payments: Record<string, unknown>[] = Array.isArray(data.scheduledPayments)
      ? (data.scheduledPayments as Record<string, unknown>[])
      : [];
    const updated = payments.map((p) =>
      p.status === 'pending' || p.status === 'scheduled' || p.status === 'retrying'
        ? { ...p, status: 'cancelled' }
        : p,
    );

    tx.update(app.ref, {
      'paymentConsent.status': 'cancelled',
      'paymentConsent.failureReason': 'revoked_by_customer',
      'paymentConsent.lastStatusCheckedAt': now,
      scheduledPayments: updated,
      'timeline.updatedAt': now,
    });
  });

  await syncLoanRecord(app.ref.id);

  await auditLog({
    userId: 'system:qippay_webhook',
    action: 'payment_consent_revoked',
    targetId: app.ref.id,
    targetType: 'application',
    outcome: 'success',
    changes: { epcId, source: 'webhook' },
  });
}
