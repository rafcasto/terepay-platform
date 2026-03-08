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

/**
 * Write an audit log entry. Never throws — a failed audit write must not
 * block or surface errors to the end user.
 */
export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await adminDb.collection('auditLogs').add({
      ...entry,
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
