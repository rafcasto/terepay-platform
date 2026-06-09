import { adminDb } from '@/lib/firebase/admin';
import { decrypt } from '@/lib/encryption/crypto';
import { getMode } from './setpay-client';

export type PaymentConfirmationMode = 'polling' | 'webhook';

export type QippayWebhookConfig = {
  /** Decrypted webhook secret, or null if not configured. */
  webhookSecret: string | null;
  /** Whether the webhook secret is stored (for safe display — never expose the value). */
  webhookSecretSet: boolean;
  /** Which approach drives the UI. Both approaches process events regardless. */
  paymentConfirmationMode: PaymentConfirmationMode;
  /** Master switch for the webhook receiver. When false, incoming requests are
   *  acknowledged (200) but not processed, avoiding Qippay retry storms. */
  webhookEnabled: boolean;
};

const CONFIG_PATH = 'systemConfig/qippay';

/**
 * Reads Qippay webhook configuration from Firestore, decrypting the secret.
 * Falls back to QIPPAY_WEBHOOK_SECRET env var if no Firestore doc exists.
 * In stub mode a synthetic secret is returned so local tests work without setup.
 * Never throws — returns safe defaults on any error.
 */
export async function getQippayWebhookConfig(): Promise<QippayWebhookConfig> {
  let encryptedSecret: string | undefined;
  let paymentConfirmationMode: PaymentConfirmationMode = 'polling';
  let webhookEnabled = false;

  try {
    const doc = await adminDb.doc(CONFIG_PATH).get();
    if (doc.exists) {
      const data = doc.data()!;
      encryptedSecret = typeof data.webhookSecret === 'string' ? data.webhookSecret : undefined;
      paymentConfirmationMode =
        data.paymentConfirmationMode === 'webhook' ? 'webhook' : 'polling';
      webhookEnabled = data.webhookEnabled === true;
    }
  } catch (err) {
    console.error('[webhook-config] Failed to read systemConfig/qippay', err);
  }

  // Decrypt Firestore secret; fall back to env var
  let webhookSecret: string | null = null;
  if (encryptedSecret) {
    try {
      webhookSecret = decrypt(encryptedSecret);
    } catch (err) {
      console.error('[webhook-config] Failed to decrypt webhook secret', err);
    }
  }
  if (!webhookSecret) {
    webhookSecret = process.env.QIPPAY_WEBHOOK_SECRET ?? null;
  }

  // In stub mode synthesise a secret so the receiver works without any config
  if (getMode() === 'stub' && !webhookSecret) {
    webhookSecret = 'stub-secret-local-dev';
  }

  return {
    webhookSecret,
    webhookSecretSet: Boolean(encryptedSecret || process.env.QIPPAY_WEBHOOK_SECRET),
    paymentConfirmationMode,
    webhookEnabled,
  };
}

/**
 * Safely returns the safe display fields for the lender settings UI.
 * Does NOT include the decrypted secret.
 */
export async function getQippayIntegrationDisplayConfig(): Promise<{
  paymentConfirmationMode: PaymentConfirmationMode;
  webhookEnabled: boolean;
  webhookSecretSet: boolean;
}> {
  const config = await getQippayWebhookConfig();
  return {
    paymentConfirmationMode: config.paymentConfirmationMode,
    webhookEnabled: config.webhookEnabled,
    webhookSecretSet: config.webhookSecretSet,
  };
}

/**
 * Persists updated webhook settings to Firestore.
 * Encrypts the secret before storage if provided.
 */
export async function updateQippayWebhookConfig(
  updates: {
    paymentConfirmationMode?: PaymentConfirmationMode;
    webhookEnabled?: boolean;
    webhookSecret?: string; // plain text — will be encrypted before storage
  },
  updatedBy: string,
): Promise<void> {
  const { encrypt } = await import('@/lib/encryption/crypto');
  const { FieldValue } = await import('firebase-admin/firestore');

  const patch: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy,
  };

  if (updates.paymentConfirmationMode !== undefined) {
    patch.paymentConfirmationMode = updates.paymentConfirmationMode;
  }
  if (updates.webhookEnabled !== undefined) {
    patch.webhookEnabled = updates.webhookEnabled;
  }
  if (updates.webhookSecret !== undefined && updates.webhookSecret.trim() !== '') {
    patch.webhookSecret = encrypt(updates.webhookSecret.trim());
  }

  await adminDb.doc(CONFIG_PATH).set(patch, { merge: true });
}
