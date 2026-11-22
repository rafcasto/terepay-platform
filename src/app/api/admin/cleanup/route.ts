import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { withAuth } from '@/lib/auth/middleware';
import { adminCleanupSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { checkRateLimit, defaultLimiter } from '@/lib/rate-limit/limiter';
import {
  deleteApplicationCascade,
  deleteBorrowerCascade,
  listCleanupCandidates,
  type DeleteApplicationSummary,
  type DeleteBorrowerSummary,
} from '@/lib/admin/cleanup';

export const dynamic = 'force-dynamic';

const CLEANUP_CONFIRMATION = 'DELETE DATA';

// Tight limit — 10 cleanup runs per 10 minutes per admin.
function makeCleanupLimiter() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.fixedWindow(10, '10 m'),
    prefix: 'rl:admin:cleanup',
  });
}
const cleanupLimiter = makeCleanupLimiter();

// GET /api/admin/cleanup — borrowers and applications an admin may delete.
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const auth = await withAuth(request, ['admin']);
    const allowed = await checkRateLimit(defaultLimiter, auth.uid);
    if (!allowed) throw new AppError('RATE_LIMITED', 429, 'Too many requests');

    const data = await listCleanupCandidates();
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}

/**
 * POST /api/admin/cleanup — delete selected borrowers and/or applications.
 *
 * Body: { userIds?: string[], applicationIds?: string[], includeLiveLoans?: boolean }
 * Header: x-cleanup-confirmation: "DELETE DATA"
 *
 * Each record is deleted independently; a refusal (live loan, staff account,
 * not found) is reported per record and does not stop the rest.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const ip = getClientIp(request);
  let adminUid = 'unknown';

  try {
    const auth = await withAuth(request, ['admin']);
    adminUid = auth.uid;

    const allowed = await checkRateLimit(cleanupLimiter, adminUid);
    if (!allowed) {
      throw new AppError('RATE_LIMITED', 429, 'Too many cleanup runs — wait a few minutes and try again.');
    }

    if (request.headers.get('x-cleanup-confirmation') !== CLEANUP_CONFIRMATION) {
      throw new AppError('VALIDATION_ERROR', 422, 'Missing or incorrect cleanup confirmation.');
    }

    const body = adminCleanupSchema.parse(await request.json().catch(() => ({})));
    const includeLiveLoans = body.includeLiveLoans === true;

    const borrowers: DeleteBorrowerSummary[] = [];
    const applications: DeleteApplicationSummary[] = [];
    const refused: { id: string; kind: 'borrower' | 'application'; reason: string }[] = [];

    for (const uid of body.userIds ?? []) {
      try {
        borrowers.push(await deleteBorrowerCascade({ uid, includeLiveLoans, actor: adminUid, ip }));
      } catch (err) {
        if (err instanceof AppError) refused.push({ id: uid, kind: 'borrower', reason: err.message });
        else throw err;
      }
    }

    for (const applicationId of body.applicationIds ?? []) {
      try {
        applications.push(
          await deleteApplicationCascade({ applicationId, includeLiveLoans, actor: adminUid, ip }),
        );
      } catch (err) {
        if (err instanceof AppError) {
          // Already gone because its borrower was deleted above — not a failure.
          if (err.code === 'NOT_FOUND' && borrowers.length > 0) continue;
          refused.push({ id: applicationId, kind: 'application', reason: err.message });
        } else {
          throw err;
        }
      }
    }

    await auditLog({
      userId: adminUid,
      action: 'admin_cleanup_run',
      targetId: 'global',
      targetType: 'system',
      outcome: 'success',
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
      changes: {
        borrowersDeleted: borrowers.length,
        applicationsDeleted: applications.length,
        refused: refused.length,
        includeLiveLoans,
      },
    });

    return NextResponse.json({ data: { borrowers, applications, refused } });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);

    await auditLog({
      userId: adminUid,
      action: 'admin_cleanup_run',
      targetType: 'system',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
    });
    return internalError();
  }
}
