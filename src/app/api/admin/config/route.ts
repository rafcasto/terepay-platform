import { type NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { withAuth } from '@/lib/auth/middleware';
import { adminConfigSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { getAdminConfigMasked, setAdminConfig } from '@/lib/admin/config';
import type { AdminConfigKey } from '@/types/admin';
import { ADMIN_CONFIG_KEYS } from '@/types/admin';

export const dynamic = 'force-dynamic';

// GET /api/admin/config — return masked config values (no secrets exposed)
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const auth = await withAuth(request, ['admin']);
    await checkRateLimit(defaultLimiter, auth.uid);

    const masked = await getAdminConfigMasked();

    return NextResponse.json({ data: masked });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}

// PATCH /api/admin/config — update one or more config values
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
    const patch = adminConfigSchema.parse(body);

    // Only include keys that were explicitly provided
    const updates: Partial<Record<AdminConfigKey, string | null>> = {};
    for (const { key } of ADMIN_CONFIG_KEYS) {
      if (key in patch) {
        const val = patch[key as keyof typeof patch];
        // Empty string → clear the Firestore value (fall back to env var)
        updates[key] = val === '' ? null : (val ?? null);
      }
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError('VALIDATION_ERROR', 422, 'No valid config keys provided');
    }

    await setAdminConfig(updates, uid);

    // Audit without logging actual key values
    await auditLog({
      userId: uid,
      action: 'admin_update_config',
      targetId: 'integrations',
      targetType: 'adminConfig',
      outcome: 'success',
      changes: { updatedKeys: Object.keys(updates) },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    const masked = await getAdminConfigMasked();
    return NextResponse.json({ data: masked });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);

    await auditLog({
      userId: uid,
      action: 'admin_update_config',
      targetType: 'adminConfig',
      outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: ip,
    });
    return internalError();
  }
}
