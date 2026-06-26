import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { auditLog } from '@/lib/utils/audit';
import { LOAN_INTEREST_RATE } from '@/lib/constants/fees';
import { deriveLoanSummary, type ActiveLoanSummary, type DerivedInstallmentStatus } from './active-loan';
import type { LoanApplication, InstallmentStatus, PaymentConsent } from '@/types/application';

/** Map a derived schedule status onto the loan-record instalment status. */
function toInstallmentStatus(status: DerivedInstallmentStatus): InstallmentStatus {
  switch (status) {
    case 'paid':
      return 'paid';
    case 'overdue':
    case 'failed':
      return 'overdue';
    case 'retrying':
      return 'retrying';
    default:
      return 'scheduled';
  }
}

function buildInstallments(summary: ActiveLoanSummary) {
  return summary.installments.map((i) => ({
    installmentNumber: i.installmentNumber,
    dueDate: i.dueDate,
    amount: i.amount,
    status: toInstallmentStatus(i.status),
  }));
}

/** active → still being repaid · delinquent → overdue · closed_repaid → settled. */
function loanStatusFor(summary: ActiveLoanSummary): 'active' | 'delinquent' | 'closed_repaid' {
  if (summary.isFullyPaid) return 'closed_repaid';
  if (summary.isDelinquent) return 'delinquent';
  return 'active';
}

/**
 * Create the canonical `loans` record for a freshly disbursed application and
 * stamp `loanId` back onto the application. Powers the lender portfolio, the
 * loan statement / closure-letter PDFs, and the applicant's statement download.
 *
 * Best-effort: a failure is logged but never thrown, so it can't roll back an
 * already-committed disbursement.
 */
export async function createLoanRecord(params: {
  applicationId: string;
  lenderId: string;
  disbursedAmount: number;
  consent: PaymentConsent | null;
  ip?: string;
}): Promise<void> {
  const { applicationId, lenderId, disbursedAmount, consent, ip } = params;
  try {
    const snap = await adminDb.collection('loanApplications').doc(applicationId).get();
    if (!snap.exists) return;
    const app = snap.data() as LoanApplication;

    const summary = deriveLoanSummary(app);
    const installments = buildInstallments(summary);
    const now = FieldValue.serverTimestamp();

    const loanDoc: Record<string, unknown> = {
      loanId: applicationId,
      applicationId,
      applicantId: app.applicantId,
      assignedLenderId: app.assignedLenderId ?? lenderId,
      status: loanStatusFor(summary),
      principal: disbursedAmount,
      totalRepayable: summary.totalRepayable,
      totalPaid: summary.totalPaid,
      remainingBalance: summary.remainingBalance,
      fortnightlyPayment: app.loanDetails?.fortnightlyPayment ?? installments[0]?.amount ?? 0,
      installments,
      mandateId: consent?.mandateId ?? '',
      beneficiaryId: consent?.beneficiaryId ?? '',
      ...(summary.nextPaymentDate
        ? { nextPaymentDate: Timestamp.fromDate(new Date(summary.nextPaymentDate)) }
        : {}),
      // Top-level fields read by the lender portfolio view.
      interestRate: Math.round(LOAN_INTEREST_RATE * 1000) / 10, // e.g. 4.7
      createdAt: now,
      timeline: { createdAt: now, updatedAt: now, disbursedAt: now },
    };

    // merge:true keeps this idempotent if a record somehow already exists.
    await adminDb.collection('loans').doc(applicationId).set(loanDoc, { merge: true });
    await adminDb
      .collection('loanApplications')
      .doc(applicationId)
      .update({ loanId: applicationId, 'timeline.updatedAt': now });

    await auditLog({
      userId: lenderId,
      action: 'loan_record_created',
      targetId: applicationId,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
      changes: {
        principal: disbursedAmount,
        totalRepayable: summary.totalRepayable,
        installments: installments.length,
      },
    });
  } catch (err) {
    console.error('[loan-record] Failed to create loan record', err);
    await auditLog({
      userId: lenderId,
      action: 'loan_record_created',
      targetId: applicationId,
      targetType: 'application',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : String(err),
      ipAddress: ip,
    });
  }
}

/**
 * Refresh an existing `loans` record from its application's live repayment
 * state (used after Qippay payment events). No-op when the loan record doesn't
 * exist yet. Best-effort: failures are logged, never thrown.
 */
export async function syncLoanRecord(applicationId: string): Promise<void> {
  try {
    const loanRef = adminDb.collection('loans').doc(applicationId);
    const [appSnap, loanSnap] = await Promise.all([
      adminDb.collection('loanApplications').doc(applicationId).get(),
      loanRef.get(),
    ]);
    if (!appSnap.exists || !loanSnap.exists) return;

    const app = appSnap.data() as LoanApplication;
    const summary = deriveLoanSummary(app);
    const now = FieldValue.serverTimestamp();
    const fullyPaid = summary.isFullyPaid;

    const updates: Record<string, unknown> = {
      status: loanStatusFor(summary),
      totalPaid: summary.totalPaid,
      remainingBalance: summary.remainingBalance,
      installments: buildInstallments(summary),
      nextPaymentDate: summary.nextPaymentDate
        ? Timestamp.fromDate(new Date(summary.nextPaymentDate))
        : FieldValue.delete(),
      'timeline.updatedAt': now,
      ...(fullyPaid ? { 'timeline.closedAt': now } : {}),
    };

    await loanRef.update(updates);
  } catch (err) {
    console.error('[loan-record] Failed to sync loan record', err);
  }
}
