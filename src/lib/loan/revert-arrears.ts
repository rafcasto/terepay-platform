import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { AppError } from '@/lib/utils/api-error';
import { auditLog } from '@/lib/utils/audit';
import { syncLoanRecord } from '@/lib/loan/loan-record';
import { arrearsChargeTotals } from '@/lib/loan/arrears-charges';
import type {
  ArrearsReversal,
  ArrearsState,
  FeeAssessment,
  LoanApplication,
} from '@/types/application';

export interface RevertArrearsInput {
  applicationId: string;
  reason: string;
  actor: { uid: string; name?: string };
  ip?: string;
}

export interface RevertArrearsResult {
  /** Fee assessments removed. */
  feesReverted: number;
  /** Late fees + default fee + accrued interest removed (cents). */
  totalCents: number;
}

/**
 * Remove every arrears charge on a loan — late payment fees, the payment
 * default fee and the post-default interest accrual — after an assessment was
 * run by mistake (wrong loan, payment not yet recorded, etc.).
 *
 * The removed charges are snapshotted onto `arrearsReversals` so the loan
 * keeps its own history, and the action is audit-logged. Reminder emails
 * already sent cannot be unsent, so the `reminders` ledger is left alone —
 * a later legitimate assessment will not email the borrower twice.
 *
 * The engine is idempotent on fee ids, so if the loan is genuinely overdue the
 * next assessment simply re-charges the same fees from scratch.
 */
export async function revertArrearsForApplication(
  input: RevertArrearsInput,
): Promise<RevertArrearsResult> {
  const { applicationId, reason, actor, ip } = input;
  const appRef = adminDb.collection('loanApplications').doc(applicationId);

  const result = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(appRef);
    if (!snap.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');
    const app = snap.data() as LoanApplication;

    if (app.assignedLenderId && app.assignedLenderId !== actor.uid) {
      throw new AppError('FORBIDDEN', 403, 'Only the assigned lender can revert arrears on this loan');
    }

    const fees: FeeAssessment[] = Array.isArray(app.feeAssessments)
      ? (app.feeAssessments as FeeAssessment[])
      : [];
    const arrears = (app.arrears as ArrearsState | undefined) ?? undefined;
    const totals = arrearsChargeTotals(fees, arrears);

    if (fees.length === 0 && !arrears) {
      throw new AppError('CONFLICT', 409, 'There are no arrears charges on this loan to revert');
    }

    const reversal: ArrearsReversal = {
      revertedAt: Timestamp.now(),
      revertedBy: actor.uid,
      ...(actor.name ? { revertedByName: actor.name } : {}),
      reason,
      feeAssessments: fees,
      ...(arrears ? { arrears } : {}),
      totalCents: totals.totalCents,
    };

    const previous: ArrearsReversal[] = Array.isArray(app.arrearsReversals)
      ? (app.arrearsReversals as ArrearsReversal[])
      : [];

    tx.update(appRef, {
      feeAssessments: FieldValue.delete(),
      arrears: FieldValue.delete(),
      arrearsReversals: [...previous, reversal],
      'timeline.updatedAt': FieldValue.serverTimestamp(),
    });

    return {
      feesReverted: fees.length,
      totalCents: totals.totalCents,
      lateFeeCents: totals.lateFeeCents,
      defaultFeeCents: totals.defaultFeeCents,
      accruedInterestCents: totals.accruedInterestCents,
    };
  });

  await auditLog({
    userId: actor.uid,
    action: 'arrears_reverted',
    targetId: applicationId,
    targetType: 'application',
    outcome: 'success',
    ipAddress: ip,
    changes: {
      reason,
      feesReverted: result.feesReverted,
      totalCents: result.totalCents,
      lateFeeCents: result.lateFeeCents,
      defaultFeeCents: result.defaultFeeCents,
      accruedInterestCents: result.accruedInterestCents,
    },
  });

  // Balances on the portfolio / statements include arrears charges.
  await syncLoanRecord(applicationId);

  return { feesReverted: result.feesReverted, totalCents: result.totalCents };
}
