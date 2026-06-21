import { Resend } from 'resend';

/**
 * Transactional email sender (Resend).
 *
 * - Lazily initialized so a missing API key never breaks the build.
 * - Fails open in development: when `RESEND_API_KEY` is absent we skip the
 *   real send and return `{ sent: false, skipped: true }` so local flows (with
 *   the Firebase emulator) keep working without an email provider.
 * - Never logs PII (recipient address) — only success/failure metadata.
 */

const DEFAULT_FROM = 'TerePay <noreply@terepay.com>';

let _resend: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  sent: boolean;
  /** True when sending was skipped because no provider is configured (dev). */
  skipped?: boolean;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resend = getResend();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not configured — skipping send (development fallback).');
    return { sent: false, skipped: true };
  }

  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM;

  const { error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (error) {
    // Log the provider's error name + message (these describe the
    // configuration problem and do not contain recipient PII) plus the
    // `from` address, which is the usual culprit (unverified domain).
    console.error(
      `[email] Resend send failed: ${error.name ?? 'unknown_error'} — ${error.message ?? 'no message'} (from: ${from})`,
    );
    throw new Error('Email send failed');
  }

  return { sent: true };
}
