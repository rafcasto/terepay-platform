import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { adminUpdateLenderSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { normalizeRoles } from '@/lib/auth/roles';
import { FieldValue } from 'firebase-admin/firestore';
import type { UserRole } from '@/types/user';

export const dynamic = 'force-dynamic';

const STAFF_ROLES: UserRole[] = ['lender', 'content_editor'];

// PATCH /api/admin/users/[id] — update a staff user (lender / content editor):
// name, account status, and/or assigned roles.
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

    // Verify target user exists and is a staff account (lender / content editor).
    const userSnap = await adminDb.collection('users').doc(targetUid).get();
    if (!userSnap.exists) {
      throw new AppError('NOT_FOUND', 404, 'User not found');
    }
    const userData = userSnap.data()!;
    const currentRoles = normalizeRoles(userData.role, userData.roles);
    const isStaff = currentRoles.some((r) => STAFF_ROLES.includes(r));
    if (!isStaff) {
      throw new AppError('FORBIDDEN', 403, 'Can only manage staff (lender / content editor) accounts here');
    }

    const body = await request.json();
    const updates = adminUpdateLenderSchema.parse(body);

    const firestorePatch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (updates.firstName !== undefined) firestorePatch.firstName = updates.firstName;
    if (updates.lastName !== undefined) firestorePatch.lastName = updates.lastName;
    if (updates.status !== undefined) firestorePatch.status = updates.status;

    // --- Role assignment ---------------------------------------------------
    let claimsUpdated = false;
    if (updates.roles !== undefined) {
      const nextRoles = normalizeRoles(undefined, updates.roles);
      if (nextRoles.length === 0) {
        throw new AppError('VALIDATION_ERROR', 422, 'A staff user must keep at least one role');
      }
      // Preserve the existing primary role when it's still granted; otherwise
      // fall back to the first assigned role.
      const primary: UserRole =
        typeof userData.role === 'string' && nextRoles.includes(userData.role as UserRole)
          ? (userData.role as UserRole)
          : nextRoles[0];

      await adminAuth.setCustomUserClaims(targetUid, { role: primary, roles: nextRoles });
      firestorePatch.role = primary;
      firestorePatch.roles = nextRoles;
      claimsUpdated = true;
    }

    await adminDb.collection('users').doc(targetUid).update(firestorePatch);

    // If suspending/deactivating, revoke Firebase Auth sessions.
    if (updates.status === 'suspended' || updates.status === 'inactive') {
      await adminAuth.revokeRefreshTokens(targetUid);
      await adminAuth.updateUser(targetUid, { disabled: updates.status === 'inactive' });
    } else if (updates.status === 'active') {
      await adminAuth.updateUser(targetUid, { disabled: false });
    }

    // Changing roles must invalidate the existing session so the new custom
    // claims take effect. `verifySessionCookie(token, true)` rejects revoked
    // tokens, forcing a clean re-login that mints a cookie with fresh claims.
    if (claimsUpdated && updates.status !== 'suspended' && updates.status !== 'inactive') {
      await adminAuth.revokeRefreshTokens(targetUid);
    }

    await auditLog({
      userId: adminUid,
      action: 'admin_update_staff_user',
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
      action: 'admin_update_staff_user',
      targetType: 'users',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
    });
    return internalError();
  }
}
