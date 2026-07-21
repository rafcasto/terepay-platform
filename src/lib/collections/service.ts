import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { auditLog } from '@/lib/utils/audit';
import { configForDate, type InterestOnFeesPolicy } from './config';
import { runEngine } from './engine';
import { mapToEngineInput, type LoanSnapshot } from './mapping';
import { buildStatementContent, renderStatementMarkdown, type StatementContent } from './statement';
import { buildStatementDocx, statementFileName } from './statement-docx';
import { toStoredBreakdown, toStoredFees, toStoredLedger } from './serialize';
import type { LoanCommunication, PolicySetting, StatementRecord } from './records';

/**
 * Collections service — orchestrates the pure engine with persistence, the
 * interest-on-fees policy (CC-1), the human sign-off gate (CC-2), identity
 * integrity (CC-3) and communications logging on the loan application.
 *
 * All money math lives in the pure engine; this layer only reads/writes and
 * enforces gates. Generation is automatic; ISSUANCE requires approval.
 */

const POLICY_DOC = 'policySettings/interest_on_fees';
const STATEMENTS = 'collectionStatements';
const APPLICATIONS = 'loanApplications';

// --- CC-1 interest-on-fees policy ------------------------------------------

/** Read the effective policy; defaults to the config seed (OFF) if unset. */
export async function getInterestOnFeesPolicy(): Promise<InterestOnFeesPolicy> {
  const snap = await adminDb.doc(POLICY_DOC).get();
  const value = snap.exists ? (snap.data()?.interestOnFeesPolicy as InterestOnFeesPolicy | undefined) : undefined;
  return value ?? configForDate(new Date().toISOString().slice(0, 10)).interestOnFeesPolicyDefault;
}

/** Set the policy (CC-1). Caller must already have enforced the compliance role. */
export async function setInterestOnFeesPolicy(
  policy: InterestOnFeesPolicy,
  actor: string,
  reason: string,
  effectiveDate: string,
): Promise<void> {
  const before = await getInterestOnFeesPolicy();
  const setting: PolicySetting = {
    interestOnFeesPolicy: policy,
    setBy: actor,
    setAt: new Date().toISOString(),
    effectiveDate,
    reason,
  };
  await adminDb.doc(POLICY_DOC).set(setting, { merge: true });
  await auditLog({
    userId: actor,
    action: 'collections_policy_changed',
    targetType: 'policy',
    targetId: 'interest_on_fees',
    outcome: 'success',
    changes: { before, after: policy, reason },
  });
}

// --- CC-3 identity integrity ------------------------------------------------

/**
 * Verify the statement will carry the borrower's OWN identifiers — never a
 * placeholder or carried-over ID (CC-3). Fail closed if anything is missing.
 */
function verifyIdentity(snap: LoanSnapshot): string[] {
  const reasons: string[] = [];
  if (!snap.clientId || /^TERE0?XX$/i.test(snap.clientId)) reasons.push('Client ID missing or placeholder (CC-3).');
  if (!snap.loanId || /^TPN0?4?X+$/i.test(snap.loanId)) reasons.push('Loan ID missing or placeholder (CC-3).');
  if (!snap.borrowerName) reasons.push('Borrower name missing (CC-3).');
  return reasons;
}

// --- Statement generation (draft) — CC-2 gate: generation ≠ issuance --------

export interface GenerateStatementResult {
  statementId: string;
  content: StatementContent;
  markdown: string;
  docx: Buffer;
  fileName: string;
  blockIssuance: boolean;
  blockReasons: string[];
  warnings: string[];
}

/**
 * Generate a DRAFT statement from a loan snapshot: run the engine, freeze the
 * ledger snapshot into a StatementRecord (status 'draft'), and return the
 * rendered artefacts for review. Does NOT issue anything (CC-2).
 */
export async function generateStatement(params: {
  snapshot: LoanSnapshot;
  applicationId: string;
  statementDate: string;
  actor: string;
}): Promise<GenerateStatementResult> {
  const { snapshot, applicationId, statementDate, actor } = params;

  const policy = await getInterestOnFeesPolicy();
  const mapped = mapToEngineInput(snapshot, statementDate, policy);
  const identityReasons = verifyIdentity(snapshot);
  const blockReasons = [...mapped.blockReasons, ...identityReasons];

  const result = runEngine(mapped.input);
  const content = buildStatementContent(result, {
    loanId: snapshot.loanId ?? '',
    clientId: snapshot.clientId ?? '',
    fullName: snapshot.borrowerName ?? '',
  });
  const markdown = renderStatementMarkdown(content);
  const docx = await buildStatementDocx(content);
  const fileName = statementFileName(content);
  const statementId = randomUUID();

  const record: StatementRecord = {
    statementId,
    loanId: snapshot.loanId ?? '',
    clientId: snapshot.clientId ?? '',
    statementDate,
    policy,
    breakdown: toStoredBreakdown(result.breakdown),
    ledgerSnapshot: toStoredLedger(result),
    feeSnapshot: toStoredFees(result),
    configEffectiveDate: configForDate(mapped.input.loanAccessDate).effectiveDate,
    generatedBy: actor,
    generatedAt: new Date().toISOString(),
    status: 'draft',
  };

  await adminDb.collection(STATEMENTS).doc(statementId).set({
    ...record,
    applicationId,
    principalSourcing: mapped.principalSourcing,
    blockIssuance: blockReasons.length > 0,
    blockReasons,
    warnings: mapped.warnings,
    createdAt: FieldValue.serverTimestamp(),
  });

  await auditLog({
    userId: actor,
    action: 'collections_statement_generated',
    targetType: 'statement',
    targetId: statementId,
    outcome: 'success',
    changes: {
      applicationId,
      policy,
      totalOwing: record.breakdown.totalOwing,
      principalSourcing: mapped.principalSourcing,
      blockIssuance: blockReasons.length > 0,
    },
  });

  return {
    statementId,
    content,
    markdown,
    docx,
    fileName,
    blockIssuance: blockReasons.length > 0,
    blockReasons,
    warnings: mapped.warnings,
  };
}

// --- CC-2 human sign-off gate ----------------------------------------------

/**
 * Approve a draft statement for issuance (CC-2). Refuses while any blockReason
 * is unresolved (fail closed). Caller must have enforced the approver role.
 */
export async function approveStatement(params: { statementId: string; actor: string }): Promise<void> {
  const { statementId, actor } = params;
  const ref = adminDb.collection(STATEMENTS).doc(statementId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Statement not found');
  const data = snap.data()!;

  if (data.blockIssuance) {
    await auditLog({
      userId: actor,
      action: 'collections_statement_approval_blocked',
      targetType: 'statement',
      targetId: statementId,
      outcome: 'failure',
      changes: { blockReasons: data.blockReasons },
    });
    throw new Error(`Cannot approve — unresolved blockers: ${(data.blockReasons ?? []).join('; ')}`);
  }

  await ref.update({
    status: 'approved',
    approvedBy: actor,
    approvedAt: new Date().toISOString(),
  });
  await auditLog({
    userId: actor,
    action: 'collections_statement_approved',
    targetType: 'statement',
    targetId: statementId,
    outcome: 'success',
    changes: { totalOwing: data.breakdown?.totalOwing },
  });
}

// --- Issuance + communications logging on the loan application --------------

/**
 * Issue an approved statement to the borrower and RECORD THE COMMUNICATION on
 * the loan application (append-only `communications` array). Refuses to issue
 * anything that is not approved (CC-2).
 */
export async function issueStatement(params: {
  statementId: string;
  actor: string;
  channel: LoanCommunication['channel'];
  documentUri?: string;
}): Promise<LoanCommunication> {
  const { statementId, actor, channel, documentUri } = params;
  const ref = adminDb.collection(STATEMENTS).doc(statementId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Statement not found');
  const data = snap.data()!;

  if (data.status !== 'approved') {
    await auditLog({
      userId: actor,
      action: 'collections_statement_issue_blocked',
      targetType: 'statement',
      targetId: statementId,
      outcome: 'failure',
      changes: { status: data.status },
    });
    throw new Error('Cannot issue a statement that has not been approved (CC-2).');
  }

  const communication: LoanCommunication = {
    communicationId: randomUUID(),
    type: 'statement',
    channel,
    statementId,
    subject: `Accrued interest & outstanding balance statement — ${data.statementDate}`,
    sentBy: actor,
    sentAt: new Date().toISOString(),
    totalCommunicated: data.breakdown?.totalOwing,
    ...(documentUri ? { documentUri } : {}),
  };

  // Append-only communications log on the loan application.
  await adminDb
    .collection(APPLICATIONS)
    .doc(data.applicationId)
    .update({
      communications: FieldValue.arrayUnion(communication),
      'timeline.updatedAt': FieldValue.serverTimestamp(),
    });

  await ref.update({ status: 'issued', issuedAt: new Date().toISOString(), issuedBy: actor });

  await auditLog({
    userId: actor,
    action: 'collections_statement_issued',
    targetType: 'statement',
    targetId: statementId,
    outcome: 'success',
    changes: { applicationId: data.applicationId, communicationId: communication.communicationId, channel },
  });

  return communication;
}
