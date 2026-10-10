import { adminDb } from '@/lib/firebase/admin';
import type { LoanApplication } from '@/types/application';
import { deriveLoanSummary, isLiveLoanStatus } from './active-loan';

/**
 * True when the applicant already has a disbursed loan that has not been fully
 * repaid. Used to stop a borrower starting/submitting a second loan while one
 * is still outstanding.
 *
 * Queries only by `applicantId` (no composite index needed) and filters live
 * loan statuses in memory; a loan counts as outstanding unless its derived
 * balance is fully paid.
 */
export async function hasOutstandingLoan(uid: string): Promise<boolean> {
  const snap = await adminDb
    .collection('loanApplications')
    .where('applicantId', '==', uid)
    .get();

  return snap.docs.some((doc) => {
    const app = doc.data() as LoanApplication;
    if (!isLiveLoanStatus(app.status)) return false;
    return !deriveLoanSummary(app).isFullyPaid;
  });
}
