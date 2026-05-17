import crypto from 'node:crypto';

// Qippay webhook verification.
//
// The rev-1 SetPay PDF documents that webhooks are POSTed to a registered
// URL with `{ event, payload }` but does NOT specify the signature
// mechanism. Until that's confirmed with Qippay's onboarding contact, we
// support two layered checks, controlled by env:
//
// 1. Shared-secret HMAC (preferred, when Qippay confirms the header)
//    Env: QIPPAY_WEBHOOK_SECRET (used to derive HMAC-SHA256 of raw body)
//    Header: x-qippay-signature: sha256=<hex>
//
// 2. Static bearer token in a header (fallback / UAT)
//    Env: QIPPAY_WEBHOOK_TOKEN
//    Header: x-qippay-token: <token>
//
// At least one MUST be configured in production. In `stub`/dev mode both
// checks are skipped so the emulator can synthesise events freely.

export type WebhookVerifyResult =
  | { ok: true; mode: 'hmac' | 'token' | 'stub' }
  | { ok: false; reason: string };

export function verifyQippayWebhook(
  rawBody: string,
  headers: Headers,
): WebhookVerifyResult {
  const isProd = process.env.NEXT_PUBLIC_ENVIRONMENT === 'production';
  const mode = (process.env.QIPPAY_MODE ?? 'stub').toLowerCase();

  if (!isProd && mode === 'stub') {
    return { ok: true, mode: 'stub' };
  }

  const secret = process.env.QIPPAY_WEBHOOK_SECRET;
  if (secret) {
    const provided = headers.get('x-qippay-signature') ?? '';
    const expected = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('hex')}`;
    // Constant-time compare. Lengths must match for timingSafeEqual.
    if (
      provided.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
    ) {
      return { ok: true, mode: 'hmac' };
    }
    return { ok: false, reason: 'invalid HMAC signature' };
  }

  const token = process.env.QIPPAY_WEBHOOK_TOKEN;
  if (token) {
    const provided = headers.get('x-qippay-token') ?? '';
    if (
      provided.length === token.length &&
      crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(token))
    ) {
      return { ok: true, mode: 'token' };
    }
    return { ok: false, reason: 'invalid bearer token' };
  }

  return {
    ok: false,
    reason: 'webhook verification not configured (set QIPPAY_WEBHOOK_SECRET or QIPPAY_WEBHOOK_TOKEN)',
  };
}
