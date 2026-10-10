import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { getContentSection, setContentSection } from '@/lib/content/site-content';
import { getSectionDef, type ContentSectionValues } from '@/types/content';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';

export const dynamic = 'force-dynamic';

// GET /api/content/[section] — current values for one section.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ section: string }> },
): Promise<Response> {
  try {
    const auth = await withAuth(request, ['content_editor', 'admin']);
    await checkRateLimit(defaultLimiter, auth.uid);

    const { section } = await params;
    const def = getSectionDef(section);
    if (!def) throw new AppError('NOT_FOUND', 404, 'Unknown content section');

    const values = await getContentSection(section);
    return NextResponse.json({ data: { section, values } });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}

// PATCH /api/content/[section] — update one section. Saves are live immediately.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ section: string }> },
): Promise<Response> {
  const ip = getClientIp(request);
  let userId = 'unknown';

  try {
    const auth = await withAuth(request, ['content_editor', 'admin']);
    userId = auth.uid;

    const allowed = await checkRateLimit(defaultLimiter, auth.uid);
    if (!allowed) {
      return errorResponse(new AppError('RATE_LIMITED', 429, 'Too many requests.'));
    }

    const { section } = await params;
    const def = getSectionDef(section);
    if (!def) throw new AppError('NOT_FOUND', 404, 'Unknown content section');

    const body = (await request.json()) as { values?: unknown };
    const incoming = body?.values;
    if (typeof incoming !== 'object' || incoming === null || Array.isArray(incoming)) {
      throw new AppError('VALIDATION_ERROR', 422, 'Invalid content payload');
    }

    // Validate against the section definition: accept only known fields, coerce
    // to string, trim, and enforce per-field max length. Unknown keys dropped.
    const clean: ContentSectionValues = {};
    const record = incoming as Record<string, unknown>;
    for (const field of def.fields) {
      const raw = record[field.key];
      if (raw === undefined) continue;
      if (typeof raw !== 'string') {
        throw new AppError('VALIDATION_ERROR', 422, `Field "${field.key}" must be text`);
      }
      const value = raw.replace(/\r\n/g, '\n');
      if (value.length > field.maxLength) {
        throw new AppError('VALIDATION_ERROR', 422, `Field "${field.label}" exceeds ${field.maxLength} characters`);
      }
      clean[field.key] = value;
    }

    await setContentSection(section, clean, auth.uid);

    await auditLog({
      userId: auth.uid,
      action: 'content_section_updated',
      targetId: section,
      targetType: 'content',
      outcome: 'success',
      changes: { fields: Object.keys(clean) },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    const values = await getContentSection(section);
    return NextResponse.json({ data: { section, values } });
  } catch (err) {
    if (err instanceof AppError) {
      await auditLog({
        userId,
        action: 'content_section_updated',
        targetType: 'content',
        outcome: 'failure',
        errorDetail: err.message,
        ipAddress: ip,
      });
      return errorResponse(err);
    }
    await auditLog({
      userId,
      action: 'content_section_updated',
      targetType: 'content',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
    });
    return internalError();
  }
}
