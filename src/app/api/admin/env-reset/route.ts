import { type NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { checkRateLimit } from '@/lib/rate-limit/limiter';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { envResetEnabled } from '@/lib/flags/flags';

export const dynamic = 'force-dynamic';

// Very tight rate limit — 1 reset per 10 minutes per uid
function makeResetLimiter() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.fixedWindow(1, '10 m'),
    prefix: 'rl:admin:env-reset',
  });
}
const resetLimiter = makeResetLimiter();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Delete all documents in a Firestore collection using paginated batches.
 * Returns the count of deleted documents.
 */
async function deleteCollection(path: string, batchSize = 400): Promise<number> {
  let deleted = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await adminDb.collection(path).limit(batchSize).get();
    if (snap.empty) break;

    const batch = adminDb.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;

    if (snap.size < batchSize) break;
  }
  return deleted;
}

/**
 * Delete all subcollection documents under users/{uid}.
 * Handles applicantProfile and lenderProfile subcollections.
 */
async function deleteUserSubcollections(uid: string): Promise<void> {
  await Promise.all([
    deleteCollection(`users/${uid}/applicantProfile`),
    deleteCollection(`users/${uid}/lenderProfile`),
  ]);
}

/**
 * Delete all non-admin users from Firebase Auth.
 * Returns { deleted, preserved } counts.
 */
async function purgeAuthUsers(adminUids: Set<string>): Promise<{ deleted: number; preserved: number }> {
  const toDelete: string[] = [];
  let pageToken: string | undefined;

  do {
    const result = await adminAuth.listUsers(1000, pageToken);
    for (const user of result.users) {
      if (adminUids.has(user.uid)) continue;
      toDelete.push(user.uid);
    }
    pageToken = result.pageToken;
  } while (pageToken);

  // Firebase Admin deleteUsers supports up to 1000 UIDs per call
  const CHUNK = 1000;
  for (let i = 0; i < toDelete.length; i += CHUNK) {
    await adminAuth.deleteUsers(toDelete.slice(i, i + CHUNK));
  }

  return { deleted: toDelete.length, preserved: adminUids.size };
}

/**
 * Delete all non-admin user documents from Firestore.
 * Subcollections are deleted first to avoid orphaned data.
 * Returns count of deleted user docs.
 */
async function purgeFirestoreUsers(adminUids: Set<string>): Promise<number> {
  const snap = await adminDb.collection('users').get();
  let deleted = 0;

  // Process in parallel batches of 10 users
  const nonAdminDocs = snap.docs.filter((doc) => !adminUids.has(doc.id));

  const CONCURRENCY = 10;
  for (let i = 0; i < nonAdminDocs.length; i += CONCURRENCY) {
    const chunk = nonAdminDocs.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (doc) => {
        await deleteUserSubcollections(doc.id);
        await doc.ref.delete();
      }),
    );
    deleted += chunk.length;
  }

  return deleted;
}

// Collections to fully wipe (no exceptions within them)
const WIPEABLE_COLLECTIONS = [
  'loanApplications',
  'loans',
  'payments',
  'auditLogs',
  'offlineCustomers',
  'notifications',
  'benchmarks',
] as const;

// ---------------------------------------------------------------------------
// POST /api/admin/env-reset
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<Response> {
  const ip = getClientIp(request);
  let uid = 'unknown';

  try {
    // 1. Auth — admin only
    const auth = await withAuth(request, ['admin']);
    uid = auth.uid;

    // 2. Rate limit — very tight, keyed on uid
    const allowed = await checkRateLimit(resetLimiter, uid);
    if (!allowed) {
      return errorResponse(
        new AppError('RATE_LIMITED', 429, 'Environment reset can only be triggered once every 10 minutes.'),
      );
    }

    // 3. Feature flag gate — must be enabled in Vercel dashboard
    const isEnabled = await envResetEnabled();
    if (!isEnabled) {
      return errorResponse(
        new AppError(
          'FORBIDDEN',
          403,
          'Environment reset is disabled. Enable the `env_reset_enabled` flag in the Vercel dashboard first.',
        ),
      );
    }

    // 4. Confirmation header — client must send the magic value
    const confirmation = request.headers.get('x-reset-confirmation');
    if (confirmation !== 'RESET ENVIRONMENT') {
      return errorResponse(
        new AppError('VALIDATION_ERROR', 422, 'Missing or incorrect reset confirmation header.'),
      );
    }

    // 5. Collect admin UIDs from Firestore — these are protected
    const adminSnap = await adminDb.collection('users').where('role', '==', 'admin').get();
    const adminUids = new Set(adminSnap.docs.map((d) => d.id));

    if (adminUids.size === 0) {
      // Safeguard: never proceed if we can't identify any admin to preserve
      throw new AppError('INTERNAL_ERROR', 500, 'No admin users found — aborting reset to prevent lockout.');
    }

    const summary: Record<string, number> = {};

    // 6. Purge Auth users (non-admins)
    const authResult = await purgeAuthUsers(adminUids);
    summary.authUsersDeleted = authResult.deleted;
    summary.authUsersPreserved = authResult.preserved;

    // 7. Purge Firestore — user docs + subcollections
    summary.firestoreUsersDeleted = await purgeFirestoreUsers(adminUids);

    // 8. Wipe all other collections in parallel
    const wipeResults = await Promise.all(
      WIPEABLE_COLLECTIONS.map(async (col) => {
        const count = await deleteCollection(col);
        return [col, count] as const;
      }),
    );
    for (const [col, count] of wipeResults) {
      summary[col] = count;
    }

    // 9. Audit log — written after the fact so it doesn't get deleted
    await auditLog({
      userId: uid,
      action: 'admin_env_reset',
      targetId: 'global',
      targetType: 'system',
      outcome: 'success',
      changes: summary,
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    return NextResponse.json({ data: { summary } });
  } catch (err) {
    await auditLog({
      userId: uid,
      action: 'admin_env_reset',
      targetType: 'system',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
    });

    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
