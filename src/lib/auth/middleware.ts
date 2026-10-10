import { type NextRequest } from 'next/server';
import { verifySessionOrIdToken } from '@/lib/firebase/admin';
import { AppError } from '@/lib/utils/api-error';
import type { UserRole } from '@/types/user';
import { rolesFromClaims, hasAnyRole } from '@/lib/auth/roles';

export type AuthResult = {
  uid: string;
  email: string;
  /** Primary role (backward compatible). */
  role: UserRole;
  /** Full set of roles the user holds. Always contains `role`. */
  roles: UserRole[];
  emailVerified: boolean;
};

/**
 * Verify the Firebase session cookie and extract the authenticated user.
 * Throws `AppError` (401 or 403) on failure — catch and return `errorResponse()`.
 *
 * @param allowedRoles  Optional whitelist of roles. Access is granted if the
 *                      user holds *any* of these roles. Omit to allow any role.
 */
export async function withAuth(
  request: NextRequest,
  allowedRoles?: UserRole[],
): Promise<AuthResult> {
  const sessionCookie = request.cookies.get('__session')?.value;

  if (!sessionCookie) {
    throw new AppError('AUTH_MISSING', 401, 'Authentication required');
  }

  let decoded;
  try {
    decoded = await verifySessionOrIdToken(sessionCookie);
  } catch {
    throw new AppError('AUTH_EXPIRED', 401, 'Session expired or invalid');
  }

  const roles = rolesFromClaims({ role: decoded.role, roles: decoded.roles });
  const role = (decoded.role as UserRole) ?? roles[0];

  if (allowedRoles && !hasAnyRole(roles, allowedRoles)) {
    throw new AppError('FORBIDDEN', 403, 'You do not have permission to access this resource');
  }

  return {
    uid: decoded.uid,
    email: decoded.email ?? '',
    role,
    roles,
    emailVerified: decoded.email_verified ?? false,
  };
}
