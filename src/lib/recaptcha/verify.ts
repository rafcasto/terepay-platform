/**
 * Server-side Google reCAPTCHA v3 verification utility.
 *
 * Usage:
 *   const ok = await verifyRecaptcha(token, 'login');
 *   if (!ok) return errorResponse(new AppError('RECAPTCHA_FAILED', 400, 'reCAPTCHA verification failed.'));
 */

import { recaptchaDisabled } from '@/lib/flags/flags';

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

// Minimum acceptable reCAPTCHA v3 score (0.0 = definitely bot, 1.0 = definitely human)
const MIN_SCORE = 0.5;

/**
 * Reads the `recaptcha_disabled` flag. Fails CLOSED — any error evaluating the
 * flag (e.g. called outside a request scope) leaves verification switched on.
 */
async function isRecaptchaDisabled(): Promise<boolean> {
  try {
    return await recaptchaDisabled();
  } catch {
    return false;
  }
}

export async function verifyRecaptcha(token: string, action?: string): Promise<boolean> {
  if (await isRecaptchaDisabled()) {
    console.warn('[recaptcha] recaptcha_disabled flag is on — skipping verification (development only)');
    return true;
  }

  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    console.warn('[recaptcha] RECAPTCHA_SECRET_KEY is not set — skipping verification');
    return true;
  }

  try {
    const params = new URLSearchParams({ secret: secretKey, response: token });
    const res = await fetch(`${RECAPTCHA_VERIFY_URL}?${params}`, { method: 'POST' });

    if (!res.ok) return false;

    const data = (await res.json()) as {
      success: boolean;
      score: number;
      action?: string;
      'error-codes'?: string[];
    };

    if (!data.success) return false;
    if (typeof data.score === 'number' && data.score < MIN_SCORE) return false;
    if (action && data.action && data.action !== action) return false;

    return true;
  } catch (err) {
    console.error('[recaptcha] verification error', err);
    return false;
  }
}
