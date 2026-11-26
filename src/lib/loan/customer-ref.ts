import { adminDb } from '@/lib/firebase/admin';
import type { LoanApplication } from '@/types/application';

/**
 * The friendly TerePay customer ID (e.g. `TERE001`) to print on bank
 * statements for payments against this loan.
 *
 * Offline customers carry it on the application itself; online applicants are
 * assigned one when they accept their first offer, so it lives on the user
 * document. Falls back to the application reference and finally the document
 * id prefix so a statement line is never blank.
 *
 * Qippay's `statement_reference` is limited to 12 chars — the caller still
 * sanitises, this just picks the most recognisable value.
 */
export async function resolveCustomerStatementReference(
  app: Pick<LoanApplication, 'applicationId' | 'applicantId' | 'offlineCustomerId' | 'referenceNumber'>,
): Promise<string> {
  const customerId = await resolveCustomerId(app);
  if (customerId) return customerId;

  if (app.referenceNumber) return app.referenceNumber;
  return app.applicationId.slice(0, 12);
}

/**
 * The friendly TerePay customer ID (`TERE001`) behind an application, or null
 * when the applicant has not been assigned one yet (online applicants get it
 * when they accept their first offer). Offline applications carry it on the
 * document; online ones keep it on `users/{uid}.customerId`.
 */
export async function resolveCustomerId(
  app: Pick<LoanApplication, 'applicationId' | 'applicantId' | 'offlineCustomerId'>,
): Promise<string | null> {
  if (app.offlineCustomerId) return app.offlineCustomerId;

  if (app.applicantId) {
    try {
      const snap = await adminDb.collection('users').doc(app.applicantId).get();
      const customerId = snap.data()?.customerId;
      if (typeof customerId === 'string' && customerId.trim()) return customerId.trim();
    } catch (err) {
      console.error('[customer-ref] failed to load applicant customerId', app.applicationId, err);
    }
  }

  return null;
}
