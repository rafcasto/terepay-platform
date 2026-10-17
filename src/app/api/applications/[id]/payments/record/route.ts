import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { recordManualPaymentSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { checkRateLimit, defaultLimiter } from '@/lib/rate-limit/limiter';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { assertManualRepaymentsMode } from '@/lib/qippay/feature';
import { recordManualPayment } from '@/lib/loan/manual-payments';
import { toPlainScheduledPayments } from '@/lib/loan/active-loan';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/applications/[id]/payments/record
 *
 * Lender records a repayment received outside Qippay (bank transfer, cash at
 * the counter) against one instalment, or reverses a mistaken entry.
 * Available only while the Qippay feature flag is OFF — once Qippay collects
 * instalments the bank's word is final and this route returns 409.
 *
 * Body: { installmentNumber, action: 'mark_paid' | 'mark_unpaid', paidOn?, reference? }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  let applicationId = '';

  try {
    await assertManualRepaymentsMode();

    const auth = await withAuth(request, ['lender']);

    const allowed = await checkRateLimit(defaultLimiter, auth.uid);
    if (!allowed) throw new AppError('RATE_LIMITED', 429, 'Too many requests');

    const { id } = await params;
    applicationId = id;

    const parsed = recordManualPaymentSchema.parse(await request.json().catch(() => ({})));

    // Resolve the lender's display name for the audit trail on the instalment.
    const lenderSnap = await adminDb.collection('users').doc(auth.uid).get();
    const lenderData = lenderSnap.data();
    const lenderName = lenderData
      ? `${lenderData.firstName ?? ''} ${lenderData.lastName ?? ''}`.trim() || undefined
      : undefined;

    const result = await recordManualPayment({
      applicationId: id,
      installmentNumber: parsed.installmentNumber,
      action: parsed.action,
      paidOn: parsed.paidOn,
      reference: parsed.reference || undefined,
      actor: { uid: auth.uid, name: lenderName },
      ip,
    });

    return NextResponse.json({
      data: {
        status: result.status,
        paidCount: result.paidCount,
        totalCount: result.totalCount,
        scheduledPayments: toPlainScheduledPayments(result.payments),
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(
        new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors),
      );
    }
    if (err instanceof AppError) return errorResponse(err);

    await auditLog({
      userId: 'unknown',
      action: 'manual_payment_recorded',
      targetId: applicationId,
      targetType: 'application',
      outcome: 'failure',
      ipAddress: ip,
    });
    return internalError();
  }
}
