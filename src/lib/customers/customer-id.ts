import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { AppError } from '@/lib/utils/api-error';
import { normaliseCustomerId } from './customer-id-format';

export { CUSTOMER_ID_RE, normaliseCustomerId } from './customer-id-format';

export interface RenameCustomerIdResult {
  previousCustomerId: string;
  customerId: string;
  /** `offlineCustomers/{id}` document moved to the new ID. */
  offlineRecordMoved: boolean;
  /** `users` documents whose `customerId` was repointed. */
  usersUpdated: number;
  /** `loanApplications.offlineCustomerId` values repointed. */
  applicationsUpdated: number;
}

/**
 * Changes a customer's friendly ID everywhere it is stored, atomically:
 *
 * - `offlineCustomers/{old}` is re-created as `offlineCustomers/{new}` (the ID
 *   is the document key) with `previousCustomerIds` recording the history;
 * - every `users` doc with `customerId == old` (a claimed offline record, or
 *   an online applicant assigned an ID on their first accepted loan);
 * - every `loanApplications.offlineCustomerId == old`;
 * - the `settings/customerIdCounter` sequence is bumped past the new number so
 *   auto-generation can never hand the same ID out again.
 *
 * Historic data that quoted the old ID — Qippay `statement_reference` values,
 * audit log entries, PDFs already on Drive — is left as-is on purpose.
 *
 * Throws `AppError` (`NOT_FOUND`, `CONFLICT`, `VALIDATION_ERROR`).
 */
export async function renameCustomerId(
  db: Firestore,
  params: { currentCustomerId: string; newCustomerId: string },
): Promise<RenameCustomerIdResult> {
  const current = normaliseCustomerId(params.currentCustomerId);
  const next = normaliseCustomerId(params.newCustomerId);
  if (!current || !next) {
    throw new AppError('VALIDATION_ERROR', 400, 'Customer ID must look like TERE001 (TERE followed by at least three digits)');
  }
  if (current === next) {
    throw new AppError('VALIDATION_ERROR', 400, 'The new customer ID is the same as the current one');
  }

  const offline = db.collection('offlineCustomers');
  const users = db.collection('users');
  const apps = db.collection('loanApplications');
  const counterRef = db.doc('settings/customerIdCounter');

  return db.runTransaction(async (tx) => {
    // ALL READS FIRST — Firestore transactions require reads before writes.
    const [oldSnap, newSnap, usersWithNew, usersWithOld, appsWithOld, counterSnap] = await Promise.all([
      tx.get(offline.doc(current)),
      tx.get(offline.doc(next)),
      tx.get(users.where('customerId', '==', next).limit(1)),
      tx.get(users.where('customerId', '==', current)),
      tx.get(apps.where('offlineCustomerId', '==', current)),
      tx.get(counterRef),
    ]);

    if (!oldSnap.exists && usersWithOld.empty) {
      throw new AppError('NOT_FOUND', 404, 'Customer not found');
    }
    if (newSnap.exists || !usersWithNew.empty) {
      throw new AppError('CONFLICT', 409, `Customer ID ${next} is already in use`);
    }

    const now = FieldValue.serverTimestamp();

    if (oldSnap.exists) {
      const data = oldSnap.data() ?? {};
      const history = Array.isArray(data.previousCustomerIds) ? (data.previousCustomerIds as string[]) : [];
      tx.set(offline.doc(next), {
        ...data,
        customerId: next,
        previousCustomerIds: [...history, current],
        updatedAt: now,
      });
      tx.delete(offline.doc(current));
    }

    for (const doc of usersWithOld.docs) {
      tx.update(doc.ref, { customerId: next, updatedAt: now });
    }
    for (const doc of appsWithOld.docs) {
      tx.update(doc.ref, { offlineCustomerId: next, 'timeline.updatedAt': now });
    }

    // Keep the auto-generated sequence ahead of any hand-picked number.
    const newSequence = Number.parseInt(next.slice('TERE'.length), 10);
    const lastSequence: number = counterSnap.exists ? (counterSnap.data()?.lastSequence ?? 0) : 0;
    if (Number.isFinite(newSequence) && newSequence > lastSequence) {
      tx.set(counterRef, { lastSequence: newSequence }, { merge: true });
    }

    return {
      previousCustomerId: current,
      customerId: next,
      offlineRecordMoved: oldSnap.exists,
      usersUpdated: usersWithOld.size,
      applicationsUpdated: appsWithOld.size,
    };
  });
}
