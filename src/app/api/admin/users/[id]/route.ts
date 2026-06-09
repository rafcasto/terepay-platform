import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { adminUpdateLenderSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/users/[id] — update or deactivate a lender
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const ip = getClientIp(request);
  let adminUid = 'unknown';

  try {
    const allowed = await checkRateLimit(defaultLimiter, ip);
    if (!allowed) {
      return errorResponse(new AppError('RATE_LIMITED', 429, 'Too many requests.'));
    }

    const auth = await withAuth(request, ['admin']);
    adminUid = auth.uid;

    const { id: targetUid } = await params;

    // Verify target user exists and is a lender
    const userSnap = await adminDb.collection('users').doc(targetUid).get();
    if (!userSnap.exists) {
      throw new AppError('NOT_FOUND', 404, 'User not found');
    }
    const userData = userSnap.data()!;
    if (userData.role !== 'lender') {
      throw new AppError('FORBIDDEN', 403, 'Can only update lender accounts via this endpoint');
    }

    const body = await request.json();
    const updates = adminUpdateLenderSchema.parse(body);

    const firestorePatch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (updates.firstName !== undefined) firestorePatch.firstName = updates.firstName;
    if (updates.lastName !== undefined) firestorePatch.lastName = updates.lastName;
    if (updates.status !== undefined) firestorePatch.status = updates.status;

    await adminDb.collection('users').doc(targetUid).update(firestorePatch);

    // If suspending/deactivating, revoke Firebase Auth sessions
    if (updates.status === 'suspended' || updates.status === 'inactive') {
      await adminAuth.revokeRefreshTokens(targetUid);
      await adminAuth.updateUser(targetUid, { disabled: updates.status === 'inactive' });
    } else if (updates.status === 'active') {
      await adminAuth.updateUser(targetUid, { disabled: false });
    }

    await auditLog({
      userId: adminUid,
      action: 'admin_update_lender',
      targetId: targetUid,
      targetType: 'users',
      outcome: 'success',
      changes: updates,
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    return NextResponse.json({ data: { uid: targetUid } });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);

    await auditLog({
      userId: adminUid,
      action: 'admin_update_lender',
      targetType: 'users',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
    });
    return internalError();
  }
}
