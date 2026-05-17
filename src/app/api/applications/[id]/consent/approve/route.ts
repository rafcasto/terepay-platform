import { type NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { checkRateLimit, paymentLimiter } from '@/lib/rate-limit/limiter';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import {
  approveEnduring,
  normaliseNzPhoneForQippay,
  getReturnBaseUrl,
} from '@/lib/qippay/setpay-client';
import type { PaymentConsent } from '@/types/application';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

const ApproveBody = z.object({
  providerId: z.string().min(1).max(32),
  phone: z.string().min(4).max(32),
  method: z.enum(['redirect', 'phone', 'login_hint_token', 'username']).optional(),
});

/**
 * POST /api/applications/[id]/consent/approve
 * Applicant has selected a bank + confirmed their phone. Calls Qippay's
 * /v1/approve_enduring to start the bank-side consent approval. Returns
 * { method, redirectUri? } so the client can either redirect the user to
 * their bank or render a "check your bank app" CIBA waiting state.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);

  try {
    const auth = await withAuth(request, ['applicant']);

    const allowed = await checkRateLimit(paymentLimiter, auth.uid);
    if (!allowed) {
      throw new AppError('RATE_LIMITED', 429, 'Too many requests');
    }

    const { id } = await params;
    const raw = await request.json().catch(() => ({}));
    const body = ApproveBody.parse(raw);

    const appRef = adminDb.collection('loanApplications').doc(id);
    const snap = await appRef.get();
    if (!snap.exists) {
      throw new AppError('NOT_FOUND', 404, 'Application not found');
    }
    const app = snap.data()!;
    if (app.applicantId !== auth.uid) {
      throw new AppError('FORBIDDEN', 403, 'You do not have access to this application');
    }
    if (app.status !== 'awaiting_payment_consent') {
      throw new AppError(
        'BAD_REQUEST',
        400,
        `Cannot approve consent from status: ${app.status}`,
      );
    }

    const consent = app.paymentConsent as PaymentConsent | undefined;
    if (!consent || !consent.mandateId) {
      throw new AppError('BAD_REQUEST', 400, 'No consent has been initiated yet');
    }
    if (consent.status === 'active') {
      return NextResponse.json({
        data: { method: 'redirect', redirectUri: undefined, alreadyActive: true },
      });
    }

    const phoneForQippay = normaliseNzPhoneForQippay(body.phone);

    const approval = await approveEnduring({
      epcId: consent.mandateId,
      providerId: body.providerId,
      phone: phoneForQippay,
      method: body.method ?? 'redirect',
    });

    // In stub mode the client returns no redirect_uri — build a synthetic
    // one that loops back to our return page so the existing reconciler
    // recognises a successful round-trip.
    let effectiveRedirect = approval.redirectUri;
    if (!effectiveRedirect && approval.method === 'redirect') {
      const base = getReturnBaseUrl();
      effectiveRedirect = `${base}/applicant/applications/${id}/consent/return?outcome=success&stub=success`;
    }

    await appRef.update({
      'paymentConsent.status': 'redirected',
      'paymentConsent.approvalMethod': approval.method,
      'paymentConsent.providerId': body.providerId,
      'paymentConsent.lastStatusFromProvider': `approved:${approval.method}`,
      'timeline.updatedAt': FieldValue.serverTimestamp(),
    });

    await auditLog({
      userId: auth.uid,
      action: 'payment_consent_approve_initiated',
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
      changes: {
        mandateId: consent.mandateId,
        providerId: body.providerId,
        method: approval.method,
      },
    });

    return NextResponse.json({
      data: {
        method: approval.method,
        redirectUri: effectiveRedirect,
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(
        new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors),
      );
    }
    if (err instanceof AppError) {
      await auditLog({
        userId: 'unknown',
        action: 'payment_consent_approve_failed',
        targetType: 'application',
        outcome: 'failure',
        errorDetail: err.message,
        changes: { code: err.code },
        ipAddress: ip,
      });
      return errorResponse(err);
    }
    console.error('[consent/approve] unexpected error', err);
    return internalError();
  }
}
