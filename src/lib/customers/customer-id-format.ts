/**
 * Client-safe customer ID format helpers (no Firebase imports) — shared by
 * the lender UI and the server-side rename in `./customer-id.ts`.
 */

/** Friendly TerePay customer IDs: `TERE` + at least three digits (e.g. `TERE001`). */
export const CUSTOMER_ID_RE = /^TERE\d{3,}$/;

/** Upper-cases and trims what a lender typed; returns null when it is not a valid customer ID. */
export function normaliseCustomerId(raw: string): string | null {
  const value = raw.trim().toUpperCase();
  return CUSTOMER_ID_RE.test(value) ? value : null;
}
