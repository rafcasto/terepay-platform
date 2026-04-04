import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ customerId: string }> };

const statusSchema = z.object({
  isExistingCustomer: z.boolean(),
});

const TERE_ID_RE = /^TERE\d{3,}$/;

/**
 * PATCH /api/customers/[customerId]/status
 * Lender only. Sets isExistingCustomer on an online or offline customer record.
 * [customerId] is either a Firebase UID (online applicant) or a TEREXXXX ID (offline customer).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['lender']);
    const { customerId } = await params;

    const body = await request.json();
    const { isExistingCustomer } = statusSchema.parse(body);

    const now = FieldValue.serverTimestamp();
    const isOffline = TERE_ID_RE.test(customerId);

    if (isOffline) {
      const docRef = adminDb.collection('offlineCustomers').doc(customerId);
      const snap = await docRef.get();
      if (!snap.exists) throw new AppError('NOT_FOUND', 404, 'Customer not found');
      await docRef.update({ isExistingCustomer, updatedAt: now });
    } else {
      const docRef = adminDb.collection('users').doc(customerId);
      const snap = await docRef.get();
      if (!snap.exists || snap.data()?.role !== 'applicant') {
        throw new AppError('NOT_FOUND', 404, 'Customer not found');
      }
      await docRef.update({ isExistingCustomer, updatedAt: now });
    }

    await auditLog({
      userId: auth.uid,
      action: 'customer_status_updated',
      targetId: customerId,
      targetType: isOffline ? 'offline_customer' : 'user',
      outcome: 'success',
      changes: { isExistingCustomer },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    return NextResponse.json({ data: { isExistingCustomer } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 400, err.issues[0]?.message ?? 'Invalid input'));
    }
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
