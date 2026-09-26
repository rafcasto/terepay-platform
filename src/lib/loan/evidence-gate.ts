/**
 * Evidence gate for the credit / affordability assessment.
 *
 * A lender must not start the affordability wizard (or run the AI credit
 * assessment) until the applicant's income evidence has been reviewed:
 *
 *   • every document uploaded to this application has been accepted or
 *     rejected — nothing may still be "pending"; and
 *   • accepted bank statements AND accepted payslips are on file.
 *
 * Returning customers do not have to re-send everything. If this application
 * was lodged within {@link REPEAT_CUSTOMER_EVIDENCE_REUSE_MONTHS} of a previous
 * loan that was actually paid out, the accepted statements / payslips from that
 * loan satisfy the gate and are handed to the AI assessment in place of (or in
 * addition to) fresh uploads.
 *
 * `evaluateEvidenceGate` is pure so the review page, the wizard page and the
 * API routes all reach the same verdict from the same inputs.
 */

import type { Firestore } from 'firebase-admin/firestore';
import type { ApplicationDocument, DocumentType, LoanApplication } from '@/types/application';
import { REPEAT_CUSTOMER_EVIDENCE_REUSE_MONTHS, evidenceAge } from './evidence-reuse';

export { REPEAT_CUSTOMER_EVIDENCE_REUSE_MONTHS };

/** Document types the assessment cannot proceed without. */
export const REQUIRED_EVIDENCE_TYPES: readonly DocumentType[] = ['bank_statement', 'payslip'];

const EVIDENCE_LABEL: Record<string, string> = {
  bank_statement: 'Bank statements',
  payslip: 'Payslips',
};

/** Statuses that mean money actually went out on a previous application. */
const PAID_OUT_STATUSES = new Set<string>(['disbursed', 'active', 'closed_repaid']);

type TsLike = { _seconds?: number; seconds?: number; toDate?: () => Date } | string | Date | null | undefined;

function tsToDate(ts: TsLike): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return Number.isNaN(ts.getTime()) ? null : ts;
  if (typeof ts === 'string') {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof ts.toDate === 'function') return ts.toDate();
  const s = ts._seconds ?? ts.seconds;
  return typeof s === 'number' ? new Date(s * 1000) : null;
}

export interface ReusedEvidence {
  type: DocumentType;
  label: string;
  documentId: string;
  fileName: string;
  /** Application the document was accepted on. */
  fromApplicationId: string;
  fromReference: string;
  /** When that loan was paid out (or, failing that, submitted). */
  loanDate: Date;
}

export interface EvidenceGateResult {
  /** True when the assessment may proceed. */
  ok: boolean;
  /** Documents on this application still awaiting accept / reject. */
  pendingCount: number;
  /** Required evidence types satisfied neither here nor by a reusable previous loan. */
  missing: DocumentType[];
  /** Previous-loan documents that satisfy (or supplement) this application's evidence. */
  reused: ReusedEvidence[];
  /** Whether the repeat-customer window applies to this application at all. */
  repeatWithinWindow: boolean;
  /** The previous loan the window was measured against, when there is one. */
  previousLoan?: { applicationId: string; reference: string; date: Date; monthsAgo: number };
  /** Plain-language reasons the gate is closed (empty when `ok`). */
  reasons: string[];
}

/** The date this application should be measured from: submission, else creation, else now. */
function applicationDate(app: LoanApplication, now: Date): Date {
  return (
    tsToDate(app.submittedAt as TsLike) ??
    tsToDate(app.timeline?.submittedAt as TsLike) ??
    tsToDate(app.timeline?.createdAt as TsLike) ??
    now
  );
}

/** The date a previous loan counts from: disbursement, else approval, else submission. */
function loanDate(app: LoanApplication): Date | null {
  return (
    tsToDate(app.timeline?.disbursedAt as TsLike) ??
    tsToDate(app.timeline?.approvedAt as TsLike) ??
    tsToDate(app.timeline?.submittedAt as TsLike) ??
    tsToDate(app.timeline?.createdAt as TsLike)
  );
}

export function evaluateEvidenceGate(
  app: LoanApplication,
  previousApps: readonly LoanApplication[],
  now: Date = new Date(),
): EvidenceGateResult {
  const docs = app.documents ?? [];
  const pendingCount = docs.filter((d) => d.status === 'pending').length;
  const acceptedHere = new Set(docs.filter((d) => d.status === 'accepted').map((d) => d.type));

  // --- Repeat-customer window ------------------------------------------------
  const thisDate = applicationDate(app, now);
  const paidOut = previousApps
    .filter((p) => p.applicationId !== app.applicationId && PAID_OUT_STATUSES.has(p.status))
    .map((p) => ({ app: p, date: loanDate(p) }))
    .filter((x): x is { app: LoanApplication; date: Date } => x.date !== null && x.date.getTime() <= thisDate.getTime())
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const latest = paidOut[0];
  const monthsAgo = latest ? evidenceAge(latest.date, thisDate).months : Infinity;
  const repeatWithinWindow = !!latest && monthsAgo < REPEAT_CUSTOMER_EVIDENCE_REUSE_MONTHS;
  const previousLoan = latest
    ? {
        applicationId: latest.app.applicationId,
        reference: latest.app.referenceNumber ?? latest.app.applicationId,
        date: latest.date,
        monthsAgo,
      }
    : undefined;

  // Only loans inside the window may lend their evidence.
  const reusableLoans = repeatWithinWindow
    ? paidOut.filter((x) => evidenceAge(x.date, thisDate).months < REPEAT_CUSTOMER_EVIDENCE_REUSE_MONTHS)
    : [];

  const reused: ReusedEvidence[] = [];
  const missing: DocumentType[] = [];

  for (const type of REQUIRED_EVIDENCE_TYPES) {
    if (acceptedHere.has(type)) continue;
    let found = false;
    for (const { app: prev, date } of reusableLoans) {
      const accepted = (prev.documents ?? []).filter((d) => d.type === type && d.status === 'accepted');
      if (accepted.length === 0) continue;
      found = true;
      for (const d of accepted) {
        reused.push({
          type,
          label: EVIDENCE_LABEL[type] ?? type,
          documentId: d.documentId,
          fileName: d.fileName,
          fromApplicationId: prev.applicationId,
          fromReference: prev.referenceNumber ?? prev.applicationId,
          loanDate: date,
        });
      }
      break; // most recent qualifying loan wins
    }
    if (!found) missing.push(type);
  }

  const reasons: string[] = [];
  if (pendingCount > 0) {
    reasons.push(
      `${pendingCount} uploaded document${pendingCount === 1 ? '' : 's'} still need${pendingCount === 1 ? 's' : ''} to be accepted or rejected`,
    );
  }
  for (const type of missing) {
    const label = EVIDENCE_LABEL[type] ?? type;
    reasons.push(
      previousLoan && !repeatWithinWindow
        ? `${label}: none accepted on this application, and the last loan (${previousLoan.reference}) is more than ${REPEAT_CUSTOMER_EVIDENCE_REUSE_MONTHS} months old so its evidence cannot be reused`
        : `${label}: none accepted on this application`,
    );
  }

  return {
    ok: reasons.length === 0,
    pendingCount,
    missing,
    reused,
    repeatWithinWindow,
    previousLoan,
    reasons,
  };
}

/**
 * Every other non-draft application by the same customer (online uid and/or
 * offline customer id), most recent first. Shared by the review page, the
 * wizard page and the assessment API routes so they see the same history.
 */
export async function loadPreviousApplications(db: Firestore, app: LoanApplication): Promise<LoanApplication[]> {
  const seen = new Set<string>([app.applicationId]);
  const queries = [];
  if (app.applicantId) {
    queries.push(db.collection('loanApplications').where('applicantId', '==', app.applicantId).get());
  }
  if (app.offlineCustomerId) {
    queries.push(db.collection('loanApplications').where('offlineCustomerId', '==', app.offlineCustomerId).get());
  }
  const out: LoanApplication[] = [];
  const results = await Promise.all(queries);
  for (const qs of results) {
    qs.forEach((doc) => {
      if (seen.has(doc.id)) return;
      seen.add(doc.id);
      const data = { ...(doc.data() as LoanApplication), applicationId: doc.id };
      if (data.status === 'draft') return;
      out.push(data);
    });
  }
  const sortKey = (a: LoanApplication) =>
    tsToDate((a.timeline?.submittedAt ?? a.timeline?.createdAt) as TsLike)?.getTime() ?? 0;
  out.sort((a, b) => sortKey(b) - sortKey(a));
  return out;
}

/** Reused documents grouped by the application they live on — the shape the AI document resolver takes. */
export function reuseSources(gate: EvidenceGateResult): { applicationId: string; documents: ApplicationDocument[] }[] {
  const byApp = new Map<string, ApplicationDocument[]>();
  for (const r of gate.reused) {
    const list = byApp.get(r.fromApplicationId) ?? [];
    list.push({
      documentId: r.documentId,
      type: r.type,
      fileName: r.fileName,
      status: 'accepted',
    } as ApplicationDocument);
    byApp.set(r.fromApplicationId, list);
  }
  return [...byApp.entries()].map(([applicationId, documents]) => ({ applicationId, documents }));
}
