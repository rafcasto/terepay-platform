import { createHmac, timingSafeEqual } from 'crypto';
import { getMode } from './setpay-client';

/**
 * The HTTP header Qippay sends the signature in.
 * Update here once Qippay confirms the exact header name.
 */
export const WEBHOOK_SIG_HEADER = 'x-qippay-signature';

/**
 * Verifies an incoming Qippay webhook request using HMAC-SHA256 over the
 * raw request body.
 *
 * In stub mode (QIPPAY_MODE=stub) verification is always skipped so local
 * development works without a real secret.
 *
 * @param rawBody   The raw request body string (read before JSON.parse).
 * @param signature The value of the x-qippay-signature header, or null if absent.
 * @param secret    The plain-text webhook secret from getQippayWebhookConfig().
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (getMode() === 'stub') return true;
  if (!signature) return false;

  const expected = createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');

  // timingSafeEqual prevents timing attacks but requires equal-length buffers.
  try {
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}
