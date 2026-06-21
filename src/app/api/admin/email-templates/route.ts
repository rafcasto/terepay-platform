import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { adminEmailTemplateSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { FieldValue } from 'firebase-admin/firestore';
import { EMAIL_TEMPLATE_TYPE_CATEGORY } from '@/types/admin';
import type { EmailTemplateType } from '@/types/admin';

export const dynamic = 'force-dynamic';

// GET /api/admin/email-templates — list all templates
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const auth = await withAuth(request, ['admin']);
    await checkRateLimit(defaultLimiter, auth.uid);

    // Order by type only — a secondary orderBy('sequenceOrder') would exclude
    // any template document that has no sequenceOrder field (e.g. transactional
    // templates like email_verification). Secondary sort is applied in code.
    const snap = await adminDb
      .collection('emailTemplates')
      .orderBy('type')
      .limit(200)
      .get();

    const templates = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name,
        type: d.type,
        category: d.category,
        subject: d.subject,
        htmlBody: d.htmlBody,
        textBody: d.textBody,
        sequenceOrder: d.sequenceOrder ?? null,
        delayDays: d.delayDays ?? null,
        availableVariables: d.availableVariables ?? [],
        isActive: d.isActive,
        createdBy: d.createdBy,
        createdAt: d.createdAt?.toMillis?.() ?? null,
        updatedAt: d.updatedAt?.toMillis?.() ?? null,
      };
    });

    templates.sort((a, b) => {
      if (a.type !== b.type) return 0; // preserve Firestore type ordering
      return (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0);
    });

    return NextResponse.json({ data: templates });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}

// POST /api/admin/email-templates — create a new template
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
    const data = adminEmailTemplateSchema.parse(body);

    const category = EMAIL_TEMPLATE_TYPE_CATEGORY[data.type as EmailTemplateType];

    const now = FieldValue.serverTimestamp();
    const ref = await adminDb.collection('emailTemplates').add({
      ...data,
      category,
      createdBy: uid,
      createdAt: now,
      updatedAt: now,
    });

    await auditLog({
      userId: uid,
      action: 'admin_create_email_template',
      targetId: ref.id,
      targetType: 'emailTemplates',
      outcome: 'success',
      changes: { name: data.name, type: data.type },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    return NextResponse.json({ data: { id: ref.id } }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);

    await auditLog({
      userId: uid,
      action: 'admin_create_email_template',
      targetType: 'emailTemplates',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
    });
    return internalError();
  }
}
