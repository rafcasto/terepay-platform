import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { withAuth } from '@/lib/auth/middleware';
import { updateApplicationSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { FieldValue } from 'firebase-admin/firestore';
import { ZodError } from 'zod';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/applications/[id]
 * Applicant can read their own; lender can read any.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request);
    const { id } = await params;

    const doc = await adminDb.collection('loanApplications').doc(id).get();
    if (!doc.exists) {
      throw new AppError('NOT_FOUND', 404, 'Application not found');
    }

    const data = doc.data()!;

    // Enforce ownership for applicants
    if (auth.role === 'applicant' && data.applicantId !== auth.uid) {
      throw new AppError('FORBIDDEN', 403, 'You do not have access to this application');
    }

    return NextResponse.json({ data: { id: doc.id, ...data } });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}

/**
 * PATCH /api/applications/[id]
 * Applicant can update their own draft applications.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['applicant']);
    const { id } = await params;

    await checkRateLimit(defaultLimiter, auth.uid);

    const doc = await adminDb.collection('loanApplications').doc(id).get();
    if (!doc.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');

    const data = doc.data()!;
    if (data.applicantId !== auth.uid) {
      throw new AppError('FORBIDDEN', 403, 'You do not have access to this application');
    }

    if (data.status !== 'draft') {
      throw new AppError('BAD_REQUEST', 400, 'Only draft applications can be edited');
    }

    const body = await request.json();
    const parsed = updateApplicationSchema.parse(body);

    await adminDb
      .collection('loanApplications')
      .doc(id)
      .update({ ...parsed, 'timeline.updatedAt': FieldValue.serverTimestamp() });

    await auditLog({
      userId: auth.uid,
      action: 'application_updated',
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
    });

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(
        new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors),
      );
    }
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}

/**
 * DELETE /api/applications/[id]
 * Applicant can delete their own draft applications.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['applicant']);
    const { id } = await params;

    const doc = await adminDb.collection('loanApplications').doc(id).get();
    if (!doc.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');

    const data = doc.data()!;
    if (data.applicantId !== auth.uid) {
      throw new AppError('FORBIDDEN', 403, 'You do not have access to this application');
    }

    if (data.status !== 'draft') {
      throw new AppError('BAD_REQUEST', 400, 'Only draft applications can be deleted');
    }

    await adminDb.collection('loanApplications').doc(id).delete();

    await auditLog({
      userId: auth.uid,
      action: 'application_deleted',
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
    });

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
