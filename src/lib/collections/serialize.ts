import type { ComponentBreakdown, EngineResult } from './types';
import type { StoredBreakdown, StoredFee, StoredLedgerEntry } from './records';

/**
 * Pure serializers: Decimal → string for durable, precision-safe storage.
 * Never persist money as a binary float. Frozen into the StatementRecord so a
 * statement is exactly reproducible from its snapshot (CC-6, AC-10).
 */

export function toStoredLedger(result: EngineResult): StoredLedgerEntry[] {
  return result.ledger.map((e) => ({
    entryDate: e.entryDate,
    type: e.type,
    amount: e.amount.toFixed(),
    runningBalance: e.runningBalance.toFixed(),
    description: e.description,
    ...(e.sourceRef ? { sourceRef: e.sourceRef } : {}),
  }));
}

export function toStoredFees(result: EngineResult): StoredFee[] {
  return result.fees.map((f) => ({
    feeType: f.feeType,
    amount: f.amount.toFixed(),
    assessedDate: f.assessedDate,
    triggerRef: f.triggerRef,
    interestBearing: f.interestBearing,
  }));
}

export function toStoredBreakdown(b: ComponentBreakdown): StoredBreakdown {
  return {
    principalOutstanding: b.principalOutstanding.toFixed(2),
    interestAccruedToDate: b.interestAccruedToDate.toFixed(2),
    totalInterestAccrued: b.totalInterestAccrued.toFixed(2),
    lateFeeCount: b.lateFeeCount,
    lateFeesTotal: b.lateFeesTotal.toFixed(2),
    defaultFeeTriggered: b.defaultFeeTriggered,
    defaultFee: b.defaultFee.toFixed(2),
    earlyRepaymentFee: b.earlyRepaymentFee.toFixed(2),
    interestOnFees: b.interestOnFees.toFixed(2),
    paymentsCredited: b.paymentsCredited.toFixed(2),
    totalOwing: b.totalOwing.toFixed(2),
  };
}
