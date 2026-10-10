import type { UserRole } from '@/types/user';

/**
 * Multi-role helpers.
 *
 * TerePay historically stored a single `role` per user (Firestore field +
 * Firebase custom claim). We now also support a `roles` array so a user can
 * hold more than one role at once (e.g. a lender who is also a content editor).
 *
 * `role` remains the *primary* role — it drives the default portal a user lands
 * on and preserves backward-compatibility with any code that only reads `role`.
 * `roles` is the authoritative set for access checks. When `roles` is missing
 * (legacy users / legacy tokens) we fall back to `[role]`.
 */

/** Roles a user can hold in addition to their primary role via admin assignment. */
export const ASSIGNABLE_SECONDARY_ROLES: UserRole[] = ['lender', 'content_editor'];

/** Roles that own a dedicated portal a user can switch into. */
export const PORTAL_ROLES: UserRole[] = ['applicant', 'lender', 'admin', 'content_editor'];

/** Normalise a possibly-unknown value into a valid `UserRole[]`. */
export function normalizeRoles(
  role: unknown,
  roles: unknown,
): UserRole[] {
  const valid = new Set<UserRole>(['applicant', 'lender', 'admin', 'content_editor']);
  const out = new Set<UserRole>();

  if (Array.isArray(roles)) {
    for (const r of roles) {
      if (typeof r === 'string' && valid.has(r as UserRole)) out.add(r as UserRole);
    }
  }
  if (typeof role === 'string' && valid.has(role as UserRole)) out.add(role as UserRole);

  // Legacy fallback — never return an empty set for a known role.
  if (out.size === 0 && typeof role === 'string' && valid.has(role as UserRole)) {
    out.add(role as UserRole);
  }
  return [...out];
}

/** Resolve the roles carried on a decoded session/ID token. */
export function rolesFromClaims(claims: { role?: unknown; roles?: unknown }): UserRole[] {
  return normalizeRoles(claims.role, claims.roles);
}

/** True if any of `roles` is present in `allowed`. */
export function hasAnyRole(roles: UserRole[], allowed: UserRole[]): boolean {
  return roles.some((r) => allowed.includes(r));
}

/** Default dashboard path for a primary role. */
export function dashboardPathForRole(role: UserRole | undefined): string {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'lender':
      return '/lender/dashboard';
    case 'content_editor':
      return '/content-editor/dashboard';
    case 'applicant':
      return '/applicant/dashboard';
    default:
      return '/auth/login';
  }
}

/** Which portal role a protected path belongs to, if any. */
export function portalRoleForPath(pathname: string): UserRole | null {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/lender')) return 'lender';
  if (pathname.startsWith('/content-editor')) return 'content_editor';
  if (pathname.startsWith('/applicant')) return 'applicant';
  return null;
}

/** Best landing path given the roles a user holds, preferring their primary role. */
export function preferredDashboard(primary: UserRole | undefined, roles: UserRole[]): string {
  if (primary && roles.includes(primary)) return dashboardPathForRole(primary);
  // Priority order when the primary isn't usable.
  for (const r of ['admin', 'lender', 'content_editor', 'applicant'] as UserRole[]) {
    if (roles.includes(r)) return dashboardPathForRole(r);
  }
  return '/auth/login';
}

export const PORTAL_LABELS: Record<UserRole, string> = {
  applicant: 'Borrower',
  lender: 'Lender',
  admin: 'Admin',
  content_editor: 'Content Editor',
};
