import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { adminReassignApplicationsSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// POST /api/admin/applications/reassign — bulk reassign applications to a lender
export async function POST(request: NextRequest): Promise<Response> {
  const ip = getClientIp(request);
  let uid = 'unknown';

  try {
    const allowed = await checkRateLimit(defaultLimiter, ip);
    if (!allowed) {
      return errorResponse(new AppError('RATE_LIMITED', 429, 'Too many requests.'));
    }

    const auth = await withAuth(request, ['admin']);
    uid = auth.uid;

    const body = await request.json();
    const { applicationIds, targetLenderId } = adminReassignApplicationsSchema.parse(body);

    // Verify target lender exists and is active
    const lenderSnap = await adminDb.collection('users').doc(targetLenderId).get();
    if (!lenderSnap.exists) {
      throw new AppError('NOT_FOUND', 404, 'Target lender not found');
    }
    const lenderData = lenderSnap.data()!;
    if (lenderData.role !== 'lender') {
      throw new AppError('VALIDATION_ERROR', 422, 'Target user is not a lender');
    }
    if (lenderData.status === 'inactive') {
      throw new AppError('VALIDATION_ERROR', 422, 'Cannot assign applications to an inactive lender');
    }

    // Firestore batch write: max 500 per batch
    const BATCH_SIZE = 400;
    let updated = 0;
    const errors: string[] = [];

    for (let i = 0; i < applicationIds.length; i += BATCH_SIZE) {
      const chunk = applicationIds.slice(i, i + BATCH_SIZE);
      const batch = adminDb.batch();

      for (const appId of chunk) {
        const appRef = adminDb.collection('loanApplications').doc(appId);
        batch.update(appRef, {
          assignedLenderId: targetLenderId,
          'underwriting.underwriterIds': FieldValue.arrayUnion(targetLenderId),
          'timeline.updatedAt': FieldValue.serverTimestamp(),
        });
      }

      try {
        await batch.commit();
        updated += chunk.length;
      } catch {
        errors.push(`Batch ${i / BATCH_SIZE + 1} failed`);
      }
    }

    await auditLog({
      userId: uid,
      action: 'admin_reassign_applications',
      targetId: targetLenderId,
      targetType: 'loanApplications',
      outcome: errors.length === 0 ? 'success' : 'failure',
      changes: { applicationIds, targetLenderId, updated },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    if (errors.length > 0) {
      return NextResponse.json({ data: { updated, errors } }, { status: 207 });
    }

    return NextResponse.json({ data: { updated } });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);

    await auditLog({
      userId: uid,
      action: 'admin_reassign_applications',
      targetType: 'loanApplications',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
    });
    return internalError();
  }
}
