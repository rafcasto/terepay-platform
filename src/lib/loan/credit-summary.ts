import { FieldValue, type Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { decrypt, encrypt } from '@/lib/encryption/crypto';
import type { CreditSummaryInput } from '@/lib/validation/schemas';

/**
 * Lender-entered summary of a borrower's Centrix comprehensive credit report.
 *
 * Stored on the customer profile next to the uploaded report files
 * (`users/{customerId}/lenderReports`) so it is reused across the customer's
 * future applications, at `users/{customerId}/creditSummary/centrix`.
 *
 * The figures are credit information about an individual, so they are held as
 * one AES-256-GCM encrypted JSON payload (`data` 🔒). Only who/when metadata is
 * plaintext.
 */

/** The figures the lender keys in. */
export type CreditSummaryFigures = CreditSummaryInput;

export interface StoredCreditSummary {
  /** 🔒 Encrypted JSON of {@link CreditSummaryFigures}. */
  data: string;
  updatedBy: string;
  updatedByName: string;
  updatedFromApplicationId: string;
  updatedAt: Timestamp;
}

export interface CreditSummary extends CreditSummaryFigures {
  updatedByName: string;
  updatedAt: Date | null;
}

const summaryRef = (customerId: string) =>
  adminDb.collection('users').doc(customerId).collection('creditSummary').doc('centrix');

export async function saveCreditSummary(params: {
  customerId: string;
  applicationId: string;
  figures: CreditSummaryFigures;
  lenderId: string;
  lenderName: string;
}): Promise<void> {
  const { customerId, applicationId, figures, lenderId, lenderName } = params;
  await summaryRef(customerId).set({
    data: encrypt(JSON.stringify(figures)),
    updatedBy: lenderId,
    updatedByName: lenderName,
    updatedFromApplicationId: applicationId,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/** Returns null when nothing has been entered (or the payload can't be read). */
export async function loadCreditSummary(customerId: string): Promise<CreditSummary | null> {
  const snap = await summaryRef(customerId).get();
  if (!snap.exists) return null;
  const stored = snap.data() as StoredCreditSummary;
  try {
    const figures = JSON.parse(decrypt(stored.data)) as CreditSummaryFigures;
    return {
      ...figures,
      updatedByName: stored.updatedByName,
      updatedAt: stored.updatedAt?.toDate?.() ?? null,
    };
  } catch {
    console.error('[credit-summary] stored summary could not be decrypted');
    return null;
  }
}
