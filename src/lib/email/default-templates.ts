/**
 * Built-in default email templates.
 *
 * Pure constants — no server-only imports — so this module is safe to import
 * from both server code (the email sender) and client code (the admin editor's
 * "Use default template" button).
 *
 * Merge fields use the `{{variableName}}` syntax and are substituted at send
 * time by `renderMergeFields()` in `./templates.ts`.
 *
 * Admins can override any of these by creating an active template of the same
 * `type` in the admin Email Templates UI. When no active template exists, the
 * default below is used so verification never silently fails.
 */

import type { EmailTemplateType } from '@/types/admin';

export interface EmailDefaultTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
  availableVariables: string[];
}

const BRAND_INK = '#0F1D2E';
const BRAND_ORANGE_TEXT = '#B45600'; // accessible orange on white (AA)
const PAGE_BG = '#F6F8FB';
const BORDER = '#E2E8F0';
const TEXT_BODY = '#1C2A3A';
const TEXT_MUTED = '#5B6B7E';

/**
 * Wrap inner content in the shared TerePay branded email shell.
 * Uses table layout + inline styles for broad email-client compatibility.
 */
function shell(innerHtml: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
  </head>
  <body style="margin:0;padding:0;background:${PAGE_BG};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE_BG};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#ffffff;border:1px solid ${BORDER};border-radius:14px;overflow:hidden;">
            <tr>
              <td style="background:${BRAND_INK};padding:22px 32px;">
                <span style="font-family:'Poppins',Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.2px;">Tere<span style="color:#FBC78D;">Pay</span></span>
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8295ab;margin-top:4px;">Borrowing power in your hands</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:${TEXT_BODY};">
                ${innerHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#F8FAFC;border-top:1px solid ${BORDER};font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${TEXT_MUTED};line-height:1.6;">
                TerePay &middot; 27 Henry Partington Place, Greenhithe, Auckland &middot; All loans are charged interest and an admin fee, shown in full before you sign.
                <br />Applications can be declined. If you&rsquo;re facing hardship, contact us &mdash; we&rsquo;re here to help.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td align="center" style="border-radius:999px;background:${BRAND_ORANGE_TEXT};">
        <a href="${href}" style="display:inline-block;padding:13px 30px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

const EMAIL_VERIFICATION_HTML = shell(
  `<h1 style="margin:0 0 8px;font-family:'Poppins',Arial,Helvetica,sans-serif;font-size:22px;font-weight:600;color:${BRAND_INK};">Confirm your email address</h1>
   <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hi {{firstName}},</p>
   <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">Thanks for creating your TerePay account. Please confirm this is your email address so we can keep your account secure and send you important updates about your application.</p>
   ${button('{{verificationUrl}}', 'Verify my email')}
   <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:${TEXT_MUTED};">If the button doesn&rsquo;t work, copy and paste this link into your browser:</p>
   <p style="margin:0 0 16px;font-size:13px;line-height:1.6;word-break:break-all;"><a href="{{verificationUrl}}" style="color:${BRAND_ORANGE_TEXT};">{{verificationUrl}}</a></p>
   <p style="margin:0;font-size:13px;line-height:1.6;color:${TEXT_MUTED};">If you didn&rsquo;t create a TerePay account, you can safely ignore this email.</p>`,
);

const EMAIL_VERIFICATION_TEXT = `Hi {{firstName}},

Thanks for creating your TerePay account. Please confirm your email address by opening the link below:

{{verificationUrl}}

If you didn't create a TerePay account, you can safely ignore this email.

TerePay - 27 Henry Partington Place, Greenhithe, Auckland.
All loans are charged interest and an admin fee, shown in full before you sign. Applications can be declined.`;

/**
 * Default templates keyed by template type. Only types with a built-in default
 * appear here; others are admin-authored only.
 */
export const EMAIL_DEFAULT_TEMPLATES: Partial<Record<EmailTemplateType, EmailDefaultTemplate>> = {
  email_verification: {
    subject: 'Confirm your email address for TerePay',
    htmlBody: EMAIL_VERIFICATION_HTML,
    textBody: EMAIL_VERIFICATION_TEXT,
    availableVariables: ['firstName', 'verificationUrl'],
  },
};
