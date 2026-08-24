import { describe, expect, it } from 'vitest';
import {
  computeEarlyPayoff,
  INTEREST_REBATE_METHOD,
  LEGACY_INTEREST_REBATE_METHOD,
} from './early-payoff';
import { buildSchedule } from './repayment';
import type { LoanSummarySource } from './active-loan';

const START = '2026-08-24';
const SCHEDULE = buildSchedule({ principal: 1000, startDate: START });

/** A disbursed $1,000 loan with `paidCount` instalments already collected. */
function loan(paidCount: number, amortised: boolean): LoanSummarySource {
  return {
    loanDetails: {
      requestedAmount: 1000,
      currency: 'NZD',
      loanPurpose: 'other',
      purposeDescription: '',
      approvedAmount: 1000,
      applicationFee: 50,
      fortnightlyPayment: amortised ? SCHEDULE.fortnightlyPayment : 261.75,
      totalRepayment: amortised ? SCHEDULE.totalRepayable : 1047,
      ...(amortised ? { rateModel: 'amortised_v1' as const, interestRate: 0.49 } : {}),
    },
    scheduledPayments: SCHEDULE.rows.map((r) => ({
      installmentNumber: r.installmentNumber,
      dueDate: r.dueDate,
      amountCents: Math.round((amortised ? r.amount : 261.75) * 100),
      status: r.installmentNumber <= paidCount ? ('success' as const) : ('scheduled' as const),
      retryCount: 0,
    })),
    timeline: { disbursedAt: { toDate: () => new Date(`${START}T00:00:00.000Z`) } },
  } as unknown as LoanSummarySource;
}

describe('computeEarlyPayoff — amortised loans settle on an actuarial basis', () => {
  it('Scenario 1: settling on the first due date costs $1,043.79', () => {
    const q = computeEarlyPayoff(loan(0, true), { settlementDate: '2026-09-07' })!;
    expect(q.breakdown.method).toBe(INTEREST_REBATE_METHOD);
    expect(q.breakdown.outstandingPrincipal).toBe(1000);
    expect(q.breakdown.accruedInterest).toBe(18.79);
    expect(q.netOutstanding).toBe(1018.79);
    expect(q.prepaymentFee).toBe(25);
    expect(q.totalPayoff).toBe(1043.79);
  });

  it('Scenario 1 saves the borrower $3.63 against running to term', () => {
    const q = computeEarlyPayoff(loan(0, true), { settlementDate: '2026-09-07' })!;
    expect(Math.round((SCHEDULE.totalRepayable - q.totalPayoff) * 100) / 100).toBe(3.63);
  });

  it('Scenario 2: settling on the second due date, one instalment paid', () => {
    const q = computeEarlyPayoff(loan(1, true), { settlementDate: '2026-09-21' })!;
    expect(q.breakdown.outstandingPrincipal).toBe(756.93);
    expect(q.breakdown.accruedInterest).toBe(14.23);
    expect(q.netOutstanding).toBe(771.16);
    expect(q.totalPayoff).toBe(796.16);
  });

  it('charges no interest when settling on the day of the last charge', () => {
    const q = computeEarlyPayoff(loan(1, true), { settlementDate: '2026-09-07' })!;
    expect(q.breakdown.accruedInterest).toBe(0);
    expect(q.netOutstanding).toBe(756.93);
  });

  it('never charges more than the remaining contractual instalments', () => {
    for (const [paid, date] of [
      [0, '2026-09-07'],
      [1, '2026-09-21'],
      [2, '2026-10-05'],
      [3, '2026-10-19'],
    ] as const) {
      const q = computeEarlyPayoff(loan(paid, true), { settlementDate: date })!;
      expect(q.netOutstanding).toBeLessThanOrEqual(q.outstandingBalance + 0.01);
    }
  });

  it('returns null once every instalment has settled', () => {
    expect(computeEarlyPayoff(loan(4, true), { settlementDate: '2026-10-19' })).toBeNull();
  });
});

describe('computeEarlyPayoff — legacy flat-rate loans keep their contracted basis', () => {
  it('uses the straight-line rebate they were sold under', () => {
    const q = computeEarlyPayoff(loan(0, false), { settlementDate: '2026-09-07' })!;
    expect(q.breakdown.method).toBe(LEGACY_INTEREST_REBATE_METHOD);
    // 4 × 261.75 gross, rebate 47 × 42/56 = 35.25, + $25 fee
    expect(q.unearnedInterestRebate).toBe(35.25);
    expect(q.totalPayoff).toBe(1036.75);
  });

  it('does not expose actuarial working for a legacy loan', () => {
    const q = computeEarlyPayoff(loan(0, false), { settlementDate: '2026-09-07' })!;
    expect(q.breakdown.outstandingPrincipal).toBeUndefined();
  });
});
