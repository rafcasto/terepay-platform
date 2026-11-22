import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { revertArrearsSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { checkRateLimit, defaultLimiter } from '@/lib/rate-limit/limiter';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { revertArrearsForApplication } from '@/lib/loan/revert-arrears';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/applications/[id]/arrears/revert
 *
 * Assigned lender removes every arrears charge the engine put on this loan
 * (late fees, default fee, accrued overdue interest) — the undo for an
 * "Assess arrears now" that was run by mistake. The removed charges are kept
 * on the loan under `arrearsReversals` and the action is audit-logged.
 *
 * Body: { reason: string }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  let applicationId = '';

  try {
    const auth = await withAuth(request, ['lender']);

    const allowed = await checkRateLimit(defaultLimiter, auth.uid);
    if (!allowed) throw new AppError('RATE_LIMITED', 429, 'Too many requests');

    const { id } = await params;
    applicationId = id;

    const parsed = revertArrearsSchema.parse(await request.json().catch(() => ({})));

    const lenderSnap = await adminDb.collection('users').doc(auth.uid).get();
    const lenderData = lenderSnap.data();
    const lenderName = lenderData
      ? `${lenderData.firstName ?? ''} ${lenderData.lastName ?? ''}`.trim() || undefined
      : undefined;

    const result = await revertArrearsForApplication({
      applicationId: id,
      reason: parsed.reason,
      actor: { uid: auth.uid, name: lenderName },
      ip,
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(
        new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors),
      );
    }
    if (err instanceof AppError) return errorResponse(err);

    await auditLog({
      userId: 'unknown',
      action: 'arrears_reverted',
      targetId: applicationId,
      targetType: 'application',
      outcome: 'failure',
      ipAddress: ip,
    });
    return internalError();
  }
}
