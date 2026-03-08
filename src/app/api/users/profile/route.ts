import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { withAuth } from '@/lib/auth/middleware';
import { updateProfileSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { FieldValue } from 'firebase-admin/firestore';
import { ZodError } from 'zod';

/**
 * GET /api/users/profile
 * Returns the current user's profile.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);

    const userDoc = await adminDb.collection('users').doc(auth.uid).get();
    if (!userDoc.exists) throw new AppError('NOT_FOUND', 404, 'User not found');

    return NextResponse.json({ data: { id: userDoc.id, ...userDoc.data() } });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}

/**
 * PATCH /api/users/profile
 * Updates allowed profile fields for the current user.
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    const body = await request.json();
    const parsed = updateProfileSchema.parse(body);

    await adminDb
      .collection('users')
      .doc(auth.uid)
      .update({ ...parsed, updatedAt: FieldValue.serverTimestamp() });

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(
        new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors),
      );
    }
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
