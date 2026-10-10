import Decimal from 'decimal.js';

/**
 * Decimal-safe currency helpers for the collections engine (NFR-1, FR-16).
 *
 * All internal calculation keeps full precision via `decimal.js`; we round to
 * cents ONLY when a figure is (a) debited/credited to the ledger as a real
 * money movement, or (b) reported as a final output. Never use the JS `number`
 * type for intermediate money math in the engine.
 */

// 20 significant digits is ample for an 8-week loan accruing daily; ROUND_HALF_EVEN
// is banker's rounding — the CCCFA-safe convention for splitting a half-cent.
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_EVEN });

export type Money = Decimal;

export function money(value: Decimal.Value): Money {
  return new Decimal(value);
}

export const ZERO: Money = new Decimal(0);

/** Round to whole cents using banker's rounding (half-to-even). */
export function toCents(value: Decimal.Value): Money {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
}

/** Final reported figure: a `number` rounded to 2dp. Use only at the boundary. */
export function toNumber(value: Decimal.Value): number {
  return toCents(value).toNumber();
}

/** Format as NZD, e.g. `$1,067.00` (two decimals, comma thousands). */
export function formatNzd(value: Decimal.Value): string {
  const n = toCents(value).toNumber();
  return n.toLocaleString('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
