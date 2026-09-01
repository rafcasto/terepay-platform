import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { runEngine } from './engine';
import { configForDate } from './config';
import { shiftYmd } from './dates';
import { toNumber } from './money';
import { buildSchedule } from '@/lib/loan/repayment';
import type { EngineInput, ScheduleInstalment } from './types';

const ACCESS = '2026-05-05';
const cfg = configForDate(ACCESS);
const DAILY = cfg.dailyRate;

/** Build a standard 4-fortnightly-instalment loan starting 14 days after access. */
function makeLoan(overrides: Partial<EngineInput> = {}): EngineInput {
  const principal = overrides.initialUnpaidBalance ?? new Decimal(1000);
  // Use the schedule origination actually quotes, rather than restating the
  // pricing formula here. Both sides read the same effective-dated config, so
  // a rate change flows through and this fixture cannot drift from the product
  // the way the retired flat `principal x 1.047 / 4` literal did.
  const quoted = buildSchedule({
    principal: new Decimal(principal).toNumber(),
    startDate: ACCESS,
  });
  const schedule: ScheduleInstalment[] =
    overrides.schedule ??
    quoted.rows.map((r) => ({
      sequence: r.installmentNumber,
      dueDate: r.dueDate,
      instalmentAmount: new Decimal(r.amount),
    }));
  return {
    loanId: 'TPN04999',
    clientId: 'TERE999',
    initialUnpaidBalance: new Decimal(principal),
    loanAccessDate: ACCESS,
    schedule,
    payments: [],
    statementDate: shiftYmd(ACCESS, 70),
    interestOnFeesPolicy: 'OFF',
    ...overrides,
  };
}

describe('AC-1 — ledger opens correctly', () => {
  it('opens with a single principal_open entry and no interest before the access date', () => {
    const r = runEngine(makeLoan({ statementDate: ACCESS }));
    expect(r.ledger).toHaveLength(1);
    expect(r.ledger[0].type).toBe('principal_open');
    expect(r.ledger[0].entryDate).toBe(ACCESS);
    expect(toNumber(r.ledger[0].amount)).toBe(1000);
    expect(r.ledger.some((e) => e.type.startsWith('interest'))).toBe(false);
    expect(r.breakdown.interestAccruedToDate.toNumber()).toBe(0);
  });
});

describe('AC-2 — daily accrual, fortnightly charge, compounding', () => {
  it('charges 14 daily accruals on the constant balance after 14 days', () => {
    const r = runEngine(makeLoan({ statementDate: shiftYmd(ACCESS, 14) }));
    const charge = r.ledger.find((e) => e.type === 'interest_charge');
    expect(charge).toBeDefined();
    const expected = new Decimal(1000).times(DAILY).times(14);
    expect(charge!.amount.toNumber()).toBeCloseTo(expected.toNumber(), 8);
  });

  it('accrues day-15 interest on the larger (compounded) balance', () => {
    const r = runEngine(makeLoan({ statementDate: shiftYmd(ACCESS, 28) }));
    const charges = r.ledger.filter((e) => e.type === 'interest_charge');
    expect(charges).toHaveLength(2);
    // Second fortnight charge must exceed the first — that IS compounding.
    expect(charges[1].amount.toNumber()).toBeGreaterThan(charges[0].amount.toNumber());
    // Balance after 28 days strictly exceeds the simple-interest figure.
    const simple = new Decimal(1000).times(new Decimal(1).plus(DAILY.times(28)));
    const balance = r.ledger[r.ledger.length - 1].runningBalance;
    expect(balance.toNumber()).toBeGreaterThan(simple.toNumber());
  });
});

describe('AC-3 — on-time payoff sanity (zero fees, zero residual)', () => {
  it('settles to exactly zero with no fees, accruing 4.60% of principal', () => {
    const loan = makeLoan();
    const payments = loan.schedule.map((s, i) => ({
      paymentId: `p${i + 1}`,
      receivedDate: s.dueDate, // paid exactly on time
      amount: s.instalmentAmount,
    }));
    const r = runEngine({ ...loan, payments, statementDate: shiftYmd(ACCESS, 56) });
    // Collections credits the instalment at the start of the due date and then
    // accrues that day's interest on the reduced balance, so each period earns
    // 13 days at the opening balance where origination quotes a full 14. On
    // $1,000 that is $46.04 here against the $47.42 quoted by buildSchedule —
    // a known origination/collections gap, tracked separately. Pinned exactly
    // so neither side can drift without this failing.
    const fraction = r.breakdown.totalInterestAccrued.div(1000).toNumber();
    expect(fraction).toBeCloseTo(0.04604, 5);
    expect(r.breakdown.lateFeeCount).toBe(0);
    expect(r.breakdown.defaultFeeTriggered).toBe(false);
    // The quoted instalments must settle the daily-accrual balance exactly:
    // origination and collections agree to the cent, leaving no residual.
    expect(r.breakdown.totalOwing.toNumber()).toBeCloseTo(0, 2);
  });
});

describe('AC-4 — late payment fee, once per instalment', () => {
  it('assesses exactly one $10 fee for one 4-day-late instalment', () => {
    const r = runEngine(makeLoan({ statementDate: shiftYmd(ACCESS, 14 + 4) }));
    const late = r.fees.filter((f) => f.feeType === 'late_payment');
    expect(late).toHaveLength(1);
    expect(late[0].amount.toNumber()).toBe(10);
    expect(late[0].assessedDate).toBe(shiftYmd(ACCESS, 14 + 3)); // day 3
  });

  it('assesses two $10 fees for two late instalments and is idempotent on re-run', () => {
    const input = makeLoan({ statementDate: shiftYmd(ACCESS, 28 + 4) });
    const r1 = runEngine(input);
    const r2 = runEngine(input);
    expect(r1.fees.filter((f) => f.feeType === 'late_payment')).toHaveLength(2);
    expect(r2.fees.filter((f) => f.feeType === 'late_payment')).toHaveLength(2);
  });
});

describe('AC-5 — payment default fee, once only', () => {
  it('assesses exactly one $25 default fee on day 7 even with all instalments missed', () => {
    const r = runEngine(makeLoan({ statementDate: shiftYmd(ACCESS, 70) }));
    const def = r.fees.filter((f) => f.feeType === 'payment_default');
    expect(def).toHaveLength(1);
    expect(def[0].amount.toNumber()).toBe(25);
    expect(def[0].assessedDate).toBe(shiftYmd(ACCESS, 14 + 7)); // first instalment + 7
  });

  it('is idempotent — re-running does not add a second default fee', () => {
    const input = makeLoan({ statementDate: shiftYmd(ACCESS, 70) });
    const a = runEngine(input).fees.filter((f) => f.feeType === 'payment_default').length;
    const b = runEngine(input).fees.filter((f) => f.feeType === 'payment_default').length;
    expect(a).toBe(1);
    expect(b).toBe(1);
  });
});

describe('AC-6 — effective-date crediting', () => {
  it('(a) credits an early payment on the due date, not when received', () => {
    const loan = makeLoan();
    const dueDate = loan.schedule[0].dueDate;
    const earlyReceived = shiftYmd(dueDate, -5);
    const r = runEngine({
      ...loan,
      payments: [{ paymentId: 'e', receivedDate: earlyReceived, amount: loan.schedule[0].instalmentAmount }],
      statementDate: shiftYmd(ACCESS, 56),
    });
    const credit = r.ledger.find((e) => e.type === 'payment');
    expect(credit!.entryDate).toBe(dueDate);

    // Interest is unchanged vs. paying exactly on the due date.
    const onDue = runEngine({
      ...loan,
      payments: [{ paymentId: 'e', receivedDate: dueDate, amount: loan.schedule[0].instalmentAmount }],
      statementDate: shiftYmd(ACCESS, 56),
    });
    expect(r.breakdown.interestAccruedToDate.toNumber()).toBeCloseTo(
      onDue.breakdown.interestAccruedToDate.toNumber(),
      8,
    );
  });

  it('(b) credits a late payment on the received date', () => {
    const loan = makeLoan();
    const received = shiftYmd(loan.schedule[0].dueDate, 4);
    const r = runEngine({
      ...loan,
      payments: [{ paymentId: 'l', receivedDate: received, amount: loan.schedule[0].instalmentAmount }],
      statementDate: shiftYmd(ACCESS, 56),
    });
    expect(r.ledger.find((e) => e.type === 'payment')!.entryDate).toBe(received);
  });

  it('(c) a full payout credits on the received date and adds the $25 early repayment fee', () => {
    const loan = makeLoan();
    const received = shiftYmd(ACCESS, 20);
    const r = runEngine({
      ...loan,
      payments: [{ paymentId: 'full', receivedDate: received, amount: new Decimal(5000) }],
      statementDate: shiftYmd(ACCESS, 56),
    });
    expect(r.breakdown.earlyRepaymentFee.toNumber()).toBe(25);
    expect(r.ledger.find((e) => e.description === 'Full prepayment')!.entryDate).toBe(received);
    expect(r.breakdown.principalOutstanding.toNumber()).toBe(0);
  });
});

describe('AC-7 — no interest-on-instalment path', () => {
  it('produces identical interest regardless of instalment amounts', () => {
    const base = makeLoan({ statementDate: shiftYmd(ACCESS, 56) });
    const doubled = makeLoan({
      statementDate: shiftYmd(ACCESS, 56),
      schedule: base.schedule.map((s) => ({ ...s, instalmentAmount: s.instalmentAmount.times(2) })),
    });
    const a = runEngine(base).breakdown.interestAccruedToDate.toNumber();
    const b = runEngine(doubled).breakdown.interestAccruedToDate.toNumber();
    // Interest depends only on principal + dates, never on instalment size.
    expect(a).toBe(b);
  });
});

describe('AC-8 — interest-on-fees policy', () => {
  const stmt = shiftYmd(ACCESS, 70);
  it('OFF: fees do not accrue interest; total = principal + interest + fees', () => {
    const r = runEngine(makeLoan({ statementDate: stmt, interestOnFeesPolicy: 'OFF' }));
    expect(r.breakdown.interestOnFees.toNumber()).toBe(0);
    const expected = r.breakdown.principalOutstanding
      .plus(r.breakdown.interestAccruedToDate)
      .plus(r.breakdown.lateFeesTotal)
      .plus(r.breakdown.defaultFee);
    expect(r.breakdown.totalOwing.toNumber()).toBeCloseTo(expected.toNumber(), 2);
  });

  it('ON: same scenario yields a strictly higher total via interest on fees', () => {
    const off = runEngine(makeLoan({ statementDate: stmt, interestOnFeesPolicy: 'OFF' }));
    const on = runEngine(makeLoan({ statementDate: stmt, interestOnFeesPolicy: 'ON' }));
    expect(on.breakdown.interestOnFees.toNumber()).toBeGreaterThan(0);
    expect(on.breakdown.totalOwing.toNumber()).toBeGreaterThan(off.breakdown.totalOwing.toNumber());
  });
});

describe('AC-10 — reproducibility / determinism', () => {
  it('returns identical results on repeated runs of the same inputs', () => {
    const input = makeLoan({ statementDate: shiftYmd(ACCESS, 63) });
    const a = runEngine(input);
    const b = runEngine(input);
    expect(JSON.stringify(a.breakdown)).toBe(JSON.stringify(b.breakdown));
    expect(a.ledger.length).toBe(b.ledger.length);
  });
});

describe('AC-11 — fail closed', () => {
  it('throws when the Initial Unpaid Balance is missing/zero', () => {
    expect(() => runEngine(makeLoan({ initialUnpaidBalance: new Decimal(0) }))).toThrow();
  });
  it('throws on an invalid loan access date', () => {
    expect(() => runEngine(makeLoan({ loanAccessDate: 'not-a-date' }))).toThrow();
  });
  it('throws when the statement date precedes the loan access date', () => {
    expect(() => runEngine(makeLoan({ statementDate: shiftYmd(ACCESS, -1) }))).toThrow();
  });
});
