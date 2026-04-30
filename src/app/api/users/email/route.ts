import { type NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { updateEmailSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { checkRateLimit, authSignupLimiter } from '@/lib/rate-limit/limiter';
import { getClientIp, auditLog } from '@/lib/utils/audit';
import { FieldValue } from 'firebase-admin/firestore';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/users/email
 * Updates the authenticated user's email address in both Firebase Auth and Firestore.
 * Resets emailVerified to false — the user must re-verify the new address.
 * This also updates the login email.
 */
export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request);

  const allowed = await checkRateLimit(authSignupLimiter, `email-update:${ip}`);
  if (!allowed) {
    return errorResponse(new AppError('RATE_LIMITED', 429, 'Too many requests. Please try again later.'));
  }

  try {
    const auth = await withAuth(request);
    const body = await request.json();
    const { newEmail } = updateEmailSchema.parse(body);

    // Fetch current user to prevent no-op and to get current email for audit
    const currentUser = await adminAuth.getUser(auth.uid);
    if (currentUser.email?.toLowerCase() === newEmail.toLowerCase()) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'The new email is the same as the current email.'));
    }

    // Check the new email is not already in use by another account
    const existing = await adminAuth.getUserByEmail(newEmail).catch(() => null);
    if (existing && existing.uid !== auth.uid) {
      return errorResponse(new AppError('CONFLICT', 409, 'This email address is already associated with another account.'));
    }

    // Update Firebase Auth — this changes the login email and resets emailVerified
    await adminAuth.updateUser(auth.uid, {
      email: newEmail,
      emailVerified: false,
    });

    // Update Firestore to keep it in sync
    await adminDb.collection('users').doc(auth.uid).update({
      email: newEmail,
      emailVerified: false,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await auditLog({
      userId: auth.uid,
      action: 'update_email',
      targetType: 'user',
      targetId: auth.uid,
      outcome: 'success',
      ipAddress: ip,
    });

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
