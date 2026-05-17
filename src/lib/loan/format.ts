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

export function fmtDate(d: DateInput): string {
  const date = toDate(d);
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium' }).format(date);
}

export function fmtDateTime(d: DateInput): string {
  const date = toDate(d);
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function fmtDateShort(d: DateInput): string {
  const date = toDate(d);
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-NZ', { day: 'numeric', month: 'short' }).format(date);
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
