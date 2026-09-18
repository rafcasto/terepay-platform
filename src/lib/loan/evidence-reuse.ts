/**
 * Evidence-reuse policy for returning applicants.
 *
 * When a customer applies for a second (or later) loan, the lender should not
 * have to re-collect everything. These helpers compute how old a piece of
 * evidence is and whether it is still within its reuse window, so the lender
 * review screen can say "bank statements from March are still usable" instead
 * of silently asking for them again.
 *
 * Windows are policy values — adjust here, not in the UI.
 */

/** Bank statements from a previous application can be reused if the new loan is within this window. */
export const BANK_STATEMENT_REUSE_MONTHS = 6;

/** Payslips age out faster than bank statements — income can change quickly. */
export const PAYSLIP_REUSE_MONTHS = 3;

/** A comprehensive credit report (Centrix) does not need to be re-pulled inside this window. */
export const CREDIT_REPORT_REUSE_MONTHS = 6;

export type EvidenceAge = {
  /** Whole months elapsed since the evidence date (floored). */
  months: number;
  /** Whole days elapsed. */
  days: number;
  /** Human label, e.g. "3 months ago", "12 days ago", "today". */
  label: string;
};

export function evidenceAge(from: Date, now: Date = new Date()): EvidenceAge {
  const ms = Math.max(0, now.getTime() - from.getTime());
  const days = Math.floor(ms / 86_400_000);
  let months = (now.getFullYear() - from.getFullYear()) * 12 + (now.getMonth() - from.getMonth());
  if (now.getDate() < from.getDate()) months -= 1;
  months = Math.max(0, months);

  let label: string;
  if (days === 0) label = 'today';
  else if (days === 1) label = 'yesterday';
  else if (days < 31) label = `${days} days ago`;
  else if (months === 1) label = '1 month ago';
  else label = `${months} months ago`;

  return { months, days, label };
}

/** True if the evidence is still inside its reuse window (strictly younger than `windowMonths`). */
export function isWithinReuseWindow(from: Date, windowMonths: number, now: Date = new Date()): boolean {
  return evidenceAge(from, now).months < windowMonths;
}

/** Date on which the evidence falls out of its reuse window. */
export function reuseExpiry(from: Date, windowMonths: number): Date {
  const d = new Date(from.getTime());
  d.setMonth(d.getMonth() + windowMonths);
  return d;
}
