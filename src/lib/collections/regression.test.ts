import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { runEngine } from './engine';
import type { EngineInput } from './types';

/**
 * Regression: the shipped statement for Francis Brian Dimatulac (TERE022,
 * TPN04191, issued 21 Jul 2026) used the PROHIBITED per-instalment-from-due-date
 * method (Collection Agent/CLAUDE.md Principle 2/3). It reported:
 *
 *   Shipped (WRONG):
 *     "Shortfall on instalments 1–4" ...... $1,151.72   ← instalment total as principal
 *     Accrued interest .................... $68.91      ← incl. $3.97 interest ON FEES
 *     Late payment fees (4 × $10) ......... $40.00
 *     Payment default fee ................. $25.00
 *     TOTAL ............................... $1,285.63
 *
 * This test pins the CORRECTED ledger behaviour (policy OFF, interest on the
 * running principal-plus-interest balance from the Loan Access Date).
 */
const FRANCIS: EngineInput = {
  loanId: 'TPN04191',
  clientId: 'TERE022',
  // 4 × $287.93 = $1,151.72 total repayable; principal = total / 1.047.
  initialUnpaidBalance: new Decimal('287.93').times(4).div('1.047').toDecimalPlaces(2),
  loanAccessDate: '2026-05-05', // 14 days before the first instalment
  schedule: [
    { sequence: 1, dueDate: '2026-05-19', instalmentAmount: new Decimal('287.93') },
    { sequence: 2, dueDate: '2026-06-02', instalmentAmount: new Decimal('287.93') },
    { sequence: 3, dueDate: '2026-06-16', instalmentAmount: new Decimal('287.93') },
    { sequence: 4, dueDate: '2026-06-30', instalmentAmount: new Decimal('287.93') },
  ],
  payments: [],
  statementDate: '2026-07-21',
  interestOnFeesPolicy: 'OFF',
};

describe('Regression — Francis TERE022 corrected vs shipped statement', () => {
  const r = runEngine(FRANCIS);

  it('labels principal as the true advance (~$1,100), NOT the instalment total $1,151.72', () => {
    expect(r.breakdown.principalOutstanding.toNumber()).toBeCloseTo(1100.02, 2);
    expect(r.breakdown.principalOutstanding.toNumber()).not.toBe(1151.72);
  });

  it('charges interest on the running daily balance (materially more than the shipped $68.91)', () => {
    // Per-instalment-from-due-date under-charged interest; the running ledger is higher.
    expect(r.breakdown.interestAccruedToDate.toNumber()).toBeGreaterThan(90);
  });

  it('carries exactly 4 late fees and 1 default fee', () => {
    expect(r.breakdown.lateFeeCount).toBe(4);
    expect(r.breakdown.lateFeesTotal.toNumber()).toBe(40);
    expect(r.breakdown.defaultFeeTriggered).toBe(true);
    expect(r.breakdown.defaultFee.toNumber()).toBe(25);
  });

  it('charges NO interest on fees (policy OFF) — the shipped $3.97 was non-compliant', () => {
    expect(r.breakdown.interestOnFees.toNumber()).toBe(0);
  });

  it('total = principal + interest + late fees + default fee, to the cent', () => {
    const expected = r.breakdown.principalOutstanding
      .plus(r.breakdown.interestAccruedToDate)
      .plus(r.breakdown.lateFeesTotal)
      .plus(r.breakdown.defaultFee);
    expect(r.breakdown.totalOwing.toNumber()).toBeCloseTo(expected.toNumber(), 2);
  });

  it('opens the ledger with the principal on the Loan Access Date and uses the borrower\'s own IDs', () => {
    expect(r.ledger[0].type).toBe('principal_open');
    expect(r.ledger[0].entryDate).toBe('2026-05-05');
    expect(FRANCIS.clientId).toBe('TERE022');
    expect(FRANCIS.loanId).toBe('TPN04191');
  });
});
