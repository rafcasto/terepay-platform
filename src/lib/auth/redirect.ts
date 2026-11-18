/**
 * Post-login redirect targets come from the `?redirect=` query string, which
 * anyone can craft. Only same-origin, path-style values are honoured so a
 * sign-in link can never bounce a user to another site (open redirect).
 * Pure function — safe to import from Client Components.
 */
export function safeRedirectPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Must be an absolute path on this origin: "/x" but not "//evil", "/\evil" or "http://…".
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  return raw;
}
