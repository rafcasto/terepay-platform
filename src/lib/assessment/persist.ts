import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import type { CreditAssessmentJob, CreditAssessmentRecord, CreditAssessmentSummary } from '@/types/credit-assessment';

const COLLECTION = 'creditAssessments';

export function summariseJob(job: CreditAssessmentJob): CreditAssessmentSummary {
  const r = job.result ?? undefined;
  return {
    assessmentId: job.id,
    status: job.status,
    requestedAt: job.createdAt,
    ...(job.endedAt ? { completedAt: job.endedAt } : {}),
    ...(job.payload ? { assessed_amount: job.payload.application.loan_amount } : {}),
    ...(r
      ? {
          risk_rating: r.risk_rating,
          recommendation: r.recommendation,
          confidence_score: r.confidence_score,
          escalation: r.escalation,
          expense_risk_tier: r.expense_risk_tier,
          behaviour_score: r.behaviour_score,
          parser_mode: r.parser_mode,
        }
      : {}),
    ...(job.error ? { error: job.error } : {}),
  };
}

/**
 * Write the audit record the moment a job is queued, so the inputs the agent
 * was given are on file even if the lender never comes back for the result.
 */
export async function createAssessmentRecord(
  job: CreditAssessmentJob,
  requester: { uid: string; name: string },
): Promise<CreditAssessmentRecord> {
  const appRef = adminDb.collection('loanApplications').doc(job.applicationId);
  const existing = await adminDb.collection(COLLECTION).where('applicationId', '==', job.applicationId).get();
  const record: CreditAssessmentRecord = {
    assessmentId: job.id,
    applicationId: job.applicationId,
    version: existing.size + 1,
    status: 'queued',
    requestedBy: requester.uid,
    requestedByName: requester.name,
    requestedAt: job.createdAt,
    inputs: job.payload!,
  };
  const batch = adminDb.batch();
  batch.set(adminDb.collection(COLLECTION).doc(job.id), { ...record, createdAt: FieldValue.serverTimestamp() });
  batch.update(appRef, {
    creditAssessment: summariseJob(job),
    'timeline.updatedAt': FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return record;
}

/**
 * Copy a finished job (done / failed / cancelled) from Redis into Firestore.
 * Idempotent: the first poll that sees the terminal state persists it, later
 * polls find the record already terminal and do nothing.
 */
export async function finaliseAssessmentRecord(job: CreditAssessmentJob): Promise<void> {
  if (job.status === 'queued' || job.status === 'running') return;
  const ref = adminDb.collection(COLLECTION).doc(job.id);
  const snap = await ref.get();
  const current = snap.data() as CreditAssessmentRecord | undefined;
  if (!current || current.applicationId !== job.applicationId) return;
  if (current.status === 'done' || current.status === 'failed' || current.status === 'cancelled') return;

  const update: Record<string, unknown> = {
    status: job.status,
    completedAt: job.endedAt ?? Date.now(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (job.startedAt) update.startedAt = job.startedAt;
  if (job.worker) update.worker = job.worker;
  if (job.log) update.log = job.log.slice(-12_000);
  if (job.result) update.result = job.result;
  if (job.error) update.error = job.error;

  const batch = adminDb.batch();
  batch.update(ref, update);
  batch.update(adminDb.collection('loanApplications').doc(job.applicationId), {
    creditAssessment: summariseJob(job),
    'timeline.updatedAt': FieldValue.serverTimestamp(),
  });
  await batch.commit();
}

export async function getAssessmentRecord(id: string): Promise<CreditAssessmentRecord | null> {
  const snap = await adminDb.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  const data = { ...snap.data() } as Record<string, unknown>;
  delete data.createdAt; // Firestore sentinels are not JSON-serialisable and not part of the record type
  delete data.updatedAt;
  return data as unknown as CreditAssessmentRecord;
}

/** Summary of a persisted record — same shape the application carries. */
export function summariseRecord(record: CreditAssessmentRecord): CreditAssessmentSummary {
  return summariseJob({
    id: record.assessmentId,
    type: 'assess_application',
    applicationId: record.applicationId,
    status: record.status,
    payload: record.inputs,
    createdAt: record.requestedAt,
    createdBy: record.requestedByName,
    startedAt: record.startedAt,
    endedAt: record.completedAt,
    worker: record.worker,
    result: record.result ?? null,
    error: record.error,
  });
}
