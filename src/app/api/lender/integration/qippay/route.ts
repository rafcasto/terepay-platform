import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { listProviders, getMode, getBeneficiaryId } from '@/lib/qippay/setpay-client';
import {
  getQippayIntegrationDisplayConfig,
  updateQippayWebhookConfig,
} from '@/lib/qippay/webhook-config';

export const dynamic = 'force-dynamic';

// Merchant details from Qippay onboarding — safe to display (not sensitive)
const MERCHANT_NAME = 'Terepay Neophile Limited';
const RECEIVING_ACCOUNT = '02-0108-0900334-00';

/**
 * GET /api/lender/integration/qippay
 *
 * Returns Qippay connection status and configuration for the settings UI.
 * The client secret is NEVER included in this response.
 */
export async function GET(request: NextRequest) {
  try {
    await withAuth(request, ['lender']);

    const [displayConfig, banks] = await Promise.all([
      getQippayIntegrationDisplayConfig(),
      listProviders().catch(() => null),
    ]);

    const mode = getMode();
    const baseUrl = process.env.QIPPAY_BASE_URL ?? '';
    const returnBaseUrl = (process.env.QIPPAY_RETURN_BASE_URL ?? '').replace(/\/$/, '');
    const webhookUrl = `${returnBaseUrl}/api/webhooks/qippay`;

    let beneficiaryId = '';
    try {
      beneficiaryId = getBeneficiaryId();
    } catch {
      // Not configured — will show as empty in UI
    }

    return NextResponse.json({
      data: {
        mode,
        baseUrl,
        beneficiaryId,
        merchantName: MERCHANT_NAME,
        receivingAccount: RECEIVING_ACCOUNT,
        webhookUrl,
        paymentConfirmationMode: displayConfig.paymentConfirmationMode,
        webhookEnabled: displayConfig.webhookEnabled,
        webhookSecretSet: displayConfig.webhookSecretSet,
        connected: banks !== null,
        banks: banks ?? [],
      },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error('[lender/integration/qippay GET] unexpected error', err);
    return internalError();
  }
}

const patchSchema = z.object({
  paymentConfirmationMode: z.enum(['polling', 'webhook']).optional(),
  webhookEnabled: z.boolean().optional(),
  webhookSecret: z.string().min(1).max(512).optional(),
});

/**
 * PATCH /api/lender/integration/qippay
 *
 * Updates Qippay webhook configuration. The secret is encrypted before
 * being stored in Firestore — it is never echoed back in any response.
 */
export async function PATCH(request: NextRequest) {
  const ip = getClientIp(request);

  try {
    const auth = await withAuth(request, ['lender']);

    const rawBody = await request.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 422, 'Invalid request', parsed.error.flatten().fieldErrors);
    }

    const { webhookSecret, ...rest } = parsed.data;

    // Must be changing at least one field
    if (Object.keys(parsed.data).length === 0) {
      throw new AppError('VALIDATION_ERROR', 422, 'No fields to update');
    }

    await updateQippayWebhookConfig(
      { ...rest, ...(webhookSecret ? { webhookSecret } : {}) },
      auth.uid,
    );

    await auditLog({
      userId: auth.uid,
      action: 'qippay_integration_config_updated',
      targetType: 'system',
      outcome: 'success',
      ipAddress: ip,
      changes: {
        updatedFields: Object.keys(parsed.data),
        // Never log the secret value, only whether it was provided
        secretProvided: Boolean(webhookSecret),
      },
    });

    // Return the updated safe config
    const updatedDisplay = await getQippayIntegrationDisplayConfig();
    return NextResponse.json({ data: updatedDisplay });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error('[lender/integration/qippay PATCH] unexpected error', err);
    return internalError();
  }
}
