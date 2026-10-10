import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { isValidAssessmentModel } from '@/lib/assessment/model';
import type { CreditAssessmentModelSettings } from '@/types/admin';

const COLLECTION = 'systemConfig';
const DOC_ID = 'creditAssessment';

/**
 * Read the admin's model choice for AI credit assessments.
 *
 * `model: null` means "no choice made" — the job is queued without a model and
 * the worker uses its own default (`OLLAMA_MODEL`).
 *
 * Read errors are **not** swallowed: an assessment must never silently run on
 * a different model from the one the administrator selected, so the caller
 * fails instead of falling back.
 */
export async function getCreditAssessmentModelSettings(): Promise<CreditAssessmentModelSettings> {
  const snap = await adminDb.collection(COLLECTION).doc(DOC_ID).get();
  if (!snap.exists) return { model: null };
  const data = snap.data()!;
  return {
    model: isValidAssessmentModel(data.model) ? data.model : null,
    updatedAt: data.updatedAt,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
  };
}

/** Persist the admin's choice. Call from admin API routes only, after validation. */
export async function setCreditAssessmentModel(model: string | null, updatedBy: string): Promise<void> {
  await adminDb
    .collection(COLLECTION)
    .doc(DOC_ID)
    .set({ model, updatedAt: FieldValue.serverTimestamp(), updatedBy }, { merge: true });
}
