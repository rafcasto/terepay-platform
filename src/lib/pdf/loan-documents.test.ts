import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderLoanStatement } from './loan-statement';
import { renderClosureLetter } from './closure-letter';
import { deriveLoanSummary, type LoanSummarySource } from '@/lib/loan/active-loan';
import { buildSchedule } from '@/lib/loan/repayment';
import type { Loan, ScheduledPayment } from '@/types/application';

/**
 * Renders the loan statement and closure letter for the three shapes a loan
 * can end up in — on time, in arrears, settled early — so a layout regression
 * in @react-pdf fails here rather than in a borrower's download. Set PDF_OUT
 * to a directory to keep the rendered files for a visual check.
 */

const START = '2026-08-24';
const SCHEDULE = buildSchedule({ principal: 1000, startDate: START });
const ts = (iso: string) => ({ toDate: () => new Date(iso) });

function payments(paidCount: number): ScheduledPayment[] {
  return SCHEDULE.rows.map((r) => ({
    installmentNumber: r.installmentNumber,
    dueDate: r.dueDate,
    amountCents: Math.round(r.amount * 100),
    status: r.installmentNumber <= paidCount ? ('success' as const) : ('scheduled' as const),
    retryCount: 0,
  }));
}

function app(extra: Record<string, unknown> = {}): LoanSummarySource {
  return {
    loanDetails: {
      requestedAmount: 1000,
      currency: 'NZD',
      loanPurpose: 'other',
      purposeDescription: '',
      approvedAmount: 1000,
      applicationFee: 50,
      fortnightlyPayment: SCHEDULE.fortnightlyPayment,
      totalRepayment: SCHEDULE.totalRepayable,
      totalInterest: SCHEDULE.totalInterest,
      interestRate: 0.49,
      rateModel: 'amortised_v1',
      disbursementDate: START,
    },
    timeline: { disbursedAt: ts(`${START}T00:00:00Z`) },
    scheduledPayments: payments(4),
    ...extra,
  } as unknown as LoanSummarySource;
}

const clearedFace = SCHEDULE.rows.slice(1).reduce((a, r) => a + r.amount, 0);

const SETTLED_EARLY = app({
  scheduledPayments: payments(4),
  feeAssessments: [
    { id: 'late:2', type: 'late_payment', amountCents: 1000, installmentNumber: 2, reason: '', assessedAt: ts('2026-09-25T00:00:00Z') },
  ],
  earlyRepayment: {
    provider: 'qippay_payby',
    status: 'paid',
    paymentId: 'pmU_1',
    hostedUrl: '',
    beneficiaryId: 'b',
    paidAt: ts('2026-09-28T03:00:00Z'),
    quote: {
      currency: 'NZD',
      outstandingBalanceCents: Math.round(clearedFace * 100),
      unearnedInterestRebateCents: Math.round((clearedFace - 778.27) * 100),
      netOutstandingCents: 77827,
      prepaymentFeeCents: 2500,
      arrearsChargesCents: 1000,
      totalPayoffCents: 81327,
      installmentsCleared: [2, 3, 4],
      rebateBreakdown: {
        method: 'actuarial_reducing_balance',
        totalInterest: SCHEDULE.totalInterest,
        totalInstalments: 4,
        remainingInstalments: 3,
        grossFutureInterest: 0,
        termDays: 56,
        elapsedDays: 35,
        remainingDays: 21,
        loanStartDate: START,
        finalDueDate: SCHEDULE.rows[3].dueDate,
        settlementDate: '2026-09-28',
        outstandingPrincipal: 756.93,
        accruedInterest: 21.34,
        accrualFromDate: SCHEDULE.rows[0].dueDate,
        accrualDays: 21,
      },
    },
  },
});

const IN_ARREARS = app({
  scheduledPayments: payments(1),
  feeAssessments: [
    { id: 'late:2', type: 'late_payment', amountCents: 1000, installmentNumber: 2, reason: '', assessedAt: ts('2026-09-25T00:00:00Z') },
    { id: 'default', type: 'payment_default', amountCents: 2500, reason: '', assessedAt: ts('2026-09-29T00:00:00Z') },
  ],
  arrears: { accruedInterestCents: 912, dailyRate: 0.49 / 365, earliestMissDate: SCHEDULE.rows[1].dueDate, lastAssessedDate: '2026-09-30' },
});

const ON_TIME = app({ scheduledPayments: payments(4) });

function loanRecord(source: LoanSummarySource, status: Loan['status']): Loan {
  const s = deriveLoanSummary(source);
  return {
    loanId: 'app1',
    applicationId: 'app1',
    applicantId: 'u1',
    status,
    principal: 950,
    totalRepayable: s.totalRepayable,
    totalPaid: s.totalPaid,
    remainingBalance: s.remainingBalance,
    fortnightlyPayment: SCHEDULE.fortnightlyPayment,
    installments: s.installments.map((i) => ({
      installmentNumber: i.installmentNumber,
      dueDate: i.dueDate,
      amount: i.amount,
      status: i.status === 'paid' ? 'paid' : 'scheduled',
    })),
    mandateId: 'epc_1',
    beneficiaryId: 'b',
    timeline: {} as Loan['timeline'],
  };
}

const OUT = process.env.PDF_OUT;
function keep(name: string, pdf: Buffer) {
  if (!OUT) return;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), pdf);
}

function expectPdf(pdf: Buffer) {
  expect(pdf.length).toBeGreaterThan(1500);
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
}

describe('loan statement PDF', () => {
  it('renders a loan settled early with the settlement working and fee breakdown', async () => {
    const summary = deriveLoanSummary(SETTLED_EARLY);
    expect(summary.settledEarly).toBe(true);
    const pdf = await renderLoanStatement({
      loan: loanRecord(SETTLED_EARLY, 'closed_repaid'),
      summary,
      applicationFee: 50,
      applicantName: 'Aroha Ngata',
      referenceNumber: 'TP-2026-0001',
      generatedAt: new Date('2026-10-01T00:00:00Z'),
    });
    expectPdf(pdf);
    keep('statement-settled-early.pdf', pdf);
  });

  it('renders a loan in arrears with late fees, the default fee and overdue interest', async () => {
    const summary = deriveLoanSummary(IN_ARREARS);
    expect(summary.ledger.feesCharged).toBe(35);
    const pdf = await renderLoanStatement({
      loan: loanRecord(IN_ARREARS, 'delinquent'),
      summary,
      applicationFee: 50,
      applicantName: 'Aroha Ngata',
      referenceNumber: 'TP-2026-0002',
      generatedAt: new Date('2026-10-01T00:00:00Z'),
    });
    expectPdf(pdf);
    keep('statement-in-arrears.pdf', pdf);
  });

  it('renders an on-time loan with no charges', async () => {
    const pdf = await renderLoanStatement({
      loan: loanRecord(ON_TIME, 'closed_repaid'),
      summary: deriveLoanSummary(ON_TIME),
      applicationFee: 50,
      applicantName: 'Aroha Ngata',
      referenceNumber: 'TP-2026-0003',
      generatedAt: new Date('2026-10-01T00:00:00Z'),
    });
    expectPdf(pdf);
    keep('statement-on-time.pdf', pdf);
  });
});

describe('closure letter PDF', () => {
  const closedAt = '2026-09-28T03:00:00.000Z';

  it('states the early settlement, the interest not charged and the fee', async () => {
    const pdf = await renderClosureLetter({
      loan: loanRecord(SETTLED_EARLY, 'closed_repaid'),
      summary: deriveLoanSummary(SETTLED_EARLY),
      applicantName: 'Aroha Ngata',
      referenceNumber: 'TP-2026-0001',
      closedAt,
      generatedAt: new Date('2026-10-01T00:00:00Z'),
    });
    expectPdf(pdf);
    keep('closure-settled-early.pdf', pdf);
  });

  it('does not thank a late payer for paying on time', async () => {
    const paidLate = app({
      scheduledPayments: payments(4),
      feeAssessments: [
        { id: 'late:2', type: 'late_payment', amountCents: 1000, installmentNumber: 2, reason: '', assessedAt: ts('2026-09-25T00:00:00Z') },
      ],
    });
    const pdf = await renderClosureLetter({
      loan: loanRecord(paidLate, 'closed_repaid'),
      summary: deriveLoanSummary(paidLate),
      applicantName: 'Aroha Ngata',
      referenceNumber: 'TP-2026-0002',
      closedAt,
      generatedAt: new Date('2026-10-01T00:00:00Z'),
    });
    expectPdf(pdf);
    keep('closure-paid-late.pdf', pdf);
  });

  it('renders the on-time letter', async () => {
    const pdf = await renderClosureLetter({
      loan: loanRecord(ON_TIME, 'closed_repaid'),
      summary: deriveLoanSummary(ON_TIME),
      applicantName: 'Aroha Ngata',
      referenceNumber: 'TP-2026-0003',
      closedAt,
      generatedAt: new Date('2026-10-01T00:00:00Z'),
    });
    expectPdf(pdf);
    keep('closure-on-time.pdf', pdf);
  });
});
