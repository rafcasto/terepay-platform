import { describe, expect, it } from 'vitest';
import { summariseArrearsCharges } from './arrears-charges';
import type { DerivedInstallment } from './active-loan';
import type { ArrearsState, FeeAssessment } from '@/types/application';
import { isValidYmd, referenceGap } from '@/lib/validation/schemas';

const TODAY = '2026-09-20';

function inst(n: number, dueDate: string, status: DerivedInstallment['status']): DerivedInstallment {
  return { installmentNumber: n, dueDate, amount: 261.86, status };
}

function fee(id: string, type: FeeAssessment['type'], amountCents: number, installmentNumber?: number): FeeAssessment {
  return {
    id,
    type,
    amountCents,
    installmentNumber,
    reason: 'test',
    assessedAt: { toDate: () => new Date('2026-09-15T00:00:00.000Z') } as unknown as FeeAssessment['assessedAt'],
  };
}

describe('summariseArrearsCharges', () => {
  it('reports nothing for a loan that is up to date', () => {
    const s = summariseArrearsCharges({
      installments: [inst(1, '2026-09-10', 'paid'), inst(2, '2026-09-24', 'scheduled')],
      policyApplies: true,
      today: TODAY,
    });
    expect(s.isOverdue).toBe(false);
    expect(s.hasCharges).toBe(false);
    expect(s.totalChargesCents).toBe(0);
    expect(s.daysUntilLateFee).toBeNull();
    expect(s.daysUntilDefaultFee).toBeNull();
  });

  it('predicts the late fee and default fee while inside the grace periods', () => {
    // Due 18 Sep, today 20 Sep → 2 days overdue. Late fee on day 4, default fee on day 8.
    const s = summariseArrearsCharges({
      installments: [inst(1, '2026-09-18', 'overdue')],
      policyApplies: true,
      today: TODAY,
    });
    expect(s.isOverdue).toBe(true);
    expect(s.daysPastDue).toBe(2);
    expect(s.overdueAmountCents).toBe(26186);
    expect(s.daysUntilLateFee).toBe(2);
    expect(s.daysUntilDefaultFee).toBe(6);
    expect(s.hasCharges).toBe(false);
  });

  it('totals late fees, the default fee and accrued interest', () => {
    const arrears: ArrearsState = {
      accruedInterestCents: 1234,
      dailyRate: 0.49 / 365,
      earliestMissDate: '2026-09-05',
      lastAssessedDate: TODAY,
    };
    const s = summariseArrearsCharges({
      installments: [inst(1, '2026-09-05', 'failed'), inst(2, '2026-09-19', 'overdue')],
      feeAssessments: [fee('late:1', 'late_payment', 1000, 1), fee('default', 'payment_default', 2500)],
      arrears,
      policyApplies: true,
      today: TODAY,
    });
    expect(s.daysPastDue).toBe(15);
    expect(s.lateFeeCents).toBe(1000);
    expect(s.lateFeeCount).toBe(1);
    expect(s.defaultFeeCents).toBe(2500);
    expect(s.accruedInterestCents).toBe(1234);
    expect(s.totalChargesCents).toBe(4734);
    expect(s.lines.map((l) => l.label)).toEqual(['Late payment fee — instalment 1', 'Payment default fee']);
    expect(s.lines[0].assessedAt).toBe('2026-09-15T00:00:00.000Z');
    // Default fee already charged; instalment 2 has not had its late fee yet (1 day overdue).
    expect(s.daysUntilDefaultFee).toBeNull();
    expect(s.daysUntilLateFee).toBe(3);
  });

  it('predicts no fees for a loan outside the fee policy', () => {
    const s = summariseArrearsCharges({
      installments: [inst(1, '2026-09-01', 'overdue')],
      policyApplies: false,
      today: TODAY,
    });
    expect(s.isOverdue).toBe(true);
    expect(s.daysUntilLateFee).toBeNull();
    expect(s.daysUntilDefaultFee).toBeNull();
  });
});

describe('referenceGap', () => {
  it('needs a name and a way to reach the reference', () => {
    expect(referenceGap(undefined)?.field).toBe('name');
    expect(referenceGap({ name: '  ' })?.field).toBe('name');
    expect(referenceGap({ name: 'Mele Tau' })?.field).toBe('phone');
    expect(referenceGap({ name: 'Mele Tau', phone: '021 000 0000' })).toBeNull();
    expect(referenceGap({ name: 'Mele Tau', email: 'mele@example.com' })).toBeNull();
  });
});

describe('isValidYmd', () => {
  it('accepts real calendar dates only', () => {
    expect(isValidYmd('2030-01-31')).toBe(true);
    expect(isValidYmd('2030-02-31')).toBe(false);
    expect(isValidYmd('31/01/2030')).toBe(false);
    expect(isValidYmd('')).toBe(false);
  });
});
