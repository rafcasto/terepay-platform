import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { StatementContent } from './statement';

/**
 * Render a StatementContent model to a .docx Buffer (SG-1, SG-4).
 *
 * The document is built fresh from the ledger breakdown — it does NOT refill the
 * legacy per-shortfall template. Saved by the service as
 * TerePay_Accrual_[First]_[Last]_[ClientID]_[DateDDMMMYYYY].docx.
 */

function h(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } });
}
function p(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun(text)], spacing: { after: 120 } });
}
function bullet(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun(text)], bullet: { level: 0 } });
}
function row(label: string, amount: string, bold = false): TableRow {
  return new TableRow({
    children: [
      new TableCell({ width: { size: 70, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: label, bold })] })] }),
      new TableCell({ width: { size: 30, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: amount, bold })] })] }),
    ],
  });
}

export async function buildStatementDocx(c: StatementContent): Promise<Buffer> {
  const balanceRows: TableRow[] = [
    row('Principal outstanding', c.principalOutstanding),
    row('Interest accrued to date', c.interestAccruedToDate),
    row(`Late payment fees (${c.lateFeeCount} × $10.00)`, c.lateFeesTotal),
    row('Payment default fee', c.defaultFeeLine),
  ];
  // SG-3: only include the interest-on-fees row when policy = ON.
  if (c.interestOnFeesLine) balanceRows.push(row('Interest on fees', c.interestOnFeesLine));
  balanceRows.push(row('TOTAL AMOUNT OWING', c.totalOwing, true));

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'FORMAL ACCRUED INTEREST & OUTSTANDING BALANCE STATEMENT', bold: true, size: 28 })],
            spacing: { after: 120 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `${c.identity.accountName} | ${c.identity.fsp} | NZBN ${c.identity.nzbn}`, size: 18 })],
            spacing: { after: 240 },
          }),
          p(`Date Issued: ${c.dateIssued}`),
          p(`Loan ID: ${c.loanId}`),
          p(`Client ID: ${c.clientId}`),
          new Paragraph({ children: [new TextRun({ text: c.fullNameCaps, bold: true })], spacing: { after: 240 } }),

          p(`Dear ${c.firstName},`),
          new Paragraph({ children: [new TextRun({ text: `Re: Accrued interest and outstanding balance — Loan ${c.loanId}`, bold: true })], spacing: { after: 120 } }),
          bullet(`This statement outlines your outstanding balance and accrued interest on account (${c.clientId}) as at ${c.dateIssued}.`),
          bullet('Interest accrues daily at 0.13425% per day (49% per annum) on the unpaid balance from the loan start date until full payment.'),
          bullet('We encourage you to make a payment as soon as possible to reduce the total amount owing.'),

          h(`Outstanding balance as at ${c.dateIssued}`),
          new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: balanceRows }),

          h('Why paying sooner reduces your balance'),
          p('Every day your balance remains unpaid, interest increases.'),
          bullet('Make a full or partial payment to reduce accrual.'),
          bullet('Contact us to set up a payment arrangement.'),
          bullet('Apply for a hardship variation if you are experiencing difficulty.'),

          h('Your rights under the Credit Contracts and Consumer Finance Act 2003'),
          p('If you are unable to reasonably keep up with your payments because of illness, injury, loss of employment, the end of a relationship, or other reasonable cause, you may be entitled to apply for a hardship variation under the Credit Contracts and Consumer Finance Act 2003 (CCCFA).'),
          p('To apply, you must make a written application to us and explain your reason for the application. You must apply as soon as possible. If you leave it too long, we may not have to consider your application. A hardship variation may allow us to extend the term of your loan and reduce your payments, postpone your payments for a period, or both.'),

          h('Get in touch'),
          p(`We are here to support you. Please contact us at ${c.identity.contactEmail} if you have any questions or would like to discuss a payment arrangement.`),

          h('Payment details'),
          p(`Bank: ${c.identity.bankName}`),
          p(`Account name: ${c.identity.accountName}`),
          p(`Account number: ${c.identity.accountNumber}`),
          p(`Reference: ${c.clientId}`),

          new Paragraph({ text: 'Yours sincerely,', spacing: { before: 240, after: 120 } }),
          new Paragraph({ children: [new TextRun({ text: c.identity.signOffName, bold: true })] }),
          p(c.identity.signOffTitle),
          p(c.identity.accountName),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

/** SG-4 filename: TerePay_Accrual_First_Last_ClientID_DDMonYYYY.docx */
export function statementFileName(c: StatementContent): string {
  const [first = 'Unknown', ...rest] = c.fullNameCaps.split(/\s+/);
  const last = rest.length ? rest[rest.length - 1] : 'Borrower';
  const d = new Date(`${c.statementDateYmd}T00:00:00.000Z`);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mon = d.toLocaleDateString('en-NZ', { month: 'short', timeZone: 'UTC' });
  const yyyy = d.getUTCFullYear();
  const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
  return `TerePay_Accrual_${cap(first)}_${cap(last)}_${c.clientId}_${dd}${mon}${yyyy}.docx`;
}
