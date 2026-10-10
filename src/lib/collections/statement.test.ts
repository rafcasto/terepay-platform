import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { runEngine } from './engine';
import { mapToEngineInput, type LoanSnapshot } from './mapping';
import { buildStatementContent, renderStatementMarkdown } from './statement';
import { buildStatementDocx, statementFileName } from './statement-docx';
import type { EngineInput } from './types';

const FRANCIS_SNAP: LoanSnapshot = {
  loanId: 'TPN04191',
  clientId: 'TERE022',
  borrowerName: 'Francis Brian Dimatulac',
  approvedAmount: 1100.02,
  totalRepayment: 1151.72,
  loanAccessDate: '2026-05-05',
  schedule: [
    { sequence: 1, dueDate: '2026-05-19', instalmentAmount: 287.93 },
    { sequence: 2, dueDate: '2026-06-02', instalmentAmount: 287.93 },
    { sequence: 3, dueDate: '2026-06-16', instalmentAmount: 287.93 },
    { sequence: 4, dueDate: '2026-06-30', instalmentAmount: 287.93 },
  ],
  payments: [],
};

function francisResult(policy: 'OFF' | 'ON' = 'OFF') {
  const mapped = mapToEngineInput(FRANCIS_SNAP, '2026-07-21', policy);
  return { mapped, result: runEngine(mapped.input) };
}

describe('mapping — CC-5 principal sourcing / fail closed', () => {
  it('uses the disclosed approvedAmount as the principal without blocking', () => {
    const { mapped } = francisResult();
    expect(mapped.principalSourcing).toBe('disclosed');
    expect(mapped.blockIssuance).toBe(false);
    expect((mapped.input.initialUnpaidBalance as Decimal).toNumber()).toBe(1100.02);
  });

  it('approximates and BLOCKS issuance when only totalRepayment is known', () => {
    const snap: LoanSnapshot = { ...FRANCIS_SNAP, approvedAmount: undefined };
    const mapped = mapToEngineInput(snap, '2026-07-21', 'OFF');
    expect(mapped.principalSourcing).toBe('approximated');
    expect(mapped.blockIssuance).toBe(true);
    expect(mapped.blockReasons.join(' ')).toMatch(/approximation/i);
  });

  it('blocks when Client ID / Loan ID are missing (CC-3)', () => {
    const snap: LoanSnapshot = { ...FRANCIS_SNAP, clientId: undefined, loanId: undefined };
    const mapped = mapToEngineInput(snap, '2026-07-21', 'OFF');
    expect(mapped.blockIssuance).toBe(true);
  });

  it('throws (fail closed) when there is no schedule', () => {
    const bad = { ...FRANCIS_SNAP, schedule: [] } as unknown as LoanSnapshot;
    expect(() => mapToEngineInput(bad, '2026-07-21', 'OFF')).toThrow();
  });
});

describe('statement content — SG-2 / SG-3 / SG-5', () => {
  it('carries the borrower own IDs and honest labels', () => {
    const { result } = francisResult();
    const c = buildStatementContent(result, { loanId: 'TPN04191', clientId: 'TERE022', fullName: 'Francis Brian Dimatulac' });
    expect(c.loanId).toBe('TPN04191');
    expect(c.clientId).toBe('TERE022');
    expect(c.fullNameCaps).toBe('FRANCIS BRIAN DIMATULAC');
    expect(c.firstName).toBe('Francis');
    expect(c.principalOutstanding).toBe('$1,100.02');
    expect(c.dateIssued).toBe('21 July 2026');
  });

  it('OMITS the interest-on-fees line when policy is OFF (SG-3)', () => {
    const { result } = francisResult('OFF');
    const c = buildStatementContent(result, { loanId: 'TPN04191', clientId: 'TERE022', fullName: 'Francis Brian Dimatulac' });
    expect(c.interestOnFeesLine).toBeNull();
    const md = renderStatementMarkdown(c);
    expect(md).not.toMatch(/interest on fees/i);
    expect(md).toContain('TERE022'); // payment reference
    expect(md).toContain('02-0108-0900334-000'); // SG-5 account
    expect(md).toContain('Kenneth Gustilo'); // SG-5 sign-off
  });

  it('INCLUDES the interest-on-fees line when policy is ON', () => {
    const { result } = francisResult('ON');
    const c = buildStatementContent(result, { loanId: 'TPN04191', clientId: 'TERE022', fullName: 'Francis Brian Dimatulac' });
    expect(c.interestOnFeesLine).not.toBeNull();
    expect(renderStatementMarkdown(c)).toMatch(/interest on fees/i);
  });
});

describe('docx render — SG-4', () => {
  it('produces a non-empty .docx buffer with the correct filename', async () => {
    const { result } = francisResult();
    const c = buildStatementContent(result, { loanId: 'TPN04191', clientId: 'TERE022', fullName: 'Francis Brian Dimatulac' });
    const buf = await buildStatementDocx(c);
    expect(buf.length).toBeGreaterThan(1000);
    // .docx is a zip — starts with the PK signature.
    expect(buf.subarray(0, 2).toString('latin1')).toBe('PK');
    expect(statementFileName(c)).toBe('TerePay_Accrual_Francis_Dimatulac_TERE022_21Jul2026.docx');
  });
});

// Guard: EngineInput type stays structurally what the mapper emits.
const _typecheck: EngineInput = francisResult().mapped.input;
void _typecheck;
