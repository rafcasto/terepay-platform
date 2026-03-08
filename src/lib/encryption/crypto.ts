import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// Key map: version → 32-byte Buffer.
// Add new entries on rotation; never remove old ones until all data is re-encrypted.
function buildKeyMap(): Record<string, Buffer> {
  const map: Record<string, Buffer> = {};
  const v1 = process.env.ENCRYPTION_KEY_V1;
  if (v1) map['v1'] = Buffer.from(v1, 'hex');
  return map;
}

const KEYS = buildKeyMap();
const CURRENT_KEY_VERSION = 'v1';

/**
 * Encrypts plaintext using AES-256-GCM.
 * Output format: `version:ivBase64:tagBase64:ciphertextBase64`
 */
export function encrypt(plaintext: string): string {
  const key = KEYS[CURRENT_KEY_VERSION];
  if (!key) throw new Error('Encryption key not configured');

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    CURRENT_KEY_VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

/**
 * Decrypts a payload produced by `encrypt()`.
 * Reads the version prefix to select the correct key (supports key rotation).
 */
export function decrypt(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(':');
  const key = KEYS[version];
  if (!key) throw new Error(`Unknown encryption key version: ${version}`);

  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final('utf8');
}
