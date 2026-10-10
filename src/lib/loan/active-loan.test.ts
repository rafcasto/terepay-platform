import { describe, expect, it } from 'vitest';
import { deriveLoanSummary, type LoanSummarySource } from './active-loan';
import { buildSchedule } from './repayment';
import type { ScheduledPayment } from '@/types/application';

const START = '2026-08-24';
const SCHEDULE = buildSchedule({ principal: 1000, startDate: START });

function payments(paidCount: number): ScheduledPayment[] {
  return SCHEDULE.rows.map((r) => ({
    installmentNumber: r.installmentNumber,
    dueDate: r.dueDate,
    amountCents: Math.round(r.amount * 100),
    status: r.installmentNumber <= paidCount ? ('success' as const) : ('scheduled' as const),
    retryCount: 0,
  }));
}

function loan(extra: Partial<LoanSummarySource> = {}): LoanSummarySource {
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
    },
    scheduledPayments: payments(1),
    ...extra,
  } as LoanSummarySource;
}

const ts = (iso: string) => ({ toDate: () => new Date(iso) });

describe('deriveLoanSummary — on-schedule repayments', () => {
  it('counts collected instalments at face value and itemises principal + interest', () => {
    const s = deriveLoanSummary(loan());
    expect(s.settledEarly).toBe(false);
    expect(s.totalPaid).toBe(SCHEDULE.rows[0].amount);
    expect(s.remainingBalance).toBe(
      Math.round((SCHEDULE.totalRepayable - SCHEDULE.rows[0].amount) * 100) / 100,
    );
    expect(s.totalOwing).toBe(s.remainingBalance);
    expect(s.ledger.principal).toBe(1000);
    expect(s.ledger.scheduledInterest).toBe(SCHEDULE.totalInterest);
    expect(s.ledger.interestRebate).toBe(0);
    expect(s.ledger.feesCharged).toBe(0);
    expect(s.ledger.totalCost).toBe(SCHEDULE.totalRepayable);
    expect(s.ledger.lines.map((l) => l.kind)).toEqual(['principal', 'scheduled_interest']);
  });

  it('adds late fees, the default fee and overdue interest to what is owing', () => {
    const s = deriveLoanSummary(
      loan({
        feeAssessments: [
          { id: 'late:2', type: 'late_payment', amountCents: 1000, installmentNumber: 2, reason: '', assessedAt: ts('2026-09-26T00:00:00Z') },
          { id: 'default', type: 'payment_default', amountCents: 2500, reason: '', assessedAt: ts('2026-09-30T00:00:00Z') },
        ],
        arrears: { accruedInterestCents: 312, dailyRate: 0.49 / 365, earliestMissDate: '2026-09-21', lastAssessedDate: '2026-09-30' },
      } as unknown as Partial<LoanSummarySource>),
    );
    expect(s.arrearsChargesOutstanding).toBe(38.12);
    expect(s.totalOwing).toBe(Math.round((s.remainingBalance + 38.12) * 100) / 100);
    expect(s.ledger.lateFees).toBe(10);
    expect(s.ledger.lateFeeCount).toBe(1);
    expect(s.ledger.defaultFee).toBe(25);
    expect(s.ledger.overdueInterest).toBe(3.12);
    expect(s.ledger.feesCharged).toBe(35);
    expect(s.ledger.interestCharged).toBe(Math.round((SCHEDULE.totalInterest + 3.12) * 100) / 100);
    expect(s.ledger.outstanding).toBe(s.totalOwing);
    expect(s.ledger.lines.map((l) => l.kind)).toEqual([
      'principal',
      'scheduled_interest',
      'late_fee',
      'default_fee',
      'overdue_interest',
    ]);
    // Arrears charges never inflate the instalment balance the engine accrues on.
    expect(s.remainingBalance).toBe(
      Math.round((SCHEDULE.totalRepayable - SCHEDULE.rows[0].amount) * 100) / 100,
    );
  });
});

describe('deriveLoanSummary — early settlement', () => {
  // Scenario 2 from docs/EARLY_REPAYMENT_INTEREST_REBATE.md: one instalment
  // paid, settled on the second due date for $796.16.
  const clearedFace = SCHEDULE.rows.slice(1).reduce((a, r) => a + r.amount, 0);
  const settled = () =>
    loan({
      scheduledPayments: payments(4),
      earlyRepayment: {
        provider: 'qippay_payby',
        status: 'paid',
        paymentId: 'pmU_1',
        hostedUrl: '',
        beneficiaryId: 'b',
        paidAt: ts('2026-09-21T03:00:00Z'),
        quote: {
          currency: 'NZD',
          outstandingBalanceCents: Math.round(clearedFace * 100),
          unearnedInterestRebateCents: Math.round((clearedFace - 771.16) * 100),
          netOutstandingCents: 77116,
          prepaymentFeeCents: 2500,
          totalPayoffCents: 79616,
          installmentsCleared: [2, 3, 4],
          rebateBreakdown: {
            method: 'actuarial_reducing_balance',
            totalInterest: SCHEDULE.totalInterest,
            totalInstalments: 4,
            remainingInstalments: 3,
            grossFutureInterest: 0,
            termDays: 56,
            elapsedDays: 28,
            remainingDays: 28,
            loanStartDate: START,
            finalDueDate: SCHEDULE.rows[3].dueDate,
            settlementDate: '2026-09-21',
            outstandingPrincipal: 756.93,
            accruedInterest: 14.23,
            accrualFromDate: SCHEDULE.rows[0].dueDate,
            accrualDays: 14,
          },
        },
      },
    } as unknown as Partial<LoanSummarySource>);

  it('reports the amount actually paid, not the face value of the cleared instalments', () => {
    const s = deriveLoanSummary(settled());
    expect(s.settledEarly).toBe(true);
    expect(s.isFullyPaid).toBe(true);
    expect(s.remainingBalance).toBe(0);
    expect(s.totalOwing).toBe(0);
    expect(s.nextPaymentDate).toBeNull();
    // Instalment 1 at face value + the $796.16 payoff.
    expect(s.totalPaid).toBe(Math.round((SCHEDULE.rows[0].amount + 796.16) * 100) / 100);
    expect(s.totalPaid).toBeLessThan(SCHEDULE.totalRepayable + 25);
  });

  it('exposes the settlement working from the stored quote', () => {
    const s = deriveLoanSummary(settled());
    expect(s.settlement).toMatchObject({
      settledAt: '2026-09-21T03:00:00.000Z',
      settlementDate: '2026-09-21',
      amountPaid: 796.16,
      instalmentsCleared: [2, 3, 4],
      outstandingPrincipal: 756.93,
      accruedInterest: 14.23,
      accrualDays: 14,
      fee: 25,
      arrearsCharges: 0,
    });
    expect(s.settlement?.instalmentsReplaced).toBe(Math.round(clearedFace * 100) / 100);
  });

  it('ledgers the interest rebate as a credit and the fee as a charge, and ties out', () => {
    const s = deriveLoanSummary(settled());
    const rebate = Math.round((clearedFace - 771.16) * 100) / 100;
    expect(s.ledger.interestRebate).toBe(rebate);
    expect(s.ledger.earlyRepaymentFee).toBe(25);
    expect(s.ledger.interestCharged).toBe(Math.round((SCHEDULE.totalInterest - rebate) * 100) / 100);
    expect(s.ledger.feesCharged).toBe(25);
    expect(s.ledger.totalCost).toBe(s.totalPaid);
    expect(s.ledger.outstanding).toBe(0);
    const kinds = s.ledger.lines.map((l) => l.kind);
    expect(kinds).toEqual(['principal', 'scheduled_interest', 'interest_rebate', 'early_repayment_fee']);
    expect(s.ledger.lines.find((l) => l.kind === 'interest_rebate')?.amount).toBe(-rebate);
  });

  it('only counts arrears charges that were collected in the payoff', () => {
    const base = settled();
    const withFees = {
      ...base,
      feeAssessments: [
        { id: 'late:2', type: 'late_payment', amountCents: 1000, installmentNumber: 2, reason: '', assessedAt: ts('2026-09-26T00:00:00Z') },
      ],
    } as unknown as LoanSummarySource;

    // Payoff initiated before charges were quoted — the fee was never collected.
    const legacy = deriveLoanSummary(withFees);
    expect(legacy.ledger.lateFees).toBe(0);
    expect(legacy.arrearsChargesOutstanding).toBe(0);

    // Payoff that included the $10 late fee.
    const quoted = {
      ...withFees,
      earlyRepayment: {
        ...withFees.earlyRepayment,
        quote: {
          ...withFees.earlyRepayment!.quote,
          arrearsChargesCents: 1000,
          totalPayoffCents: 80616,
        },
      },
    } as unknown as LoanSummarySource;
    const s = deriveLoanSummary(quoted);
    expect(s.ledger.lateFees).toBe(10);
    expect(s.settlement?.arrearsCharges).toBe(10);
    expect(s.totalPaid).toBe(Math.round((SCHEDULE.rows[0].amount + 806.16) * 100) / 100);
    expect(s.ledger.totalCost).toBe(s.totalPaid);
  });
});
