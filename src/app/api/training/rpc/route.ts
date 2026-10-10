import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { withAuth } from '@/lib/auth/middleware';
import { trainingRpcSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { assertTrainingAccess } from '@/lib/training/access';
import { trainingRpc } from '@/lib/training/rpc';
import { TRAINING_ADMIN_ONLY_OPS, TRAINING_MUTATING_OPS } from '@/types/training';

export const dynamic = 'force-dynamic';

/**
 * POST /api/training/rpc — read or change console data on the worker
 * (cases, labels, gold reviews, backtest, exams, settings). The op and its
 * arguments are validated here; the worker validates again on its side.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const ip = getClientIp(request);
  let uid = 'unknown';
  let op = 'unknown';

  try {
    const auth = await withAuth(request, ['admin', 'lender']);
    uid = auth.uid;
    const access = await assertTrainingAccess(auth);
    const allowed = await checkRateLimit(defaultLimiter, auth.uid);
    if (!allowed) throw new AppError('RATE_LIMITED', 429, 'Too many requests.');

    const body = await request.json();
    const input = trainingRpcSchema.parse(body);
    op = input.op;
    if (TRAINING_ADMIN_ONLY_OPS.includes(input.op) && !access.isAdmin) {
      throw new AppError('FORBIDDEN', 403, 'Only an admin can do that');
    }

    // Officer attribution for labels/reviews comes from the session, not the form.
    const args: Record<string, unknown> = { ...input };
    delete args.op;
    if (input.op === 'cases.label') args.label = { ...input.label, officer: auth.email };
    if (input.op === 'gold.review') args.review = { ...input.review, officer: auth.email };
    const rpcOp = input.op;

    const data = await trainingRpc<unknown>(rpcOp, args);

    if (TRAINING_MUTATING_OPS.includes(rpcOp)) {
      await auditLog({
        userId: auth.uid,
        action: `training_${rpcOp.replace('.', '_')}`,
        targetId: 'id' in args && typeof args.id === 'string' ? args.id : undefined,
        targetType: 'training_case',
        outcome: 'success',
        ipAddress: ip,
        userAgent: request.headers.get('user-agent') ?? '',
      });
    }

    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);

    console.error('[training/rpc POST]', err);
    await auditLog({
      userId: uid,
      action: 'training_rpc',
      targetType: 'training_case',
      outcome: 'failure',
      changes: { op },
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
    });
    return internalError();
  }
}
