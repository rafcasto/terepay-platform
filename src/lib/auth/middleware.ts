import { type NextRequest } from 'next/server';
import { verifySessionOrIdToken } from '@/lib/firebase/admin';
import { AppError } from '@/lib/utils/api-error';

export type AuthResult = {
  uid: string;
  email: string;
  role: 'applicant' | 'lender';
};

/**
 * Verify the Firebase session cookie and extract the authenticated user.
 * Throws `AppError` (401 or 403) on failure — catch and return `errorResponse()`.
 *
 * @param allowedRoles  Optional whitelist of roles. Omit to allow any role.
 */
export async function withAuth(
  request: NextRequest,
  allowedRoles?: ('applicant' | 'lender')[],
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

  const role = decoded.role as 'applicant' | 'lender';

  if (allowedRoles && !allowedRoles.includes(role)) {
    throw new AppError('FORBIDDEN', 403, 'You do not have permission to access this resource');
  }

  return { uid: decoded.uid, email: decoded.email ?? '', role };
}
