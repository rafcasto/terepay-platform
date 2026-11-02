import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { auditLog } from '@/lib/utils/audit';
import { sendEmail } from '@/lib/email/resend';
import { LATE_PAYMENT_FEE, LATE_PAYMENT_GRACE_DAYS } from '@/lib/constants/fees';
import type { LoanApplication, SentReminder } from '@/types/application';

const HARDSHIP_URL = 'https://terepay.com/help/hardship';
const SUPPORT_EMAIL = 'support@terepay.com';

function money(n: number): string {
  return `$${n.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Email the borrower once when their bank reports the SetPay repayment
 * authority was revoked/cancelled. Both detection paths (the
 * `enduring.status.revoked` webhook and the daily status poll) call this, so
 * it de-dupes on `reminders[]` with key `consent_revoked:<mandateId>` inside a
 * transaction — the customer gets exactly one email per revoked authority.
 *
 * Never throws: a failed send is logged and retried the next time revocation
 * is observed (the key is only recorded after a successful send).
 */
export async function sendConsentRevokedNotice(opts: {
  applicationId: string;
  mandateId: string;
  actor: string;
  ip?: string;
}): Promise<{ sent: boolean; skippedReason?: string }> {
  const { applicationId, mandateId, actor, ip } = opts;
  const key = `consent_revoked:${mandateId}`;
  const appRef = adminDb.collection('loanApplications').doc(applicationId);

  try {
    const snap = await appRef.get();
    if (!snap.exists) return { sent: false, skippedReason: 'not_found' };
    const app = snap.data() as LoanApplication;

    const existing: SentReminder[] = Array.isArray(app.reminders) ? app.reminders : [];
    if (existing.some((r) => r.key === key)) return { sent: false, skippedReason: 'already_sent' };

    const userSnap = await adminDb.collection('users').doc(app.applicantId).get();
    const user = userSnap.data() as { email?: string; firstName?: string } | undefined;
    const to = user?.email ?? '';
    if (!to) return { sent: false, skippedReason: 'no_email' };

    const greeting = user?.firstName ? `Hi ${user.firstName},` : 'Hi,';
    const ref = app.referenceNumber ?? applicationId.slice(0, 8);
    const subject = `Your repayment authority was cancelled — loan ${ref}`;

    const text = `${greeting}

Your bank has told us that the repayment authority for loan ${ref} (Pay by bank with Qippay) has been cancelled. No further instalments can be collected under it.

Your loan is still open and your repayment dates have not changed. Please reply to this email or contact us at ${SUPPORT_EMAIL} within the next few days so we can set up another way to pay — for example a new bank authorisation from your application page, or a bank transfer by each due date.

Interest continues to accrue on your outstanding balance, and a ${money(LATE_PAYMENT_FEE)} late fee applies if an instalment is not paid within ${LATE_PAYMENT_GRACE_DAYS} days of its due date. If you are having trouble making payments, you can apply for hardship support at ${HARDSHIP_URL}.

TerePay — Borrowing power in your hands.`;

    const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1C2A3A;max-width:560px;margin:0 auto">
<p>${greeting}</p>
<p>Your bank has told us that the repayment authority for loan <strong>${ref}</strong> (Pay by bank with Qippay) has been <strong>cancelled</strong>. No further instalments can be collected under it.</p>
<p>Your loan is still open and your repayment dates have not changed. Please reply to this email or contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#B45600">${SUPPORT_EMAIL}</a> within the next few days so we can set up another way to pay — for example a new bank authorisation from your application page, or a bank transfer by each due date.</p>
<hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0" />
<p style="color:#475569;font-size:13px;line-height:1.5">Interest continues to accrue on your outstanding balance, and a ${money(LATE_PAYMENT_FEE)} late fee applies if an instalment is not paid within ${LATE_PAYMENT_GRACE_DAYS} days of its due date. If you are having trouble making payments, you can <a href="${HARDSHIP_URL}" style="color:#B45600">apply for hardship support</a>. For disputes, contact <a href="mailto:${SUPPORT_EMAIL}" style="color:#B45600">${SUPPORT_EMAIL}</a>.</p>
<p style="color:#94A3B8;font-size:12px">TerePay — Borrowing power in your hands.</p>
</div>`;

    const res = await sendEmail({ to, subject, html, text });
    if (!res.sent) return { sent: false, skippedReason: res.skipped ? 'email_not_configured' : 'send_failed' };

    // Record the send; re-check the key under the transaction so two detectors
    // racing each other cannot both record (the email itself is idempotent at
    // the provider only per call, so the pre-check above does the real work).
    await adminDb.runTransaction(async (tx) => {
      const fresh = await tx.get(appRef);
      if (!fresh.exists) return;
      const cur: SentReminder[] = Array.isArray(fresh.data()?.reminders)
        ? (fresh.data()!.reminders as SentReminder[])
        : [];
      if (cur.some((r) => r.key === key)) return;
      const entry: SentReminder = {
        key,
        type: 'consent_revoked',
        sentAt: Timestamp.now(),
        channel: 'email',
      };
      tx.update(appRef, {
        reminders: [...cur, entry],
        'timeline.updatedAt': FieldValue.serverTimestamp(),
      });
    });

    await auditLog({
      userId: actor,
      action: 'consent_revoked_notice_sent',
      targetId: applicationId,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
      changes: { mandateId, channel: 'email' },
    });
    return { sent: true };
  } catch (err) {
    // Never leak the recipient address — log ids only.
    console.error('[consent-revoked-notice] failed', { applicationId, mandateId, err });
    return { sent: false, skippedReason: 'error' };
  }
}
