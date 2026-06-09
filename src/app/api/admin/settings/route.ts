import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { withAuth } from '@/lib/auth/middleware';
import { adminSiteSettingsSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { getSiteSettings, setSiteSettings } from '@/lib/admin/site-settings';

export const dynamic = 'force-dynamic';

// GET /api/admin/settings — read current site settings
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const auth = await withAuth(request, ['admin']);
    await checkRateLimit(defaultLimiter, auth.uid);

    const settings = await getSiteSettings();

    return NextResponse.json({
      data: {
        maintenanceMode: settings.maintenanceMode,
        maintenanceMessage: settings.maintenanceMessage,
        updatedAt: settings.updatedAt
          ? (settings.updatedAt as unknown as { toMillis: () => number }).toMillis?.() ?? null
          : null,
        updatedBy: settings.updatedBy ?? null,
      },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}

// PATCH /api/admin/settings — update site settings
export async function PATCH(request: NextRequest): Promise<Response> {
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
    const patch = adminSiteSettingsSchema.parse(body);

    await setSiteSettings(patch, uid);

    await auditLog({
      userId: uid,
      action: 'admin_update_site_settings',
      targetId: 'global',
      targetType: 'siteSettings',
      outcome: 'success',
      changes: patch,
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    const updated = await getSiteSettings();
    return NextResponse.json({
      data: {
        maintenanceMode: updated.maintenanceMode,
        maintenanceMessage: updated.maintenanceMessage,
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);

    await auditLog({
      userId: uid,
      action: 'admin_update_site_settings',
      targetType: 'siteSettings',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
    });
    return internalError();
  }
}
