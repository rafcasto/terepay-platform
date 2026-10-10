import { STATEMENT_IDENTITY, type InterestOnFeesPolicy } from './config';
import { formatNzd } from './money';
import type { EngineResult } from './types';

/**
 * Pure statement content builder (SG-1, SG-2, SG-3, SG-5).
 *
 * Builds an honestly-labelled statement model FROM THE LEDGER BREAKDOWN — never
 * from interest-on-instalment math. The physical legacy .docx template embeds a
 * per-shortfall calculation in its own Section 3/4; we deliberately do NOT
 * reproduce that. Section 3 is the supportive rewrite from CLAUDE.md STEP 4, and
 * when policy = OFF there is NO line stating interest is charged on fees (SG-3).
 */

export interface StatementContent {
  dateIssued: string; // e.g. "21 July 2026"
  statementDateYmd: string; // YYYY-MM-DD (for filenames — TZ-stable)
  loanId: string;
  clientId: string;
  fullNameCaps: string;
  firstName: string;
  policy: InterestOnFeesPolicy;
  oldestOverdueDueDate: string | null;

  principalOutstanding: string;
  interestAccruedToDate: string;
  lateFeeCount: number;
  lateFeesTotal: string;
  defaultFeeLine: string; // amount OR "Not applicable — already applied"
  interestOnFeesLine: string | null; // null (omitted) when policy = OFF (SG-3)
  totalOwing: string;

  identity: typeof STATEMENT_IDENTITY;
}

/** Format a YYYY-MM-DD date as "DD Month YYYY" (NZ long form). */
export function formatLongDate(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  return d.toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function buildStatementContent(
  result: EngineResult,
  borrower: { loanId: string; clientId: string; fullName: string },
): StatementContent {
  const b = result.breakdown;
  const policyOff = result.policy === 'OFF';

  const nameParts = borrower.fullName.trim().split(/\s+/);
  const firstName = nameParts[0] ?? '';

  const overdue = result.fees
    .filter((f) => f.feeType === 'late_payment' || f.feeType === 'payment_default')
    .map((f) => f.assessedDate)
    .sort();

  return {
    dateIssued: formatLongDate(result.statementDate),
    statementDateYmd: result.statementDate,
    loanId: borrower.loanId,
    clientId: borrower.clientId,
    fullNameCaps: borrower.fullName.toUpperCase(),
    firstName,
    policy: result.policy,
    oldestOverdueDueDate: overdue.length ? formatLongDate(overdue[0]) : null,

    principalOutstanding: formatNzd(b.principalOutstanding),
    interestAccruedToDate: formatNzd(b.interestAccruedToDate),
    lateFeeCount: b.lateFeeCount,
    lateFeesTotal: formatNzd(b.lateFeesTotal),
    defaultFeeLine: b.defaultFeeTriggered ? formatNzd(b.defaultFee) : 'Not applicable — already applied',
    // SG-3: omit the interest-on-fees line entirely when policy is OFF.
    interestOnFeesLine: policyOff ? null : formatNzd(b.interestOnFees),
    totalOwing: formatNzd(b.totalOwing),

    identity: STATEMENT_IDENTITY,
  };
}

/** Render the statement as Markdown (supportive tone — CC-7). */
export function renderStatementMarkdown(c: StatementContent): string {
  const feeInterest = c.interestOnFeesLine ? `| Interest on fees | ${c.interestOnFeesLine} |\n` : '';
  return `# FORMAL ACCRUED INTEREST & OUTSTANDING BALANCE STATEMENT

**${c.identity.accountName}** | ${c.identity.fsp} | NZBN ${c.identity.nzbn}

---

**Date Issued:** ${c.dateIssued}
**Loan ID:** ${c.loanId}
**Client ID:** ${c.clientId}

**${c.fullNameCaps}**

---

Dear ${c.firstName},

**Re: Accrued interest and outstanding balance — Loan ${c.loanId}**

- This statement outlines your outstanding balance and accrued interest on account (${c.clientId}) as at ${c.dateIssued}.
- Interest accrues daily at 0.13425% per day (49% per annum) on the unpaid balance from the loan start date until full payment.
- We encourage you to make a payment as soon as possible to reduce the total amount owing.

---

## Outstanding balance as at ${c.dateIssued}

| Item | Amount |
|------|--------|
| Principal outstanding | ${c.principalOutstanding} |
| Interest accrued to date | ${c.interestAccruedToDate} |
| Late payment fees (${c.lateFeeCount} × $10.00) | ${c.lateFeesTotal} |
| Payment default fee | ${c.defaultFeeLine} |
${feeInterest}| **TOTAL AMOUNT OWING** | **${c.totalOwing}** |

---

## Why paying sooner reduces your balance

Every day your balance remains unpaid, interest increases.

- Make a full or partial payment to reduce accrual.
- Contact us to set up a payment arrangement.
- Apply for a hardship variation if you are experiencing difficulty.

---

## Your rights under the Credit Contracts and Consumer Finance Act 2003

If you are unable to reasonably keep up with your payments because of illness, injury, loss of employment, the end of a relationship, or other reasonable cause, you may be entitled to apply for a hardship variation under the Credit Contracts and Consumer Finance Act 2003 (CCCFA).

To apply, you must make a written application to us and explain your reason for the application. You must apply as soon as possible. If you leave it too long, we may not have to consider your application. A hardship variation may allow us to extend the term of your loan and reduce your payments, postpone your payments for a period, or both.

---

## Get in touch

We are here to support you. Please contact us at ${c.identity.contactEmail} if you have any questions or would like to discuss a payment arrangement.

---

## Payment details

**Bank:** ${c.identity.bankName}
**Account name:** ${c.identity.accountName}
**Account number:** ${c.identity.accountNumber}
**Reference:** ${c.clientId}

---

Yours sincerely,

**${c.identity.signOffName}**
${c.identity.signOffTitle}
${c.identity.accountName}
`;
}
