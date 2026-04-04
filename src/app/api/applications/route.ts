import { type NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { withAuth } from '@/lib/auth/middleware';
import { createApplicationSchema, terepayApplicationSchema, draftApplicationSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { FieldValue } from 'firebase-admin/firestore';
import { ZodError, z } from 'zod';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Lender on-behalf schema + helper
// ---------------------------------------------------------------------------

const lenderApplicationSchema = z.object({
  /** Firebase UID of an online applicant */
  applicantId: z.string().min(1).optional(),
  /** Offline customer ID, e.g. "TERE001" */
  offlineCustomerId: z.string().regex(/^TERE\d{3,}$/).optional(),
  personalInfo: z.any().optional(),
  employment: z.any().optional(),
  livingExpenses: z.any().optional(),
  existingDebts: z.any().optional(),
  loanRequest: z.any().optional(),
  bankDetails: z.any().optional(),
  references: z.any().optional(),
  declarations: z.any().optional(),
}).refine((d) => d.applicantId || d.offlineCustomerId, {
  message: 'Either applicantId or offlineCustomerId is required',
});

async function handleLenderApplication(
  request: NextRequest,
  lenderUid: string,
  ip: string,
): Promise<Response> {
  const body = await request.json();
  const parsed = lenderApplicationSchema.parse(body);

  let customerRef: string | null = null;
  let customerType: 'online' | 'offline';

  if (parsed.applicantId) {
    // Verify the online applicant exists
    const userSnap = await adminDb.collection('users').doc(parsed.applicantId).get();
    if (!userSnap.exists || userSnap.data()?.role !== 'applicant') {
      return errorResponse(new AppError('NOT_FOUND', 404, 'Applicant not found'));
    }
    customerRef = parsed.applicantId;
    customerType = 'online';
  } else {
    // Verify the offline customer exists
    const custSnap = await adminDb.collection('offlineCustomers').doc(parsed.offlineCustomerId!).get();
    if (!custSnap.exists) {
      return errorResponse(new AppError('NOT_FOUND', 404, 'Offline customer not found'));
    }
    customerRef = parsed.offlineCustomerId!;
    customerType = 'offline';
  }

  const applicationId = randomUUID();
  const now = FieldValue.serverTimestamp();

  const applicationData: Record<string, unknown> = {
    applicationId,
    status: 'pending_review',
    createdByLenderId: lenderUid,
    ...(customerType === 'online'
      ? { applicantId: customerRef }
      : { offlineCustomerId: customerRef }),
    ...(parsed.personalInfo   && { personalInfo:   parsed.personalInfo }),
    ...(parsed.employment     && { employment:     parsed.employment }),
    ...(parsed.livingExpenses && { livingExpenses: parsed.livingExpenses }),
    ...(parsed.existingDebts  && { existingDebts:  parsed.existingDebts }),
    ...(parsed.loanRequest    && { loanRequest:    parsed.loanRequest }),
    ...(parsed.bankDetails    && { bankDetails:    parsed.bankDetails }),
    ...(parsed.references     && { references:     parsed.references }),
    ...(parsed.declarations   && { declarations:   parsed.declarations }),
    documents: [],
    underwriting: { notes: '', underwriterIds: [] },
    timeline: { createdAt: now, updatedAt: now, submittedAt: now },
    metadata: { comments: [], internalNotes: '' },
  };

  // Add computed financial fields if loanRequest is present
  if (parsed.employment?.income && parsed.loanRequest) {
    const inc = parsed.employment.income;
    const fortnightlyIncome =
      (inc.salaryAfterTax ?? 0) + (inc.winz ?? 0) + (inc.otherIncome ?? 0);
    applicationData.financialInformation = {
      monthlyIncome: fortnightlyIncome * 2,
      incomeSource: parsed.loanRequest.primaryIncomeSource ?? '',
      employmentType: parsed.employment.employmentStatus ?? '',
      monthlyExpenses: 0,
      currentDebts: 0,
      existingLoans: 0,
      debtToIncomeRatio: 0,
      savingsBalance: 0,
      assets: {},
    };
    if (parsed.loanRequest.requestedAmount) {
      applicationData.loanDetails = {
        requestedAmount: parsed.loanRequest.requestedAmount,
        currency: 'NZD',
        loanPurpose: parsed.loanRequest.purpose ?? 'personal',
        purposeDescription: parsed.loanRequest.purposeDescription ?? '',
        requestedTerm: 2,
      };
    }
  }

  await adminDb.collection('loanApplications').doc(applicationId).set(applicationData);

  await auditLog({
    userId: lenderUid,
    action: 'application_created_on_behalf',
    targetId: applicationId,
    targetType: 'application',
    outcome: 'success',
    ipAddress: ip,
    userAgent: request.headers.get('user-agent') ?? '',
  });

  return NextResponse.json({ data: { applicationId } }, { status: 201 });
}


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
 * - Applicant: creates a new loan application for themselves.
 * - Lender: creates a loan application on behalf of an online or offline customer.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  let uid = 'unknown';

  try {
    const allowed = await checkRateLimit(defaultLimiter, ip);
    if (!allowed) {
      return errorResponse(new AppError('RATE_LIMITED', 429, 'Too many requests.'));
    }

    const auth = await withAuth(request);
    uid = auth.uid;

    // ── Lender: on-behalf-of path ──────────────────────────────────────────
    if (auth.role === 'lender') {
      return await handleLenderApplication(request, auth.uid, ip);
    }

    // ── Applicant: self-serve path ─────────────────────────────────────────
    // Check live Firebase Auth state — the session cookie is issued at login and
    // its email_verified claim never updates after the user verifies their email.
    const liveUser = await adminAuth.getUser(uid);
    if (!liveUser.emailVerified) {
      return errorResponse(
        new AppError('FORBIDDEN', 403, 'Please verify your email address before submitting a loan application.'),
      );
    }

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
          loanPurpose: parsed.loanRequest.purpose ?? 'personal',
          purposeDescription: parsed.loanRequest.purposeDescription,
          requestedTerm: 2, // 2 payment periods = 4 fortnightly payments
        },
        // Store the raw loanRequest so the form can be fully restored from a draft
        loanRequest: parsed.loanRequest,
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

    // Upsert: if the user already has a draft, update it rather than creating a duplicate
    const existingDraftSnap = await adminDb
      .collection('loanApplications')
      .where('applicantId', '==', uid)
      .where('status', '==', 'draft')
      .limit(1)
      .get();

    let savedId: string;
    if (!existingDraftSnap.empty) {
      savedId = existingDraftSnap.docs[0].id;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { applicationId: _id, timeline: _timeline, ...updateFields } = applicationData as Record<string, unknown>;
      await adminDb
        .collection('loanApplications')
        .doc(savedId)
        .update({ ...updateFields, 'timeline.updatedAt': FieldValue.serverTimestamp() });
    } else {
      await adminDb.collection('loanApplications').doc(applicationId).set(applicationData);
      savedId = applicationId;
    }

    await auditLog({
      userId: uid,
      action: 'application_created',
      targetId: savedId,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    return NextResponse.json({ data: { applicationId: savedId } }, { status: 201 });
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

/**
 * PUT /api/applications
 * Incrementally saves a draft step — creates the draft if it doesn't exist yet.
 * Does NOT require a complete application; each section is optional.
 * Used by the multi-step form to persist data as the user moves forward.
 */
export async function PUT(request: NextRequest) {
  const ip = getClientIp(request);
  let uid = 'unknown';
  try {
    const auth = await withAuth(request, ['applicant']);
    uid = auth.uid;
    await checkRateLimit(defaultLimiter, auth.uid);

    const body = await request.json();
    const parsed = draftApplicationSchema.parse(body);

    const now = FieldValue.serverTimestamp();

    // Find existing draft
    const existingDraftSnap = await adminDb
      .collection('loanApplications')
      .where('applicantId', '==', uid)
      .where('status', '==', 'draft')
      .limit(1)
      .get();

    let savedId: string;

    if (!existingDraftSnap.empty) {
      savedId = existingDraftSnap.docs[0].id;
      const updateFields: Record<string, unknown> = { 'timeline.updatedAt': now };
      if (parsed.personalInfo !== undefined)   updateFields.personalInfo   = parsed.personalInfo;
      if (parsed.employment !== undefined)     updateFields.employment     = parsed.employment;
      if (parsed.livingExpenses !== undefined) updateFields.livingExpenses = parsed.livingExpenses;
      if (parsed.existingDebts !== undefined)  updateFields.existingDebts  = parsed.existingDebts;
      if (parsed.loanRequest !== undefined)    updateFields.loanRequest    = parsed.loanRequest;
      if (parsed.bankDetails !== undefined)    updateFields.bankDetails    = parsed.bankDetails;
      if (parsed.references !== undefined)     updateFields.references     = parsed.references;
      if (parsed.lastCompletedStep !== undefined) updateFields.lastCompletedStep = parsed.lastCompletedStep;
      await adminDb.collection('loanApplications').doc(savedId).update(updateFields);
    } else {
      const applicationId = randomUUID();
      const docData: Record<string, unknown> = {
        applicationId,
        applicantId: uid,
        status: 'draft',
        timeline: { createdAt: now, updatedAt: now },
      };
      if (parsed.personalInfo !== undefined)   docData.personalInfo   = parsed.personalInfo;
      if (parsed.employment !== undefined)     docData.employment     = parsed.employment;
      if (parsed.livingExpenses !== undefined) docData.livingExpenses = parsed.livingExpenses;
      if (parsed.existingDebts !== undefined)  docData.existingDebts  = parsed.existingDebts;
      if (parsed.loanRequest !== undefined)    docData.loanRequest    = parsed.loanRequest;
      if (parsed.bankDetails !== undefined)    docData.bankDetails    = parsed.bankDetails;
      if (parsed.references !== undefined)     docData.references     = parsed.references;
      if (parsed.lastCompletedStep !== undefined) docData.lastCompletedStep = parsed.lastCompletedStep;
      await adminDb.collection('loanApplications').doc(applicationId).set(docData);
      savedId = applicationId;
    }

    await auditLog({
      userId: uid,
      action: 'application_draft_saved',
      targetId: savedId,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
    });

    return NextResponse.json({ data: { id: savedId } });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(
        new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors),
      );
    }
    if (err instanceof AppError) return errorResponse(err);
    await auditLog({ userId: uid, action: 'application_draft_saved', targetType: 'application', outcome: 'failure', ipAddress: ip });
    return internalError();
  }
}
