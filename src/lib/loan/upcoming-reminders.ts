import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { auditLog } from '@/lib/utils/audit';
import { sendEmail } from '@/lib/email/resend';
import { deriveLoanSummary, isLiveLoanStatus } from './active-loan';
import { planReminders, type ReminderContext } from './reminders';
import type { LoanApplication, PaymentConsent, SentReminder } from '@/types/application';

/** Today's calendar date in NZ (Pacific/Auckland) as YYYY-MM-DD. */
function nzToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });
}

/**
 * How this loan's instalments are collected — drives the reminder wording.
 * Shared with the arrears engine so both paths describe the same thing.
 */
export function collectionModeOf(app: LoanApplication): ReminderContext['collectionMode'] {
  const consent = app.paymentConsent as PaymentConsent | undefined;
  return consent?.status === 'active' ? 'auto' : 'manual';
}

/** Email + first name for the borrower, or empty strings when unavailable. */
export async function loadReminderRecipient(
  applicantId: string,
): Promise<{ email: string; firstName: string }> {
  try {
    const snap = await adminDb.collection('users').doc(applicantId).get();
    const user = snap.data() as { email?: string; firstName?: string } | undefined;
    return { email: user?.email ?? '', firstName: user?.firstName ?? '' };
  } catch (err) {
    console.error('[reminders] failed to load applicant', applicantId, err);
    return { email: '', firstName: '' };
  }
}

export interface UpcomingRemindersResult {
  ran: boolean;
  skippedReason?: string;
  remindersSent: number;
}

const SKIP = (reason: string): UpcomingRemindersResult => ({
  ran: false,
  skippedReason: reason,
  remindersSent: 0,
});

/**
 * Send the "upcoming payment" reminder (1–3 days before an instalment falls
 * due) for one loan — and nothing else. The late-fee / default sequence stays
 * inside the arrears engine, so this can run on every live loan from the daily
 * sweep while `arrears_auto_enabled` is off and fees remain a lender decision.
 *
 * Idempotent: de-dupes on `reminders[]` key `upcoming_payment:<n>` and
 * re-checks inside the transaction, so the arrears engine running later the
 * same day (manually or with the flag on) never sends a second copy.
 *
 * Only loans stamped with `feePolicyVersion` are reminded — the email quotes
 * the late-fee terms, which do not apply to older loans.
 */
export async function sendUpcomingReminders(opts: {
  applicationId: string;
  actor: string;
  ip?: string;
}): Promise<UpcomingRemindersResult> {
  const { applicationId, actor, ip } = opts;
  const appRef = adminDb.collection('loanApplications').doc(applicationId);
  const snap = await appRef.get();
  if (!snap.exists) return SKIP('not_found');
  const app = snap.data() as LoanApplication;

  if (!app.feePolicyVersion) return SKIP('no_policy');
  if (!isLiveLoanStatus(app.status)) return SKIP('not_live');

  const summary = deriveLoanSummary(app);
  if (summary.installments.length === 0) return SKIP('no_schedule');

  const existing: SentReminder[] = Array.isArray(app.reminders) ? app.reminders : [];
  const sentKeys = new Set(existing.map((r) => r.key));

  const recipient = await loadReminderRecipient(app.applicantId);
  if (!recipient.email) return SKIP('no_email');

  const planned = planReminders({
    installments: summary.installments,
    today: nzToday(),
    sentKeys,
    ctx: {
      applicantName: recipient.firstName,
      applicationRef: app.referenceNumber,
      collectionMode: collectionModeOf(app),
    },
  }).filter((r) => r.type === 'upcoming_payment');

  if (planned.length === 0) return { ran: true, remindersSent: 0 };

  const now = Timestamp.now();
  const sent: SentReminder[] = [];
  for (const reminder of planned) {
    try {
      const res = await sendEmail({
        to: recipient.email,
        subject: reminder.subject,
        html: reminder.html,
        text: reminder.text,
      });
      if (res.sent) {
        sent.push({
          key: reminder.key,
          type: reminder.type,
          installmentNumber: reminder.installmentNumber,
          sentAt: now,
          channel: 'email',
        });
      }
    } catch (err) {
      // Not recorded → retried on the next daily run. No recipient PII in logs.
      console.error('[upcoming-reminders] send failed', reminder.key, applicationId, err);
    }
  }

  if (sent.length === 0) return { ran: true, remindersSent: 0 };

  let written: SentReminder[] = [];
  await adminDb.runTransaction(async (tx) => {
    const fresh = await tx.get(appRef);
    if (!fresh.exists) return;
    const cur: SentReminder[] = Array.isArray(fresh.data()?.reminders)
      ? (fresh.data()!.reminders as SentReminder[])
      : [];
    const curKeys = new Set(cur.map((r) => r.key));
    written = sent.filter((r) => !curKeys.has(r.key));
    if (written.length === 0) return;
    tx.update(appRef, {
      reminders: [...cur, ...written],
      'timeline.updatedAt': FieldValue.serverTimestamp(),
    });
  });

  if (written.length > 0) {
    await auditLog({
      userId: actor,
      action: 'upcoming_payment_reminders_sent',
      targetId: applicationId,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
      changes: {
        installments: written.map((r) => r.installmentNumber),
        collectionMode: collectionModeOf(app),
      },
    });
  }

  return { ran: true, remindersSent: written.length };
}
