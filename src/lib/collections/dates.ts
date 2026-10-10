/**
 * Date helpers for the collections engine.
 *
 * All "daily" accrual and grace-period day counts use a single explicit day
 * boundary: a calendar day in Pacific/Auckland (NFR-2). Dates flow through the
 * engine as YYYY-MM-DD calendar strings so the math is timezone-stable and
 * fully deterministic — no wall-clock, no Date arithmetic across DST (NFR-3).
 */

const DAY_MS = 86_400_000;

/** Parse a YYYY-MM-DD calendar date to its UTC-midnight epoch (TZ-stable). */
function ymdToUtc(ymd: string): number {
  const ms = Date.parse(`${ymd}T00:00:00.000Z`);
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid calendar date: "${ymd}" (expected YYYY-MM-DD)`);
  }
  return ms;
}

/**
 * Whole days from `fromYmd` to `toYmd` (later − earlier).
 *
 * This is an EXCLUSIVE count of elapsed days: from 19 May to 22 May = 3. The
 * "charge on day 3 / day 7" grace rule triggers when `daysBetween(dueDate,
 * asOf) >= graceDays`, i.e. the fee lands once the instalment is that many full
 * days past due.
 */
export function daysBetween(fromYmd: string, toYmd: string): number {
  return Math.round((ymdToUtc(toYmd) - ymdToUtc(fromYmd)) / DAY_MS);
}

/** Shift a YYYY-MM-DD date by whole days, returning a YYYY-MM-DD date. */
export function shiftYmd(ymd: string, days: number): string {
  return new Date(ymdToUtc(ymd) + days * DAY_MS).toISOString().slice(0, 10);
}

/** True when `a` is strictly before `b` (calendar comparison). */
export function isBefore(a: string, b: string): boolean {
  return ymdToUtc(a) < ymdToUtc(b);
}

/** Min / max of two calendar dates. */
export function minYmd(a: string, b: string): string {
  return ymdToUtc(a) <= ymdToUtc(b) ? a : b;
}
export function maxYmd(a: string, b: string): string {
  return ymdToUtc(a) >= ymdToUtc(b) ? a : b;
}

/** Assert a well-formed YYYY-MM-DD string (fail closed on bad input — NFR-6). */
export function assertYmd(label: string, ymd: string | undefined | null): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd) || Number.isNaN(Date.parse(`${ymd}T00:00:00Z`))) {
    throw new Error(`${label} must be a valid YYYY-MM-DD date (got: ${String(ymd)})`);
  }
  return ymd;
}
