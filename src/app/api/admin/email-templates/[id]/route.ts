import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { adminEmailTemplatePatchSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { FieldValue } from 'firebase-admin/firestore';
import { EMAIL_TEMPLATE_TYPE_CATEGORY } from '@/types/admin';
import type { EmailTemplateType } from '@/types/admin';

export const dynamic = 'force-dynamic';

// GET /api/admin/email-templates/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const auth = await withAuth(request, ['admin']);
    await checkRateLimit(defaultLimiter, auth.uid);

    const { id } = await params;
    const snap = await adminDb.collection('emailTemplates').doc(id).get();
    if (!snap.exists) throw new AppError('NOT_FOUND', 404, 'Template not found');

    const d = snap.data()!;
    return NextResponse.json({
      data: {
        id: snap.id,
        ...d,
        createdAt: d.createdAt?.toMillis?.() ?? null,
        updatedAt: d.updatedAt?.toMillis?.() ?? null,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}

// PATCH /api/admin/email-templates/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const ip = getClientIp(request);
  let uid = 'unknown';

  try {
    const allowed = await checkRateLimit(defaultLimiter, ip);
    if (!allowed) {
      return errorResponse(new AppError('RATE_LIMITED', 429, 'Too many requests.'));
    }

    const auth = await withAuth(request, ['admin']);
    uid = auth.uid;

    const { id } = await params;

    const snap = await adminDb.collection('emailTemplates').doc(id).get();
    if (!snap.exists) throw new AppError('NOT_FOUND', 404, 'Template not found');

    const body = await request.json();
    const patch = adminEmailTemplatePatchSchema.parse(body);

    const update: Record<string, unknown> = {
      ...patch,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Recalculate category if type is changing
    if (patch.type) {
      update.category = EMAIL_TEMPLATE_TYPE_CATEGORY[patch.type as EmailTemplateType];
    }

    await adminDb.collection('emailTemplates').doc(id).update(update);

    await auditLog({
      userId: uid,
      action: 'admin_update_email_template',
      targetId: id,
      targetType: 'emailTemplates',
      outcome: 'success',
      changes: patch,
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    return NextResponse.json({ data: { id } });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);

    await auditLog({
      userId: uid,
      action: 'admin_update_email_template',
      targetType: 'emailTemplates',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
    });
    return internalError();
  }
}

// DELETE /api/admin/email-templates/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const ip = getClientIp(request);
  let uid = 'unknown';

  try {
    const allowed = await checkRateLimit(defaultLimiter, ip);
    if (!allowed) {
      return errorResponse(new AppError('RATE_LIMITED', 429, 'Too many requests.'));
    }

    const auth = await withAuth(request, ['admin']);
    uid = auth.uid;

    const { id } = await params;

    const snap = await adminDb.collection('emailTemplates').doc(id).get();
    if (!snap.exists) throw new AppError('NOT_FOUND', 404, 'Template not found');

    await adminDb.collection('emailTemplates').doc(id).delete();

    await auditLog({
      userId: uid,
      action: 'admin_delete_email_template',
      targetId: id,
      targetType: 'emailTemplates',
      outcome: 'success',
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    return NextResponse.json({ data: { id } });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);

    await auditLog({
      userId: uid,
      action: 'admin_delete_email_template',
      targetType: 'emailTemplates',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
    });
    return internalError();
  }
}
