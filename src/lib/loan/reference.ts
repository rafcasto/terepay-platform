import type { Firestore } from 'firebase-admin/firestore';

/**
 * Every loan/application reference TerePay issues starts with this prefix
 * (business requirement). Change it here and nowhere else.
 */
export const LOAN_REFERENCE_PREFIX = 'TPN20';

/**
 * Formats a loan reference as `TPN20` + two-digit year + five-digit sequence,
 * e.g. the first loan of 2026 is `TPN202600001`. The year keeps the per-year
 * counter unique across years and the whole value fits Qippay's 12-character
 * `statement_reference` limit. References issued before this scheme
 * (`TP-2026-00001`) are left untouched.
 */
export function formatLoanReference(year: number, sequence: number): string {
  const yy = String(year % 100).padStart(2, '0');
  return `${LOAN_REFERENCE_PREFIX}${yy}${String(sequence).padStart(5, '0')}`;
}

/**
 * Mints the next loan reference for the current year via a transaction on the
 * `counters/applications_{year}` document (same counter the old `TP-` format
 * used, so numbering carries on where it left off).
 */
export async function generateLoanReference(db: Firestore, now: Date = new Date()): Promise<string> {
  const year = now.getFullYear();
  const counterRef = db.collection('counters').doc(`applications_${year}`);
  const sequence = await db.runTransaction(async (tx) => {
    const doc = await tx.get(counterRef);
    const next = (doc.data()?.count ?? 0) + 1;
    tx.set(counterRef, { count: next }, { merge: true });
    return next;
  });
  return formatLoanReference(year, sequence);
}
