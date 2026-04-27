import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { checkRateLimit, defaultLimiter } from '@/lib/rate-limit/limiter';
import { auditLog, getClientIp } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ customerId: string }> };

const TERE_ID_RE = /^TERE\d{3,}$/;

const updateOfflineSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(30).optional(),
  notes: z.string().max(1000).optional(),
});

const updateOnlineSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().min(7).max(30).optional(),
});

/**
 * PATCH /api/customers/[customerId]
 * Lender only. Updates editable fields on an online or offline customer.
 * - Online (Firebase UID): firstName, lastName, phone
 * - Offline (TEREXXXX): firstName, lastName, phone, notes, email
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['lender']);
    await checkRateLimit(defaultLimiter, auth.uid);

    const { customerId } = await params;
    const body = await request.json();

    const now = FieldValue.serverTimestamp();
    const isOffline = TERE_ID_RE.test(customerId);

    if (isOffline) {
      const parsed = updateOfflineSchema.parse(body);
      const docRef = adminDb.collection('offlineCustomers').doc(customerId);
      const snap = await docRef.get();
      if (!snap.exists) throw new AppError('NOT_FOUND', 404, 'Customer not found');

      const updates: Record<string, unknown> = {
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        updatedAt: now,
      };
      if (parsed.phone !== undefined) updates.phone = parsed.phone;
      if (parsed.notes !== undefined) updates.notes = parsed.notes;
      if (parsed.email !== undefined) updates.email = parsed.email;

      await docRef.update(updates);

      await auditLog({
        userId: auth.uid,
        action: 'customer_updated',
        targetId: customerId,
        targetType: 'offlineCustomer',
        outcome: 'success',
        changes: parsed,
        ipAddress: ip,
      });

      return NextResponse.json({ data: { customerId, ...parsed } });
    } else {
      const parsed = updateOnlineSchema.parse(body);
      const docRef = adminDb.collection('users').doc(customerId);
      const snap = await docRef.get();
      if (!snap.exists || snap.data()?.role !== 'applicant') {
        throw new AppError('NOT_FOUND', 404, 'Customer not found');
      }

      const updates: Record<string, unknown> = {
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        updatedAt: now,
      };
      if (parsed.phone !== undefined) updates.phoneNumber = parsed.phone;

      await docRef.update(updates);

      await auditLog({
        userId: auth.uid,
        action: 'customer_updated',
        targetId: customerId,
        targetType: 'onlineCustomer',
        outcome: 'success',
        changes: parsed,
        ipAddress: ip,
      });

      return NextResponse.json({ data: { customerId, ...parsed } });
    }
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: err.errors[0].message },
        { status: 400 },
      );
    }
    return internalError(err);
  }
}
