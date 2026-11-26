import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { checkRateLimit, defaultLimiter } from '@/lib/rate-limit/limiter';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { CUSTOMER_ID_RE, renameCustomerId } from '@/lib/customers/customer-id';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ customerId: string }> };

const changeIdSchema = z.object({
  newCustomerId: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(CUSTOMER_ID_RE, 'Customer ID must look like TERE001')),
});

/**
 * POST /api/customers/[customerId]/change-id
 * Lender only. Changes a customer's friendly TerePay ID.
 *
 * `[customerId]` is either the current TERE ID (offline customer) or the
 * Firebase UID of an online applicant who already holds a TERE ID. Every
 * record that quotes the old ID is repointed in one transaction — see
 * `renameCustomerId()`.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  let actorUid: string | undefined;
  let currentCustomerId: string | undefined;
  try {
    const auth = await withAuth(request, ['lender']);
    actorUid = auth.uid;
    await checkRateLimit(defaultLimiter, auth.uid);

    const { customerId } = await params;
    const { newCustomerId } = changeIdSchema.parse(await request.json());

    if (CUSTOMER_ID_RE.test(customerId)) {
      currentCustomerId = customerId;
    } else {
      // Online applicant — their TERE ID lives on the user document.
      const userSnap = await adminDb.collection('users').doc(customerId).get();
      const userData = userSnap.data();
      if (!userSnap.exists || userData?.role !== 'applicant') {
        throw new AppError('NOT_FOUND', 404, 'Customer not found');
      }
      if (typeof userData.customerId !== 'string' || !userData.customerId) {
        throw new AppError('BAD_REQUEST', 400, 'This customer has not been assigned a customer ID yet');
      }
      currentCustomerId = userData.customerId;
    }

    const result = await renameCustomerId(adminDb, { currentCustomerId, newCustomerId });

    await auditLog({
      userId: auth.uid,
      action: 'customer_id_changed',
      targetId: result.customerId,
      targetType: result.offlineRecordMoved ? 'offlineCustomer' : 'onlineCustomer',
      outcome: 'success',
      changes: {
        previousCustomerId: result.previousCustomerId,
        customerId: result.customerId,
        usersUpdated: result.usersUpdated,
        applicationsUpdated: result.applicationsUpdated,
      },
      ipAddress: ip,
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 400, err.issues[0]?.message ?? 'Invalid input'));
    }
    if (err instanceof AppError) {
      if (err.statusCode === 409 && actorUid) {
        await auditLog({
          userId: actorUid,
          action: 'customer_id_changed',
          targetId: currentCustomerId ?? 'unknown',
          targetType: 'customer',
          outcome: 'failure',
          errorDetail: err.message,
          ipAddress: ip,
        }).catch(() => undefined);
      }
      return errorResponse(err);
    }
    console.error('[POST /api/customers/change-id]', err);
    return internalError();
  }
}
