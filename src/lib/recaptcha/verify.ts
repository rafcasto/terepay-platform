/**
 * Server-side Google reCAPTCHA v3 verification utility.
 *
 * Usage:
 *   const ok = await verifyRecaptcha(token, 'login');
 *   if (!ok) return errorResponse(new AppError('RECAPTCHA_FAILED', 400, 'reCAPTCHA verification failed.'));
 */

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

// Minimum acceptable reCAPTCHA v3 score (0.0 = definitely bot, 1.0 = definitely human)
const MIN_SCORE = 0.5;

export async function verifyRecaptcha(token: string, action?: string): Promise<boolean> {
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
