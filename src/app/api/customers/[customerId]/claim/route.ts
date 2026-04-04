import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { checkRateLimit, defaultLimiter } from '@/lib/rate-limit/limiter';

export const dynamic = 'force-dynamic';

const claimSchema = z.object({
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD'),
});

/**
 * POST /api/customers/[customerId]/claim
 * Applicant only. Claims an offline customer record by verifying:
 *   1. customerId exists and is unlinked
 *   2. record.email matches the authenticated user's email
 *   3. record.dateOfBirth matches the submitted dateOfBirth
 *
 * On success: links the offline record to the user's uid and stamps customerId on users/{uid}.
 * On mismatch: returns a generic 400 to avoid enumeration.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> },
) {
  try {
    const auth = await withAuth(request, ['applicant']);
    await checkRateLimit(defaultLimiter, auth.uid);

    const { customerId } = await params;

    // Basic format validation
    if (!/^TERE\d{3,}$/.test(customerId)) {
      return errorResponse(
        new AppError('NOT_FOUND', 404, 'Customer not found'),
      );
    }

    const body = await request.json();
    const parsed = claimSchema.parse(body);

    const customerRef = adminDb.collection('offlineCustomers').doc(customerId);
    const userRef = adminDb.collection('users').doc(auth.uid);

    const [customerSnap, userSnap] = await Promise.all([
      customerRef.get(),
      userRef.get(),
    ]);

    if (!customerSnap.exists) {
      // Generic message — do not reveal whether the ID exists
      return errorResponse(
        new AppError('MISMATCH', 400, 'Details do not match. Please contact TerePay support.'),
      );
    }

    const customer = customerSnap.data()!;

    if (customer.status === 'linked') {
      return errorResponse(
        new AppError('MISMATCH', 400, 'Details do not match. Please contact TerePay support.'),
      );
    }

    // 3-way verification: email + date of birth
    const emailMatch =
      (customer.email ?? '').toLowerCase().trim() ===
      auth.email.toLowerCase().trim();
    const dobMatch = customer.dateOfBirth === parsed.dateOfBirth;

    if (!emailMatch || !dobMatch) {
      return errorResponse(
        new AppError('MISMATCH', 400, 'Details do not match. Please contact TerePay support.'),
      );
    }

    // Check this user hasn't already claimed a different ID
    const userData = userSnap.data();
    if (userData?.customerId && userData.customerId !== customerId) {
      return errorResponse(
        new AppError(
          'CONFLICT',
          409,
          'Your account is already linked to a different TerePay customer record.',
        ),
      );
    }

    // Atomic update: link the offline record and stamp the user document
    const batch = adminDb.batch();
    batch.update(customerRef, {
      status: 'linked',
      linkedUid: auth.uid,
      linkedAt: FieldValue.serverTimestamp(),
    });
    batch.update(userRef, {
      customerId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return NextResponse.json({ data: { customerId } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 400, err.issues[0]?.message ?? 'Invalid input'));
    }
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
