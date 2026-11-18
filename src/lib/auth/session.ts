import { cookies } from 'next/headers';
import { verifySessionOrIdToken } from '@/lib/firebase/admin';
import { normalizeRoles, preferredDashboard } from './roles';
import type { UserRole } from '@/types/user';

export type ViewerSession = {
  uid: string;
  /** Primary role from the token claims (drives the default portal). */
  role: UserRole | undefined;
  roles: UserRole[];
  /** Dashboard the viewer should land on, given their roles. */
  dashboardHref: string;
};

/**
 * Resolve the signed-in viewer from the `__session` cookie in a Server
 * Component or layout. Fully verifies the cookie (signature + revocation) via
 * the Admin SDK — not a bare JWT decode. Returns `null` for a missing, expired
 * or invalid cookie and never throws, so public pages can call it freely to
 * adapt their UI (landing navbar, auth pages) without becoming fragile.
 *
 * API routes keep using `withAuth()`; this is for rendering decisions only.
 */
export async function getViewerSession(): Promise<ViewerSession | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) return null;

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded) return null;

  const role = typeof decoded.role === 'string' ? (decoded.role as UserRole) : undefined;
  const roles = normalizeRoles(decoded.role, decoded.roles);
  if (roles.length === 0) return null;

  return { uid: decoded.uid, role, roles, dashboardHref: preferredDashboard(role, roles) };
}
