import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { AppError } from '@/lib/utils/api-error';
import type { SetPayTestSettings } from '@/types/admin';
import {
  DEFAULT_SETPAY_TEST_SETTINGS,
  SETPAY_TEST_INTERVAL_MAX,
  SETPAY_TEST_INTERVAL_MIN,
} from '@/types/admin';

const COLLECTION = 'systemConfig';
const DOC_ID = 'setpayTesting';

export function isProductionEnvironment(): boolean {
  return process.env.NEXT_PUBLIC_ENVIRONMENT === 'production';
}

function clampInterval(value: unknown): number {
  const n = typeof value === 'number' ? Math.trunc(value) : NaN;
  if (Number.isNaN(n) || n < SETPAY_TEST_INTERVAL_MIN || n > SETPAY_TEST_INTERVAL_MAX) {
    return DEFAULT_SETPAY_TEST_SETTINGS.intervalMinutes;
  }
  return n;
}

/**
 * Read the SetPay test-cadence config. Fails closed: a read error, or a
 * production build, yields `enabled: false` so real loans are never
 * scheduled minutes apart by accident.
 */
export async function getSetPayTestSettings(): Promise<SetPayTestSettings> {
  const locked = isProductionEnvironment();
  try {
    const snap = await adminDb.collection(COLLECTION).doc(DOC_ID).get();
    if (!snap.exists) {
      return { ...DEFAULT_SETPAY_TEST_SETTINGS, lockedInProduction: locked };
    }
    const data = snap.data()!;
    return {
      enabled: !locked && data.enabled === true,
      intervalMinutes: clampInterval(data.intervalMinutes),
      lockedInProduction: locked,
      lastVerifyAt: data.lastVerifyAt,
      lastVerifyCount: typeof data.lastVerifyCount === 'number' ? data.lastVerifyCount : undefined,
      updatedAt: data.updatedAt,
      updatedBy: data.updatedBy,
    };
  } catch {
    return { ...DEFAULT_SETPAY_TEST_SETTINGS, lockedInProduction: locked };
  }
}

/**
 * Persist admin-editable fields. Refuses to enable in production. Call from
 * admin API routes only.
 */
export async function setSetPayTestSettings(
  patch: { enabled?: boolean; intervalMinutes?: number },
  updatedBy: string,
): Promise<void> {
  if (patch.enabled === true && isProductionEnvironment()) {
    throw new AppError(
      'FORBIDDEN_IN_PRODUCTION',
      403,
      'SetPay test cadence cannot be enabled in production.',
    );
  }

  const clean: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy,
  };
  if (patch.enabled !== undefined) clean.enabled = patch.enabled;
  if (patch.intervalMinutes !== undefined) clean.intervalMinutes = clampInterval(patch.intervalMinutes);

  await adminDb.collection(COLLECTION).doc(DOC_ID).set(clean, { merge: true });
}

/** Record that an admin-triggered verification sweep completed. */
export async function markSetPayTestVerifyRun(count: number): Promise<void> {
  await adminDb.collection(COLLECTION).doc(DOC_ID).set(
    { lastVerifyAt: FieldValue.serverTimestamp(), lastVerifyCount: count },
    { merge: true },
  );
}

/**
 * Compute instalment fire times for a test-cadence schedule: instalment k
 * fires `anchor + k × intervalMinutes`. Returns ISO datetimes (UTC) plus the
 * matching NZ calendar date, which is what the rest of the loan engine keys on.
 */
export function buildTestCadenceTimes(
  count: number,
  intervalMinutes: number,
  anchor: Date = new Date(),
): Array<{ dueAt: string; dueDate: string }> {
  const interval = clampInterval(intervalMinutes);
  return Array.from({ length: count }, (_, i) => {
    const at = new Date(anchor.getTime() + (i + 1) * interval * 60_000);
    return {
      dueAt: at.toISOString(),
      dueDate: at.toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' }),
    };
  });
}
