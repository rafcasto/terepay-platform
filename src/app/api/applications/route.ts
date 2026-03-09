import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { withAuth } from '@/lib/auth/middleware';
import { createApplicationSchema, terepayApplicationSchema } from '@/lib/validation/schemas';
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

    // Accept both TerePay 8-section form and legacy simple form
    let parsed;
    let applicationData: Record<string, unknown>;

    const isTerePayForm = 'personalInfo' in body && 'loanRequest' in body;

    if (isTerePayForm) {
      parsed = terepayApplicationSchema.parse(body);

      const fortnightlyIncome =
        parsed.employment.income.salaryAfterTax +
        parsed.employment.income.winz +
        parsed.employment.income.otherIncome;

      const sumObj = (obj: Record<string, number>) =>
        Object.values(obj).reduce((a, b) => (typeof b === 'number' ? a + b : a), 0);

      const fortnightlyExpenses =
        sumObj(parsed.livingExpenses.nonDiscretionary as unknown as Record<string, number>) +
        sumObj(parsed.livingExpenses.discretionary as unknown as Record<string, number>);

      const totalDebts =
        parsed.existingDebts.mortgage.totalOwed +
        parsed.existingDebts.personalLoans.totalOwed +
        parsed.existingDebts.carLoans.totalOwed +
        parsed.existingDebts.creditCard.totalOwed +
        parsed.existingDebts.bankOverdrafts.totalOwed +
        parsed.existingDebts.otherLoans.reduce((a, l) => a + l.totalOwed, 0);

      const monthlyIncome = fortnightlyIncome * 2;
      const debtToIncomeRatio = monthlyIncome > 0 ? totalDebts / monthlyIncome : 0;

      const applicationId = randomUUID();
      const now = FieldValue.serverTimestamp();

      applicationData = {
        applicationId,
        applicantId: uid,
        status: 'draft',
        loanDetails: {
          requestedAmount: parsed.loanRequest.requestedAmount,
          currency: 'NZD',
          loanPurpose: 'personal',
          purposeDescription: parsed.loanRequest.purposeDescription,
          requestedTerm: 2, // 2 payment periods = 4 fortnightly payments
        },
        financialInformation: {
          monthlyIncome,
          incomeSource: parsed.loanRequest.primaryIncomeSource,
          employmentType: parsed.employment.employmentStatus,
          monthlyExpenses: fortnightlyExpenses * 2,
          currentDebts: totalDebts,
          existingLoans: parsed.existingDebts.otherLoans.filter((l) => l.totalOwed > 0).length,
          debtToIncomeRatio,
          savingsBalance: 0,
          assets: {},
        },
        personalInfo: parsed.personalInfo,
        employment: parsed.employment,
        livingExpenses: parsed.livingExpenses,
        existingDebts: parsed.existingDebts,
        bankDetails: parsed.bankDetails,
        references: parsed.references,
        declarations: {
          ...parsed.declarations,
          submittedAt: new Date().toISOString(),
        },
        documents: [],
        underwriting: { notes: '', underwriterIds: [] },
        timeline: { createdAt: now, updatedAt: now },
        metadata: { comments: [], internalNotes: '' },
      };
    } else {
      // Legacy simple form path
      const legacyParsed = createApplicationSchema.parse(body);
      const applicationId = randomUUID();
      const now = FieldValue.serverTimestamp();
      const debtToIncomeRatio =
        legacyParsed.financialInformation.monthlyIncome > 0
          ? legacyParsed.financialInformation.currentDebts /
            legacyParsed.financialInformation.monthlyIncome
          : 0;

      applicationData = {
        applicationId,
        applicantId: uid,
        status: 'draft',
        loanDetails: { ...legacyParsed.loanDetails, currency: 'USD' },
        financialInformation: {
          ...legacyParsed.financialInformation,
          debtToIncomeRatio,
          assets: legacyParsed.financialInformation.assets ?? {},
        },
        documents: [],
        underwriting: { notes: '', underwriterIds: [] },
        timeline: { createdAt: now, updatedAt: now },
        metadata: { comments: [], internalNotes: '' },
      };
    }

    const applicationId = (applicationData as { applicationId: string }).applicationId;

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
