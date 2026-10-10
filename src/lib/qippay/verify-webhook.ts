import { createHmac, timingSafeEqual } from 'crypto';
import { getMode } from './setpay-client';

/**
 * Headers Qippay sends on every webhook. HTTP header names are case-insensitive
 * and Next.js lower-cases them, so we match against the lower-cased form.
 *
 * Per the Qippay HMAC spec:
 *   - `x-Signature` — hex HMAC-SHA256 (no prefix) of `${timestamp}.${rawBody}`
 *   - `x-Timestamp` — the unix timestamp that was prepended to the signed message
 */
export const WEBHOOK_SIG_HEADER = 'x-signature';
export const WEBHOOK_TIMESTAMP_HEADER = 'x-timestamp';

/**
 * Verifies an incoming Qippay webhook request using HMAC-SHA256.
 *
 * The signed message is `${timestamp}.${rawBody}` where `timestamp` comes from
 * the `x-Timestamp` header and `rawBody` is the unparsed request body. The
 * result is compared against the hex digest in the `x-Signature` header.
 *
 * In stub mode (QIPPAY_MODE=stub) verification is always skipped so local
 * development works without a real secret.
 *
 * @param rawBody   The raw request body string (read before JSON.parse).
 * @param signature The value of the x-Signature header, or null if absent.
 * @param secret    The plain-text webhook secret (HMAC_SECRET) from getQippayWebhookConfig().
 * @param timestamp The value of the x-Timestamp header, or null if absent.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
  timestamp: string | null,
): boolean {
  if (getMode() === 'stub') return true;
  if (!signature || !timestamp) return false;

  // Message is `timestamp.payload` (payload = raw, unparsed body).
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');

  // Normalise the supplied hex (lower-case, trimmed) — Qippay sends a bare
  // lower-case hex digest with no prefix.
  const provided = signature.trim().toLowerCase();

  // timingSafeEqual prevents timing attacks but requires equal-length buffers.
  try {
    const sigBuf = Buffer.from(provided);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}
