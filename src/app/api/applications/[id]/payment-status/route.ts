import { type NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { checkRateLimit, defaultLimiter } from '@/lib/rate-limit/limiter';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { getDetailedConsentStatus } from '@/lib/qippay/setpay-client';
import type { PaymentConsent, ScheduledPayment } from '@/types/application';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/applications/[id]/payment-status
 *
 * Polls Qippay for the latest payment state using the detailed consent
 * status endpoint (GET /v1/enduring_initiation/{epcId}/status), which
 * performs a real-time check with the bank and returns count_complete.
 *
 * Reconciles `scheduledPayments` in Firestore:
 *   - Advances any 'scheduled'/'retrying' payments to 'success' when
 *     count_complete has increased since the last poll.
 *   - Marks consent as cancelled when the provider reports revoked/cancelled.
 *
 * Accessible to the owning applicant and the assigned lender.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);

  try {
    const auth = await withAuth(request, ['applicant', 'lender']);

    const allowed = await checkRateLimit(defaultLimiter, auth.uid);
    if (!allowed) throw new AppError('RATE_LIMITED', 429, 'Too many requests');

    const { id } = await params;
    const appRef = adminDb.collection('loanApplications').doc(id);
    const appSnap = await appRef.get();

    if (!appSnap.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');

    const appData = appSnap.data()!;
    const isApplicant = appData.applicantId === auth.uid;
    const isAssignedLender = appData.assignedLenderId && appData.assignedLenderId === auth.uid;

    if (!isApplicant && !isAssignedLender) {
      throw new AppError('FORBIDDEN', 403, 'You do not have access to this application');
    }

    const consent = appData.paymentConsent as PaymentConsent | undefined;
    if (!consent || !consent.mandateId) {
      return NextResponse.json({
        data: {
          scheduledPayments: [],
          consentStatus: consent?.status ?? 'not_started',
          consentOverallStatus: null,
        },
      });
    }

    // No point polling Qippay if consent is already in a terminal non-active state
    if (consent.status !== 'active') {
      const payments: ScheduledPayment[] = Array.isArray(appData.scheduledPayments)
        ? (appData.scheduledPayments as ScheduledPayment[])
        : [];
      return NextResponse.json({
        data: {
          scheduledPayments: payments,
          consentStatus: consent.status,
          consentOverallStatus: null,
        },
      });
    }

    // Call Qippay detailed status
    const detailed = await getDetailedConsentStatus(consent.mandateId);
    const countComplete = detailed.consentOverallStatus?.countComplete ?? 0;

    // Detect revocation — provider status "Revoked" or consent status maps to cancelled
    const providerRevoked =
      detailed.providerStatus?.status?.toLowerCase() === 'revoked' ||
      detailed.status?.toLowerCase() === 'revoked';

    const payments: ScheduledPayment[] = Array.isArray(appData.scheduledPayments)
      ? (appData.scheduledPayments as ScheduledPayment[])
      : [];

    let needsWrite = false;
    const updates: Record<string, unknown> = {
      'timeline.updatedAt': FieldValue.serverTimestamp(),
    };

    // Reconcile payment statuses
    if (payments.length > 0) {
      const reconciled = payments.map((p) => {
        if (p.status === 'success') return p; // already terminal
        if (providerRevoked && (p.status === 'pending' || p.status === 'scheduled' || p.status === 'retrying')) {
          needsWrite = true;
          return { ...p, status: 'cancelled' as const };
        }
        if (p.installmentNumber <= countComplete && (p.status === 'scheduled' || p.status === 'retrying')) {
          needsWrite = true;
          return { ...p, status: 'success' as const, completedAt: FieldValue.serverTimestamp() };
        }
        return p;
      });
      if (needsWrite) {
        updates.scheduledPayments = reconciled;
      }
    }

    // Reconcile consent status on revocation
    if (providerRevoked && consent.status === 'active') {
      needsWrite = true;
      updates['paymentConsent.status'] = 'cancelled';
      updates['paymentConsent.failureReason'] = 'revoked_by_customer';
    }

    if (needsWrite) {
      await appRef.update(updates);
    }

    // Re-read to return consistent final state
    const finalSnap = await appRef.get();
    const finalData = finalSnap.data()!;
    const finalPayments: ScheduledPayment[] = Array.isArray(finalData.scheduledPayments)
      ? (finalData.scheduledPayments as ScheduledPayment[])
      : [];

    await auditLog({
      userId: auth.uid,
      action: 'setpay_payment_status_checked',
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
      changes: {
        mandateId: consent.mandateId,
        countComplete,
        providerRevoked,
        reconciledCount: needsWrite ? finalPayments.filter((p) => p.status === 'success').length : undefined,
      },
    });

    return NextResponse.json({
      data: {
        scheduledPayments: finalPayments,
        consentStatus: finalData.paymentConsent?.status ?? consent.status,
        consentOverallStatus: detailed.consentOverallStatus,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error('[payment-status] unexpected error', err);
    return internalError();
  }
}
