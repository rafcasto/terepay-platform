import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { encrypt, decrypt } from '@/lib/encryption/crypto';
import type { AdminConfig, AdminConfigKey } from '@/types/admin';
import { ADMIN_CONFIG_KEYS } from '@/types/admin';

const COLLECTION = 'adminConfig';
const DOC_ID = 'integrations';

/** Mask a secret for UI display: show first 4 chars + asterisks */
export function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 4) return '****';
  return value.slice(0, 4) + '*'.repeat(Math.min(value.length - 4, 20));
}

/**
 * Read the admin config from Firestore, falling back to env vars.
 * Returns decrypted values — server-side only, never send to client.
 */
export async function getAdminConfig(): Promise<Partial<AdminConfig>> {
  const result: Partial<AdminConfig> = {};

  let firestoreData: Record<string, string> = {};
  try {
    const snap = await adminDb.collection(COLLECTION).doc(DOC_ID).get();
    if (snap.exists) {
      firestoreData = snap.data() as Record<string, string>;
    }
  } catch {
    // Fail open — fall back to env vars below
  }

  for (const { key, envVar } of ADMIN_CONFIG_KEYS) {
    const stored = firestoreData[key];
    if (stored) {
      try {
        result[key] = decrypt(stored);
      } catch {
        // Decryption failed — fall back to env var
        result[key] = process.env[envVar] ?? '';
      }
    } else {
      result[key] = process.env[envVar] ?? '';
    }
  }

  return result;
}

/**
 * Return masked config values safe for the admin UI (no plaintext, no ciphertext).
 */
export async function getAdminConfigMasked(): Promise<Record<AdminConfigKey, string>> {
  const config = await getAdminConfig();
  const masked: Record<string, string> = {};
  for (const { key } of ADMIN_CONFIG_KEYS) {
    const val = config[key] ?? '';
    masked[key] = val ? maskSecret(val) : '(not set)';
  }
  return masked as Record<AdminConfigKey, string>;
}

/**
 * Update one or more config values. Values are encrypted before storage.
 * Pass `null` to clear a key (will fall back to env var at runtime).
 */
export async function setAdminConfig(
  updates: Partial<Record<AdminConfigKey, string | null>>,
  updatedBy: string,
): Promise<void> {
  const patch: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy,
  };

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === '') {
      // Use FieldValue.delete() to remove the key
      const { FieldValue: FV } = await import('firebase-admin/firestore');
      patch[key] = FV.delete();
    } else if (value !== undefined) {
      patch[key] = encrypt(value);
    }
  }

  await adminDb.collection(COLLECTION).doc(DOC_ID).set(patch, { merge: true });
}

/**
 * Convenience: get a single config value (decrypted), with env var fallback.
 */
export async function getConfigValue(key: AdminConfigKey): Promise<string> {
  const config = await getAdminConfig();
  return config[key] ?? '';
}
