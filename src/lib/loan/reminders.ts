import {
  LATE_PAYMENT_FEE,
  LATE_PAYMENT_GRACE_DAYS,
  PAYMENT_DEFAULT_FEE,
  PAYMENT_DEFAULT_GRACE_DAYS,
} from '@/lib/constants/fees';
import { daysBetween } from './arrears';
import type { DerivedInstallment } from './active-loan';
import type { ReminderType } from '@/types/application';

/**
 * Pure dunning-reminder planner. Given a loan's instalment schedule and today's
 * NZ date, it decides which reminder emails are due and returns ready-to-send
 * content. No I/O — the orchestrator sends via Resend (`sendEmail`) and records
 * what was sent to dedupe.
 *
 * The sequence (app-driven, one email per stage per instalment):
 *   - upcoming_payment  — 1–3 days before an instalment falls due
 *   - payment_missed    — instalment now overdue; interest is accruing
 *   - late_fee_warning  — final grace day before the $10 late fee applies
 *   - late_fee_charged  — the $10 late fee has been applied
 *   - default_warning   — approaching the one-off $25 default fee
 *
 * Compliance (CCCFA / TerePay design system): every reminder keeps costs
 * visible, never implies the loan is free or consequence-free, and links to
 * hardship + dispute-resolution help.
 */

const HARDSHIP_URL = 'https://terepay.com/help/hardship';
const SUPPORT_EMAIL = 'support@terepay.com';

export interface ReminderContext {
  applicantName: string;
  applicationRef: string;
}

export interface PlannedReminder {
  /** Dedup key `<type>:<installmentNumber>`. */
  key: string;
  type: ReminderType;
  installmentNumber: number;
  subject: string;
  html: string;
  text: string;
}

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-NZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Shared footer kept on every reminder for compliance + reachability. */
function footer(): { html: string; text: string } {
  const text = `
Interest and fees apply to your loan (see your loan contract). If you are having trouble making a payment, you can apply for hardship support at ${HARDSHIP_URL} or reply to this email. For disputes, contact us at ${SUPPORT_EMAIL}.

TerePay — Borrowing power in your hands.`;
  const html = `
    <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0" />
    <p style="color:#475569;font-size:13px;line-height:1.5">
      Interest and fees apply to your loan (see your loan contract). If you are
      having trouble making a payment, you can
      <a href="${HARDSHIP_URL}" style="color:#B45600">apply for hardship support</a>
      or reply to this email. For disputes, contact us at
      <a href="mailto:${SUPPORT_EMAIL}" style="color:#B45600">${SUPPORT_EMAIL}</a>.
    </p>
    <p style="color:#94A3B8;font-size:12px">TerePay — Borrowing power in your hands.</p>`;
  return { html, text };
}

function wrap(bodyHtml: string): string {
  const f = footer();
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1C2A3A;max-width:560px;margin:0 auto">${bodyHtml}${f.html}</div>`;
}

function wrapText(bodyText: string): string {
  return `${bodyText}\n${footer().text}`;
}

/**
 * Plan the reminders due today. `sentKeys` are the dedup keys already recorded
 * for this loan, so each stage is emitted at most once.
 */
export function planReminders(input: {
  installments: DerivedInstallment[];
  today: string;
  sentKeys: Set<string>;
  ctx: ReminderContext;
}): PlannedReminder[] {
  const { installments, today, sentKeys, ctx } = input;
  const out: PlannedReminder[] = [];

  const push = (r: PlannedReminder) => {
    if (!sentKeys.has(r.key)) out.push(r);
  };

  const greeting = ctx.applicantName ? `Hi ${ctx.applicantName},` : 'Hi,';
  const ref = ctx.applicationRef;

  for (const inst of installments) {
    if (inst.status === 'paid' || inst.status === 'cancelled') continue;

    const n = inst.installmentNumber;
    const amount = money(Math.round(inst.amount * 100));
    const daysUntilDue = daysBetween(today, inst.dueDate);
    const daysPastDue = daysBetween(inst.dueDate, today);

    // Upcoming payment (1–3 days out).
    if (daysUntilDue >= 1 && daysUntilDue <= 3) {
      const body = `<p>${greeting}</p><p>This is a reminder that your instalment ${n} of <strong>${amount}</strong> for loan ${ref} is due on <strong>${inst.dueDate}</strong>. It will be collected automatically from your linked bank account.</p><p>Please make sure the funds are available. Interest continues to accrue on your balance, and a ${money(LATE_PAYMENT_FEE * 100)} late fee applies if a payment is not made within ${LATE_PAYMENT_GRACE_DAYS} days of the due date.</p>`;
      push({
        key: `upcoming_payment:${n}`,
        type: 'upcoming_payment',
        installmentNumber: n,
        subject: `Payment of ${amount} due ${inst.dueDate} — loan ${ref}`,
        html: wrap(body),
        text: wrapText(`${greeting}\n\nReminder: instalment ${n} of ${amount} for loan ${ref} is due on ${inst.dueDate} and will be collected from your linked bank account. Please ensure funds are available. A ${money(LATE_PAYMENT_FEE * 100)} late fee applies if not paid within ${LATE_PAYMENT_GRACE_DAYS} days of the due date.`),
      });
      continue;
    }

    if (daysPastDue < 1) continue; // not yet due

    // Payment missed — interest is now accruing.
    if (daysPastDue >= 1) {
      const body = `<p>${greeting}</p><p>We were unable to collect instalment ${n} of <strong>${amount}</strong> for loan ${ref}, which was due on ${inst.dueDate}. This can happen when there are insufficient funds in your account.</p><p>We will keep trying to collect this payment over the next few days. Interest is now accruing daily on your outstanding balance until it is paid. You have until ${LATE_PAYMENT_GRACE_DAYS} days after the due date to pay before a ${money(LATE_PAYMENT_FEE * 100)} late fee applies.</p><p>Please make sure funds are available, or reply to arrange another way to pay.</p>`;
      push({
        key: `payment_missed:${n}`,
        type: 'payment_missed',
        installmentNumber: n,
        subject: `Action needed: payment missed for loan ${ref}`,
        html: wrap(body),
        text: wrapText(`${greeting}\n\nWe could not collect instalment ${n} of ${amount} for loan ${ref} (due ${inst.dueDate}) — often due to insufficient funds. We will keep trying over the next few days. Interest is now accruing daily on your outstanding balance. A ${money(LATE_PAYMENT_FEE * 100)} late fee applies if unpaid ${LATE_PAYMENT_GRACE_DAYS} days after the due date. Please ensure funds are available or reply to arrange payment.`),
      });
    }

    // Final grace day — late fee applies tomorrow.
    if (daysPastDue >= LATE_PAYMENT_GRACE_DAYS) {
      const body = `<p>${greeting}</p><p>Instalment ${n} of <strong>${amount}</strong> for loan ${ref} is still unpaid. A ${money(LATE_PAYMENT_FEE * 100)} late payment fee will apply if it is not paid within the ${LATE_PAYMENT_GRACE_DAYS}-day grace period.</p><p>Please pay now to avoid the fee. Interest continues to accrue daily on your outstanding balance.</p>`;
      push({
        key: `late_fee_warning:${n}`,
        type: 'late_fee_warning',
        installmentNumber: n,
        subject: `Pay now to avoid a ${money(LATE_PAYMENT_FEE * 100)} late fee — loan ${ref}`,
        html: wrap(body),
        text: wrapText(`${greeting}\n\nInstalment ${n} of ${amount} for loan ${ref} is still unpaid. A ${money(LATE_PAYMENT_FEE * 100)} late fee applies once the ${LATE_PAYMENT_GRACE_DAYS}-day grace period passes. Please pay now to avoid it. Interest continues to accrue daily.`),
      });
    }

    // Late fee charged.
    if (daysPastDue >= LATE_PAYMENT_GRACE_DAYS + 1) {
      const body = `<p>${greeting}</p><p>A ${money(LATE_PAYMENT_FEE * 100)} late payment fee has been applied to loan ${ref} because instalment ${n} of ${amount} remained unpaid beyond the ${LATE_PAYMENT_GRACE_DAYS}-day grace period.</p><p>Interest continues to accrue daily on your outstanding balance. If this instalment stays unpaid past ${PAYMENT_DEFAULT_GRACE_DAYS} days, a one-off ${money(PAYMENT_DEFAULT_FEE * 100)} default fee will also apply. Please pay as soon as you can, or reply to discuss your options.</p>`;
      push({
        key: `late_fee_charged:${n}`,
        type: 'late_fee_charged',
        installmentNumber: n,
        subject: `A ${money(LATE_PAYMENT_FEE * 100)} late fee was applied — loan ${ref}`,
        html: wrap(body),
        text: wrapText(`${greeting}\n\nA ${money(LATE_PAYMENT_FEE * 100)} late fee was applied to loan ${ref} because instalment ${n} of ${amount} stayed unpaid beyond the ${LATE_PAYMENT_GRACE_DAYS}-day grace period. Interest keeps accruing daily. If unpaid past ${PAYMENT_DEFAULT_GRACE_DAYS} days, a one-off ${money(PAYMENT_DEFAULT_FEE * 100)} default fee also applies. Please pay soon or reply to discuss options.`),
      });
    }

    // Approaching the one-off default fee.
    if (daysPastDue >= PAYMENT_DEFAULT_GRACE_DAYS - 1) {
      const body = `<p>${greeting}</p><p>Instalment ${n} of ${amount} for loan ${ref} remains unpaid. A one-off ${money(PAYMENT_DEFAULT_FEE * 100)} payment default fee will apply once it is more than ${PAYMENT_DEFAULT_GRACE_DAYS} days overdue, in addition to any late fee already charged.</p><p>Please pay now to avoid the default fee. If you are experiencing financial hardship, we may be able to help — reply to this email or apply for hardship support.</p>`;
      push({
        key: `default_warning:${n}`,
        type: 'default_warning',
        installmentNumber: n,
        subject: `Avoid a ${money(PAYMENT_DEFAULT_FEE * 100)} default fee — loan ${ref}`,
        html: wrap(body),
        text: wrapText(`${greeting}\n\nInstalment ${n} of ${amount} for loan ${ref} is still unpaid. A one-off ${money(PAYMENT_DEFAULT_FEE * 100)} default fee applies once it is more than ${PAYMENT_DEFAULT_GRACE_DAYS} days overdue, on top of any late fee. Please pay now to avoid it, or reply if you are experiencing hardship.`),
      });
    }
  }

  return out;
}
