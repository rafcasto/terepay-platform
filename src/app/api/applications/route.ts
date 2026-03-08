import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { withAuth } from '@/lib/auth/middleware';
import { createApplicationSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { FieldValue } from 'firebase-admin/firestore';
import { ZodError } from 'zod';
import { randomUUID } from 'crypto';

/**
 * GET /api/applications
 * - Lender: returns all submitted+ applications
 * - Applicant: returns their own applications
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    await checkRateLimit(defaultLimiter, auth.uid);

    let query;
    if (auth.role === 'lender') {
      query = adminDb
        .collection('loanApplications')
        .where('status', '!=', 'draft')
        .orderBy('status')
        .orderBy('timeline.submittedAt', 'desc')
        .limit(50);
    } else {
      query = adminDb
        .collection('loanApplications')
        .where('applicantId', '==', auth.uid)
        .orderBy('timeline.createdAt', 'desc')
        .limit(20);
    }

    const snapshot = await query.get();
    const applications = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ data: applications });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}

/**
 * POST /api/applications
 * Creates a new loan application (applicants only).
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  let uid = 'unknown';

  try {
    const allowed = await checkRateLimit(defaultLimiter, ip);
    if (!allowed) {
      return errorResponse(new AppError('RATE_LIMITED', 429, 'Too many requests.'));
    }

    const auth = await withAuth(request, ['applicant']);
    uid = auth.uid;

    const body = await request.json();
    const parsed = createApplicationSchema.parse(body);

    const applicationId = randomUUID();
    const now = FieldValue.serverTimestamp();

    const debtToIncomeRatio =
      parsed.financialInformation.monthlyIncome > 0
        ? parsed.financialInformation.currentDebts / parsed.financialInformation.monthlyIncome
        : 0;

    const applicationData = {
      applicationId,
      applicantId: uid,
      status: 'draft',
      loanDetails: {
        ...parsed.loanDetails,
        currency: 'USD',
      },
      financialInformation: {
        ...parsed.financialInformation,
        debtToIncomeRatio,
        assets: parsed.financialInformation.assets ?? {},
      },
      documents: [],
      underwriting: {
        notes: '',
        underwriterIds: [],
      },
      timeline: {
        createdAt: now,
        updatedAt: now,
      },
      metadata: {
        comments: [],
        internalNotes: '',
      },
    };

    await adminDb.collection('loanApplications').doc(applicationId).set(applicationData);

    await auditLog({
      userId: uid,
      action: 'application_created',
      targetId: applicationId,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    return NextResponse.json({ data: { applicationId } }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(
        new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors),
      );
    }
    if (err instanceof AppError) return errorResponse(err);

    await auditLog({ userId: uid, action: 'application_created', targetType: 'application', outcome: 'failure', ipAddress: ip });
    return internalError();
  }
}
