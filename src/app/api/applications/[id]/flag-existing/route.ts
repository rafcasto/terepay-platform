import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const flagSchema = z.object({
  isExistingCustomer: z.boolean(),
});

/**
 * POST /api/applications/[id]/flag-existing
 * Lender only. Flags (or unflags) an applicant as an existing customer.
 * This affects the application fee ($30 existing vs $50 new) and permanently
 * updates the applicant's user profile so future applications inherit the flag.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await withAuth(request, ['lender']);
    const { id } = await params;

    const appRef = adminDb.collection('loanApplications').doc(id);
    const appDoc = await appRef.get();
    if (!appDoc.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');

    const appData = appDoc.data()!;

    const body = await request.json();
    const { isExistingCustomer } = flagSchema.parse(body);

    const now = FieldValue.serverTimestamp();

    const batch = adminDb.batch();
    batch.update(appRef, {
      isExistingCustomer,
      'timeline.updatedAt': now,
    });
    // Permanently mark user so future applications inherit the flag
    const userRef = adminDb.collection('users').doc(appData.applicantId);
    batch.update(userRef, {
      isExistingCustomer,
      updatedAt: now,
    });

    await batch.commit();

    return NextResponse.json({ data: { isExistingCustomer } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(
        new AppError('VALIDATION_ERROR', 400, err.issues[0]?.message ?? 'Invalid input'),
      );
    }
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
