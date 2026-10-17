import { type NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { checkRateLimit, defaultLimiter } from '@/lib/rate-limit/limiter';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { isQippayEnabled } from '@/lib/qippay/feature';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/applications/[id]/accept
 * Applicant accepts a lender-approved loan offer.
 * - Qippay ON:  'approved' → 'awaiting_payment_consent' (SetPay mandate gates disbursement)
 * - Qippay OFF: 'approved' → 'loan_accepted' (lender disburses and records repayments manually)
 * - If the applicant does not yet have a customerId, assigns the next TERE ID
 *   and marks isExistingCustomer: true on the user document.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['applicant']);

    const allowed = await checkRateLimit(defaultLimiter, auth.uid);
    if (!allowed) {
      throw new AppError('RATE_LIMITED', 429, 'Too many requests');
    }

    const { id } = await params;

    const appRef = adminDb.collection('loanApplications').doc(id);
    const appDoc = await appRef.get();

    if (!appDoc.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');

    const data = appDoc.data()!;

    if (data.applicantId !== auth.uid) {
      throw new AppError('FORBIDDEN', 403, 'You do not have access to this application');
    }

    if (data.status !== 'approved') {
      throw new AppError('BAD_REQUEST', 400, 'Only approved applications can be accepted');
    }

    const userRef = adminDb.collection('users').doc(auth.uid);
    const counterRef = adminDb.doc('settings/customerIdCounter');

    // Behind the Qippay feature flag: with it on, the applicant must set up a
    // SetPay mandate before funds are released; with it off, the offer is
    // simply accepted and the lender takes it from there.
    const qippayOn = await isQippayEnabled();
    const nextStatus = qippayOn ? 'awaiting_payment_consent' : 'loan_accepted';

    let assignedCustomerId: string | null = null;

    await adminDb.runTransaction(async (tx) => {
      // ALL READS FIRST (Firestore requires reads-before-writes within a tx)
      const userSnap = await tx.get(userRef);
      const userData = userSnap.data() ?? {};
      const needsCustomerId = !userData.customerId;
      const counterSnap = needsCustomerId ? await tx.get(counterRef) : null;

      const now = FieldValue.serverTimestamp();

      tx.update(appRef, {
        status: nextStatus,
        'timeline.acceptedAt': now,
        'timeline.updatedAt': now,
      });

      // Assign customer ID if not already set (first-time applicant)
      if (needsCustomerId) {
        const last: number = counterSnap!.exists ? (counterSnap!.data()?.lastSequence ?? 0) : 0;
        const next = last + 1;
        const customerId = `TERE${String(next).padStart(3, '0')}`;
        assignedCustomerId = customerId;

        tx.set(counterRef, { lastSequence: next }, { merge: true });
        tx.update(userRef, {
          customerId,
          isExistingCustomer: true,
          updatedAt: now,
        });
      } else if (!userData.isExistingCustomer) {
        // Already has customerId but flag wasn't set — fix it
        tx.update(userRef, {
          isExistingCustomer: true,
          updatedAt: now,
        });
      }
    });

    await auditLog({
      userId: auth.uid,
      action: 'offer_accepted_by_applicant',
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
      changes: { assignedCustomerId, status: nextStatus },
    });

    return NextResponse.json(
      {
        data: {
          status: nextStatus,
          ...(assignedCustomerId ? { customerId: assignedCustomerId } : {}),
        },
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
