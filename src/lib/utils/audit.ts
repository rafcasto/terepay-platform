import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

type AuditEntry = {
  userId: string;
  action: string;
  targetId?: string;
  targetType?: string;
  outcome: 'success' | 'failure';
  changes?: Record<string, unknown>;
  errorDetail?: string;
  ipAddress?: string;
  userAgent?: string;
};

/** True only for plain objects (`{}`), never class instances like Timestamp/FieldValue. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Recursively drop `undefined` values — Firestore rejects them and would
 * otherwise fail the whole audit write. Firestore sentinels and special
 * types (Timestamp, FieldValue, GeoPoint, …) have non-plain prototypes and
 * are left untouched.
 */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (v === undefined) continue;
      out[key] = stripUndefined(v);
    }
    return out as unknown as T;
  }
  return value;
}

/**
 * Write an audit log entry. Never throws — a failed audit write must not
 * block or surface errors to the end user.
 */
export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await adminDb.collection('auditLogs').add({
      ...stripUndefined(entry),
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('[audit] Failed to write audit log', entry, err);
  }
}

/**
 * Extract the client IP address from Vercel's edge-set x-forwarded-for header.
 * The first value is reliable on Vercel infrastructure.
 * Treat as best-effort — never use as a sole security signal.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() ?? 'unknown';
}
