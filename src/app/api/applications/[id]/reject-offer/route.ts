import { type NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z, ZodError } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { checkRateLimit, defaultLimiter } from '@/lib/rate-limit/limiter';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const rejectOfferSchema = z.object({
  reason: z.string().max(500).optional(),
});

/**
 * POST /api/applications/[id]/reject-offer
 * Applicant declines a lender-approved loan offer.
 * - Allowed only while status === 'approved' (not after acceptance).
 * - Transitions status to 'offer_declined' and stores the optional reason.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['applicant']);

    const allowed = await checkRateLimit(defaultLimiter, auth.uid);
    if (!allowed) {
      throw new AppError('RATE_LIMITED', 429, 'Too many requests');
    }

    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const parsed = rejectOfferSchema.parse(body);

    const appRef = adminDb.collection('loanApplications').doc(id);

    await adminDb.runTransaction(async (tx) => {
      const appSnap = await tx.get(appRef);
      if (!appSnap.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');
      const appData = appSnap.data()!;

      // Ownership: own application OR offline application linked via customerId
      const userSnap = await tx.get(adminDb.collection('users').doc(auth.uid));
      const userCustomerId: string | undefined = userSnap.data()?.customerId;
      const isOwner =
        appData.applicantId === auth.uid ||
        (userCustomerId !== undefined && appData.offlineCustomerId === userCustomerId);
      if (!isOwner) {
        throw new AppError('FORBIDDEN', 403, 'You do not have access to this application');
      }

      if (appData.status !== 'approved') {
        throw new AppError('BAD_REQUEST', 400, 'Only approved offers can be declined');
      }

      const now = FieldValue.serverTimestamp();
      tx.update(appRef, {
        status: 'offer_declined',
        'timeline.offerDeclinedAt': now,
        'timeline.updatedAt': now,
        applicantRejection: {
          rejectedAt: now,
          reason: parsed.reason ?? null,
        },
      });
    });

    await auditLog({
      userId: auth.uid,
      action: 'offer_rejected_by_applicant',
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
      changes: { reason: parsed.reason ?? null },
    });

    return NextResponse.json({ data: { status: 'offer_declined' } }, { status: 200 });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
