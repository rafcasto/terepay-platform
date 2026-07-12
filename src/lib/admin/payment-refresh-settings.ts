import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { PaymentRefreshSettings } from '@/types/admin';
import { DEFAULT_PAYMENT_REFRESH_SETTINGS } from '@/types/admin';

const COLLECTION = 'systemConfig';
const DOC_ID = 'paymentRefresh';

function clampHour(value: unknown): number {
  const n = typeof value === 'number' ? Math.trunc(value) : NaN;
  if (Number.isNaN(n) || n < 0 || n > 23) return DEFAULT_PAYMENT_REFRESH_SETTINGS.refreshHourNzt;
  return n;
}

/**
 * Read the payment-refresh schedule config. Returns defaults (enabled,
 * midnight NZT) when the document does not exist. Fails open — a read error
 * never blocks the cron from using safe defaults.
 */
export async function getPaymentRefreshSettings(): Promise<PaymentRefreshSettings> {
  try {
    const snap = await adminDb.collection(COLLECTION).doc(DOC_ID).get();
    if (!snap.exists) return { ...DEFAULT_PAYMENT_REFRESH_SETTINGS };
    const data = snap.data()!;
    return {
      enabled: data.enabled !== false,
      refreshHourNzt: clampHour(data.refreshHourNzt),
      lastRunDateNzt: typeof data.lastRunDateNzt === 'string' ? data.lastRunDateNzt : undefined,
      lastRunAt: data.lastRunAt,
      lastRunCount: typeof data.lastRunCount === 'number' ? data.lastRunCount : undefined,
      updatedAt: data.updatedAt,
      updatedBy: data.updatedBy,
    };
  } catch {
    return { ...DEFAULT_PAYMENT_REFRESH_SETTINGS };
  }
}

/**
 * Persist admin-editable schedule fields. Call from admin API routes only.
 */
export async function setPaymentRefreshSettings(
  patch: { enabled?: boolean; refreshHourNzt?: number },
  updatedBy: string,
): Promise<void> {
  const clean: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy,
  };
  if (patch.enabled !== undefined) clean.enabled = patch.enabled;
  if (patch.refreshHourNzt !== undefined) clean.refreshHourNzt = clampHour(patch.refreshHourNzt);

  await adminDb.collection(COLLECTION).doc(DOC_ID).set(clean, { merge: true });
}

/**
 * Record that the daily sweep completed for a given NZT date. Used by the cron
 * to dedupe multiple hourly invocations within the same target hour.
 */
export async function markPaymentRefreshRun(dateNzt: string, count: number): Promise<void> {
  await adminDb.collection(COLLECTION).doc(DOC_ID).set(
    {
      lastRunDateNzt: dateNzt,
      lastRunAt: FieldValue.serverTimestamp(),
      lastRunCount: count,
    },
    { merge: true },
  );
}

/**
 * Current hour + date in Pacific/Auckland. Using Intl handles NZ daylight
 * saving automatically, so the cron (which runs in UTC) always compares
 * against real local time.
 */
export function nzNow(now: Date = new Date()): { hour: number; dateNzt: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  // en-CA formats the date as YYYY-MM-DD.
  const dateNzt = `${get('year')}-${get('month')}-${get('day')}`;
  // '24' can appear at midnight in some engines — normalise to 0.
  const rawHour = parseInt(get('hour'), 10);
  const hour = Number.isNaN(rawHour) ? 0 : rawHour % 24;
  return { hour, dateNzt };
}
