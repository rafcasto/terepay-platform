import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { auditLog } from '@/lib/utils/audit';
import { sendEmail } from '@/lib/email/resend';
import { deriveLoanSummary, isLiveLoanStatus } from './active-loan';
import { assessArrears } from './arrears';
import { planReminders } from './reminders';
import type {
  ArrearsState,
  FeeAssessment,
  LoanApplication,
  SentReminder,
} from '@/types/application';

export interface AssessArrearsRunResult {
  ran: boolean;
  skippedReason?: string;
  /** New default fees written this run. */
  newFeeCount: number;
  /** True when the loan currently has an overdue instalment. */
  isInArrears: boolean;
  /** Dunning reminders emailed this run. */
  remindersSent: number;
}

const SKIP = (reason: string): AssessArrearsRunResult => ({
  ran: false,
  skippedReason: reason,
  newFeeCount: 0,
  isInArrears: false,
  remindersSent: 0,
});

/** Today's calendar date in NZ (Pacific/Auckland) as YYYY-MM-DD. */
function nzToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });
}

/**
 * Assess arrears for one loan application: charge any now-due default fees,
 * accrue post-default interest, and send the due dunning reminders via Resend.
 *
 * Fee/interest logic is pure (src/lib/loan/arrears.ts) and reminder planning is
 * pure (src/lib/loan/reminders.ts); this function is the I/O shell that loads
 * the application, performs side effects, and persists the result idempotently.
 *
 * Applies ONLY to loans stamped with `feePolicyVersion` (future loans). Existing
 * loans without the stamp are skipped, so the policy is never retroactive.
 *
 * Called per-application by the daily payment-refresh cron, after payment
 * reconciliation. Never throws for missing/ineligible loans — returns a skip.
 */
export async function assessArrearsForApplication(opts: {
  applicationId: string;
  actor: string;
  ip?: string;
}): Promise<AssessArrearsRunResult> {
  const { applicationId, actor, ip } = opts;
  const appRef = adminDb.collection('loanApplications').doc(applicationId);
  const snap = await appRef.get();
  if (!snap.exists) return SKIP('not_found');
  const app = snap.data() as LoanApplication;

  // Future-loans-only gate: no policy stamp → never assess.
  if (!app.feePolicyVersion) return SKIP('no_policy');
  if (!isLiveLoanStatus(app.status)) return SKIP('not_live');

  const summary = deriveLoanSummary(app);
  if (summary.installments.length === 0) return SKIP('no_schedule');

  const today = nzToday();
  const now = Timestamp.now();
  const existingFeeAssessments: FeeAssessment[] = Array.isArray(app.feeAssessments)
    ? (app.feeAssessments as FeeAssessment[])
    : [];

  // --- Fees + interest (pure) ------------------------------------------------
  const arrearsResult = assessArrears({
    installments: summary.installments,
    remainingBalanceCents: Math.round(summary.remainingBalance * 100),
    today,
    existingFeeAssessments,
    existingArrears: (app.arrears as ArrearsState | undefined) ?? null,
    now,
  });

  // --- Reminders (pure plan → send via Resend) -------------------------------
  const sentReminders: SentReminder[] = [];
  const existingReminders: SentReminder[] = Array.isArray(app.reminders)
    ? (app.reminders as SentReminder[])
    : [];
  const sentKeys = new Set(existingReminders.map((r) => r.key));

  // Resolve recipient (email + first name are plaintext top-level user fields).
  let recipientEmail = '';
  let firstName = '';
  try {
    const userSnap = await adminDb.collection('users').doc(app.applicantId).get();
    const user = userSnap.data() as { email?: string; firstName?: string } | undefined;
    recipientEmail = user?.email ?? '';
    firstName = user?.firstName ?? '';
  } catch (err) {
    console.error('[assess-arrears] failed to load applicant for reminders', applicationId, err);
  }

  if (recipientEmail) {
    const planned = planReminders({
      installments: summary.installments,
      today,
      sentKeys,
      ctx: { applicantName: firstName, applicationRef: app.referenceNumber },
    });

    for (const reminder of planned) {
      try {
        const res = await sendEmail({
          to: recipientEmail,
          subject: reminder.subject,
          html: reminder.html,
          text: reminder.text,
        });
        if (res.sent) {
          sentReminders.push({
            key: reminder.key,
            type: reminder.type,
            installmentNumber: reminder.installmentNumber,
            sentAt: now,
            channel: 'email',
          });
        }
      } catch (err) {
        // Do not record — a failed send is retried on the next run. Never leak
        // the recipient address into logs (PII).
        console.error('[assess-arrears] reminder send failed', reminder.key, applicationId, err);
      }
    }
  }

  // --- Persist (transaction, re-checking idempotency against fresh data) ------
  let writtenFees: FeeAssessment[] = [];
  let writtenReminders: SentReminder[] = [];

  await adminDb.runTransaction(async (tx) => {
    const fresh = await tx.get(appRef);
    if (!fresh.exists) return;
    const data = fresh.data() as LoanApplication;

    const curFees: FeeAssessment[] = Array.isArray(data.feeAssessments)
      ? (data.feeAssessments as FeeAssessment[])
      : [];
    const curFeeIds = new Set(curFees.map((f) => f.id));
    const feesToAdd = arrearsResult.newFeeAssessments.filter((f) => !curFeeIds.has(f.id));

    const curReminders: SentReminder[] = Array.isArray(data.reminders)
      ? (data.reminders as SentReminder[])
      : [];
    const curReminderKeys = new Set(curReminders.map((r) => r.key));
    const remindersToAdd = sentReminders.filter((r) => !curReminderKeys.has(r.key));

    const updates: Record<string, unknown> = {
      'timeline.updatedAt': FieldValue.serverTimestamp(),
    };
    if (feesToAdd.length > 0) {
      updates.feeAssessments = [...curFees, ...feesToAdd];
    }
    if (arrearsResult.arrears) {
      updates.arrears = arrearsResult.arrears;
    }
    if (remindersToAdd.length > 0) {
      updates.reminders = [...curReminders, ...remindersToAdd];
    }

    // Nothing to persist beyond the touch — still fine to write updatedAt.
    tx.update(appRef, updates);

    writtenFees = feesToAdd;
    writtenReminders = remindersToAdd;
  });

  // --- Audit -----------------------------------------------------------------
  for (const fee of writtenFees) {
    await auditLog({
      userId: actor,
      action: 'arrears_fee_assessed',
      targetId: applicationId,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
      changes: {
        feeId: fee.id,
        feeType: fee.type,
        amountCents: fee.amountCents,
        installmentNumber: fee.installmentNumber,
      },
    });
  }

  if (writtenFees.length > 0 || writtenReminders.length > 0 || arrearsResult.isInArrears) {
    await auditLog({
      userId: actor,
      action: 'arrears_assessed',
      targetId: applicationId,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
      changes: {
        isInArrears: arrearsResult.isInArrears,
        newFeeCount: writtenFees.length,
        accruedInterestCents: arrearsResult.arrears?.accruedInterestCents ?? 0,
        remindersSent: writtenReminders.length,
      },
    });
  }

  return {
    ran: true,
    newFeeCount: writtenFees.length,
    isInArrears: arrearsResult.isInArrears,
    remindersSent: writtenReminders.length,
  };
}
