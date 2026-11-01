import { describe, expect, it } from 'vitest';
import { buildManualSchedule } from './manual-payments';
import { buildSchedule } from './repayment';

const START = '2026-08-24';

describe('buildManualSchedule', () => {
  it('mirrors buildSchedule row for row on the $1,000 golden case', () => {
    const plan = buildManualSchedule({ principal: 1000, startDate: START });
    const ref = buildSchedule({ principal: 1000, startDate: START });

    expect(plan.rows).toHaveLength(ref.rows.length);
    plan.rows.forEach((row, i) => {
      const r = ref.rows[i];
      expect(row.installmentNumber).toBe(r.installmentNumber);
      expect(row.dueDate).toBe(r.dueDate);
      expect(row.amountCents).toBe(Math.round(r.amount * 100));
      expect(row.interestCents).toBe(Math.round(r.interest * 100));
      expect(row.principalCents).toBe(Math.round(r.principal * 100));
      expect(row.closingBalanceCents).toBe(Math.round(r.closingBalance * 100));
    });
    expect(plan.totalCents).toBe(Math.round(ref.totalRepayable * 100));
    expect(plan.totalInterestCents).toBe(Math.round(ref.totalInterest * 100));
    expect(plan.driftCents).toBe(0);
    expect(plan.rows[plan.rows.length - 1].closingBalanceCents).toBe(0);
  });

  it('produces pending ScheduledPayments the disbursement path can store', () => {
    const plan = buildManualSchedule({ principal: 1000, startDate: START });
    expect(plan.payments).toHaveLength(4);
    plan.payments.forEach((p, i) => {
      expect(p).toEqual({
        installmentNumber: i + 1,
        dueDate: plan.rows[i].dueDate,
        amountCents: plan.rows[i].amountCents,
        status: 'pending',
        retryCount: 0,
      });
    });
  });

  it('trues the final instalment up to the total agreed at approval', () => {
    const base = buildManualSchedule({ principal: 1000, startDate: START });
    const agreed = base.totalCents / 100 + 0.07; // 7c drift from an older rate config
    const plan = buildManualSchedule({ principal: 1000, startDate: START, totalRepayment: agreed });

    const last = plan.rows[plan.rows.length - 1];
    const baseLast = base.rows[base.rows.length - 1];
    expect(plan.driftCents).toBe(7);
    expect(last.amountCents).toBe(baseLast.amountCents + 7);
    // Principal is fixed by the approved amount — the true-up lands on interest.
    expect(last.principalCents).toBe(baseLast.principalCents);
    expect(last.interestCents).toBe(baseLast.interestCents + 7);
    expect(plan.totalCents).toBe(Math.round(agreed * 100));
    expect(plan.payments[3].amountCents).toBe(last.amountCents);
    // Earlier instalments are untouched.
    plan.rows.slice(0, -1).forEach((r, i) => expect(r.amountCents).toBe(base.rows[i].amountCents));
  });

  it('ignores an agreed total that would wipe out the final instalment', () => {
    const base = buildManualSchedule({ principal: 1000, startDate: START });
    const plan = buildManualSchedule({ principal: 1000, startDate: START, totalRepayment: 1 });
    expect(plan.driftCents).toBe(0);
    expect(plan.totalCents).toBe(base.totalCents);
  });

  it('returns an empty plan for a non-positive principal', () => {
    const plan = buildManualSchedule({ principal: 0, startDate: START });
    expect(plan.rows).toEqual([]);
    expect(plan.payments).toEqual([]);
    expect(plan.totalCents).toBe(0);
  });
});
