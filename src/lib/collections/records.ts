import type Decimal from 'decimal.js';
import type { InterestOnFeesPolicy } from './config';
import type { AssessedFee, ComponentBreakdown, LedgerEntry } from './types';

/**
 * Persistence-facing data-model types for the collections module (DM-6..DM-9).
 *
 * These describe the SHAPE the service layer writes to Firestore. The pure
 * engine (engine.ts) never touches these — it returns plain results that the
 * service layer maps onto these records, then persists + audit-logs. Money is
 * stored as string-encoded decimals (never binary floats) to preserve precision.
 */

/** DM-6 — compliance-controlled interest-on-fees policy. Default OFF (signed off 2026-07). */
export interface PolicySetting {
  interestOnFeesPolicy: InterestOnFeesPolicy;
  setBy: string; // authorised compliance user id (CC-1)
  setAt: string; // ISO timestamp
  effectiveDate: string; // YYYY-MM-DD
  reason: string;
}

/** A ledger entry as stored (Decimal → string). Append-only (DM-4, DM-9). */
export interface StoredLedgerEntry extends Omit<LedgerEntry, 'amount' | 'runningBalance'> {
  amount: string;
  runningBalance: string;
}

/** A fee as stored (DM-5). `interestBearing` frozen from policy at assessment. */
export interface StoredFee extends Omit<AssessedFee, 'amount'> {
  amount: string;
}

/** The component breakdown as stored — Decimal fields become strings; number/boolean unchanged. */
export type StoredBreakdown = {
  [K in keyof ComponentBreakdown]: ComponentBreakdown[K] extends Decimal ? string : ComponentBreakdown[K];
};

/**
 * DM-7 — a generated statement, with a FROZEN ledger snapshot so it is exactly
 * reproducible (CC-6, AC-10). Issuance is gated on human approval (CC-2).
 */
export interface StatementRecord {
  statementId: string;
  loanId: string;
  clientId: string;
  statementDate: string; // YYYY-MM-DD
  policy: InterestOnFeesPolicy;
  breakdown: StoredBreakdown;
  ledgerSnapshot: StoredLedgerEntry[];
  feeSnapshot: StoredFee[];
  /** The exact config version (effectiveDate) used, for reproducibility. */
  configEffectiveDate: string;
  documentUri?: string;
  generatedBy: string;
  generatedAt: string; // ISO
  /** Populated only once an authorised user approves issuance (CC-2). */
  approvedBy?: string;
  approvedAt?: string;
  status: 'draft' | 'approved' | 'issued';
}

/**
 * A borrower communication, recorded against the loan application.
 *
 * Per the collection requirement: EVERY communication issued to a borrower
 * (statement, reminder, demand, hardship correspondence) is appended to the
 * loan application's `communications` array — append-only, never edited — so the
 * full contact history is auditable in one place (CCCFA record-keeping, DM-8).
 */
export interface LoanCommunication {
  communicationId: string;
  type: 'statement' | 'reminder' | 'demand' | 'hardship' | 'arrangement' | 'other';
  channel: 'email' | 'sms' | 'letter' | 'portal';
  /** Links back to the StatementRecord when the communication is a statement. */
  statementId?: string;
  subject: string;
  /** Where the rendered artefact lives (e.g. Google Drive / storage URI). */
  documentUri?: string;
  sentBy: string; // actor id
  sentAt: string; // ISO
  /** Frozen total communicated to the borrower, for dispute reconstruction. */
  totalCommunicated?: string;
}
