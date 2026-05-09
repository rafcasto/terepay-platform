import { type NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { checkRateLimit, defaultLimiter } from '@/lib/rate-limit/limiter';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/applications/[id]/accept
 * Applicant accepts a lender-approved loan offer.
 * - Transitions status from 'approved' → 'loan_accepted'
 * - If the applicant does not yet have a customerId, assigns the next TERE ID
 *   and marks isExistingCustomer: true on the user document.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, ['applicant']);
    await checkRateLimit(defaultLimiter, auth.uid);

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

    let assignedCustomerId: string | null = null;

    await adminDb.runTransaction(async (tx) => {
      // ALL READS FIRST (Firestore requires reads-before-writes within a tx)
      const userSnap = await tx.get(userRef);
      const userData = userSnap.data() ?? {};
      const needsCustomerId = !userData.customerId;
      const counterSnap = needsCustomerId ? await tx.get(counterRef) : null;

      const now = FieldValue.serverTimestamp();

      // Update application status
      tx.update(appRef, {
        status: 'loan_accepted',
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

    return NextResponse.json(
      { data: { status: 'loan_accepted', ...(assignedCustomerId ? { customerId: assignedCustomerId } : {}) } },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
