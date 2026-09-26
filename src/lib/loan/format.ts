// NZ-locale formatting helpers used by the applicant design system.
// Mirrors the utilities defined in design_handoff_terepay_loan_app/Loan Tracking.html.

export function fmtNZD(n: number | undefined | null, opts: { cents?: boolean } = {}): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '—';
  const cents = opts.cents ?? true;
  return new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(n);
}

export function fmtNZDCompact(n: number | undefined | null): string {
  return fmtNZD(n, { cents: false });
}

type DateInput = Date | string | FirestoreTsLike | null | undefined;

/** Every customer-facing date in TerePay is rendered in NZ local time. */
export const NZ_TIME_ZONE = 'Pacific/Auckland';

const NZ_DATE = new Intl.DateTimeFormat('en-NZ', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: NZ_TIME_ZONE,
});
const NZ_TIME = new Intl.DateTimeFormat('en-NZ', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: NZ_TIME_ZONE,
});

/** `dd/MM/yyyy` — the NZ date format used everywhere a date is shown. */
export function fmtDate(d: DateInput): string {
  const date = toDate(d);
  if (!date) return '—';
  return NZ_DATE.format(date);
}

/** `dd/MM/yyyy HH:mm` (24-hour, NZ time). */
export function fmtDateTime(d: DateInput): string {
  const date = toDate(d);
  if (!date) return '—';
  return `${NZ_DATE.format(date)} ${NZ_TIME.format(date)}`;
}

/** `dd/MM` — for tight layouts where the year is obvious from context. */
export function fmtDateShort(d: DateInput): string {
  const date = toDate(d);
  if (!date) return '—';
  return NZ_DATE.format(date).slice(0, 5);
}

/**
 * Format a calendar-date string (`YYYY-MM-DD`, as stored for DOB, visa /
 * passport expiry, statement dates, instalment due dates) as `dd/MM/yyyy`
 * without going through a timezone conversion. Anything that isn't a plain
 * calendar date falls back to {@link fmtDate}.
 */
export function fmtYmd(ymd: string | null | undefined): string {
  if (!ymd) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd.trim());
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return fmtDate(ymd);
}

export function daysUntil(d: DateInput): number | null {
  const date = toDate(d);
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

export function fmtBytes(n: number | undefined | null): string {
  if (!n || n < 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// Firestore Timestamp-ish shape (server-resolved or client-resolved).
type FirestoreTsLike = { _seconds?: number; seconds?: number; toDate?: () => Date };

export function toDate(d: Date | string | FirestoreTsLike | null | undefined): Date | null {
  if (!d) return null;
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
  if (typeof d === 'string') {
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof d === 'object') {
    if (typeof d.toDate === 'function') {
      const result = d.toDate();
      return result instanceof Date && !isNaN(result.getTime()) ? result : null;
    }
    const s = d._seconds ?? d.seconds;
    if (typeof s === 'number') return new Date(s * 1000);
  }
  return null;
}
