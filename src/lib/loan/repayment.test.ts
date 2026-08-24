import { describe, expect, it } from 'vitest';
import {
  buildSchedule,
  fortnightlyPayment,
  payoffBasis,
  pmt,
  RATE_MODEL,
} from './repayment';

const START = '2026-08-24';

describe('pmt', () => {
  it('matches Excel PMT(0.49/365*14, 4, -1000)', () => {
    const periodic = 0.49 / 365 * 14;
    expect(pmt(periodic, 4, 1000).toNumber()).toBeCloseTo(261.8559257, 6);
  });

  it('falls back to straight-line at a zero rate', () => {
    expect(pmt(0, 4, 1000).toNumber()).toBe(250);
  });
});

describe('fortnightlyPayment', () => {
  it('is $261.86 on a $1,000 loan', () => {
    expect(fortnightlyPayment(1000, START)).toBe(261.86);
  });

  it('is zero for a non-positive principal', () => {
    expect(fortnightlyPayment(0, START)).toBe(0);
  });
});

describe('buildSchedule — $1,000 golden case from the pricing spreadsheet', () => {
  const s = buildSchedule({ principal: 1000, startDate: START });

  it('stamps the rate model and headline figures', () => {
    expect(s.rateModel).toBe(RATE_MODEL);
    expect(s.annualRate).toBe(0.49);
    expect(s.fortnightlyPayment).toBe(261.86);
    expect(s.totalInterest).toBe(47.42);
    expect(s.totalRepayable).toBe(1047.42);
  });

  it('reproduces the amortisation table cent for cent', () => {
    expect(
      s.rows.map((r) => [r.interest, r.principal, r.amount, r.closingBalance]),
    ).toEqual([
      [18.79, 243.07, 261.86, 756.93],
      [14.23, 247.63, 261.86, 509.30],
      [9.57, 252.29, 261.86, 257.01],
      [4.83, 257.01, 261.84, 0],
    ]);
  });

  it('falls due every 14 days from the anchor date', () => {
    expect(s.rows.map((r) => r.dueDate)).toEqual([
      '2026-09-07', '2026-09-21', '2026-10-05', '2026-10-19',
    ]);
    expect(s.rows.every((r) => r.daysInPeriod === 14)).toBe(true);
  });

  it('trues up the final instalment rather than the earlier ones', () => {
    expect(s.rows.slice(0, 3).every((r) => r.amount === s.fortnightlyPayment)).toBe(true);
    expect(s.rows[3].amount).toBe(261.84);
  });
});

describe('buildSchedule — invariants across the product range', () => {
  for (const principal of [200, 500, 1000, 1500, 2000]) {
    it(`amortises $${principal} to exactly zero`, () => {
      const s = buildSchedule({ principal, startDate: START });
      expect(s.rows.at(-1)!.closingBalance).toBe(0);
    });

    it(`$${principal}: instalments sum to totalRepayable = principal + interest`, () => {
      const s = buildSchedule({ principal, startDate: START });
      const summed = s.rows.reduce((a, r) => a + r.amount, 0);
      expect(Math.round(summed * 100) / 100).toBe(s.totalRepayable);
      expect(s.totalRepayable).toBe(
        Math.round((principal + s.totalInterest) * 100) / 100,
      );
    });

    it(`$${principal}:each row's principal + interest equals its amount`, () => {
      const s = buildSchedule({ principal, startDate: START });
      for (const r of s.rows) {
        expect(Math.round((r.principal + r.interest) * 100) / 100).toBe(r.amount);
        expect(Math.round((r.openingBalance - r.principal) * 100) / 100).toBe(
          r.closingBalance,
        );
      }
    });
  }

  it('returns an empty schedule for a zero principal', () => {
    const s = buildSchedule({ principal: 0, startDate: START });
    expect(s.rows).toEqual([]);
    expect(s.totalRepayable).toBe(0);
  });

  it('effective interest is ~4.7% of principal, the documented sanity check', () => {
    const s = buildSchedule({ principal: 1000, startDate: START });
    expect(s.totalInterest / 1000).toBeCloseTo(0.047, 3);
  });
});

describe('payoffBasis — actuarial reducing-balance settlement', () => {
  const s = buildSchedule({ principal: 1000, startDate: START });

  it('Scenario 1: settling on the first due date, nothing paid', () => {
    const b = payoffBasis({
      schedule: s,
      instalmentsPaid: 0,
      settlementDate: '2026-09-07',
    });
    expect(b.outstandingPrincipal).toBe(1000);
    expect(b.accrualDays).toBe(14);
    expect(b.accruedInterest).toBe(18.79);
    // $1,000 + $18.79 accrued + $25 fee = $1,043.79 (spreadsheet Scenario 1)
    expect(
      Math.round((b.outstandingPrincipal + b.accruedInterest + 25) * 100) / 100,
    ).toBe(1043.79);
    // Avoids periods 2-4 interest: 14.23 + 9.57 + 4.83 = 28.63
    expect(b.interestSaved).toBe(28.63);
  });

  it('Scenario 2: settling on the second due date, one instalment paid', () => {
    const b = payoffBasis({
      schedule: s,
      instalmentsPaid: 1,
      settlementDate: '2026-09-21',
    });
    expect(b.outstandingPrincipal).toBe(756.93);
    expect(b.accruedInterest).toBe(14.23);
    // Avoids periods 3-4 interest: 9.57 + 4.83 = 14.40
    expect(b.interestSaved).toBe(14.4);
  });

  it('charges no interest when settling on the day of the last charge', () => {
    const b = payoffBasis({
      schedule: s,
      instalmentsPaid: 1,
      settlementDate: '2026-09-07',
    });
    expect(b.accrualDays).toBe(0);
    expect(b.accruedInterest).toBe(0);
  });

  it('settling after the final instalment leaves nothing outstanding', () => {
    const b = payoffBasis({
      schedule: s,
      instalmentsPaid: 4,
      settlementDate: '2026-10-19',
    });
    expect(b.outstandingPrincipal).toBe(0);
    expect(b.accruedInterest).toBe(0);
    expect(b.interestSaved).toBe(0);
  });
});
