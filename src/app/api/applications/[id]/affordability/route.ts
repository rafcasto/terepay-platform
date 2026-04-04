import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { withAuth } from '@/lib/auth/middleware';
import { affordabilityAssessmentSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { FieldValue } from 'firebase-admin/firestore';
import { ZodError } from 'zod';
import { randomUUID } from 'crypto';
import { generateAffordabilityPdf } from '@/lib/pdf/affordability-report';
import { getDriveClient, getOrCreateSubfolder, uploadBufferToDrive } from '@/lib/gdrive/client';
import type { AffordabilityAssessment, LoanApplication } from '@/types/application';

type RouteParams = { params: Promise<{ id: string }> };

const HARD_DECLINE_PURPOSES = ['remittances', 'visa_fees', 'celebrations', 'planned_events'];

function calcSurplusRating(surplus: number): 'affordable' | 'marginal' | 'high_risk' | 'not_affordable' {
  if (surplus > 100) return 'affordable';
  if (surplus >= 50) return 'marginal';
  if (surplus > 0) return 'high_risk';
  return 'not_affordable';
}

function detectHardDeclines(params: {
  daysOfTransactionData: number;
  visaExpiry?: string;
  loanEndDate: string;
  surplus: number;
  loanPurpose: string;
}): string[] {
  const triggers: string[] = [];

  if (params.daysOfTransactionData < 90) {
    triggers.push('Less than 90 days of transaction data');
  }

  if (params.visaExpiry) {
    const visaEnd = new Date(params.visaExpiry);
    const requiredEnd = new Date(params.loanEndDate);
    requiredEnd.setDate(requiredEnd.getDate() + 90); // loan end + 3 months
    if (visaEnd < requiredEnd) {
      triggers.push('Visa expires before loan completion + 3 months');
    }
  }

  if (params.surplus <= 0) {
    triggers.push('Final available surplus is zero or negative');
  }

  const purposeLower = params.loanPurpose.toLowerCase();
  if (HARD_DECLINE_PURPOSES.some((p) => purposeLower.includes(p))) {
    triggers.push(`Loan purpose "${params.loanPurpose}" is not permitted`);
  }

  return triggers;
}

/**
 * GET /api/applications/[id]/affordability
 * Returns affordability assessments for an application.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, ['lender']);
    const { id } = await params;

    const snap = await adminDb
      .collection('affordabilityAssessments')
      .where('applicationId', '==', id)
      .orderBy('version', 'desc')
      .get();

    return NextResponse.json({ data: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}

/**
 * POST /api/applications/[id]/affordability
 * Lender submits a completed affordability assessment.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const ip = getClientIp(request);
  try {
    const auth = await withAuth(request, ['lender']);
    const { id } = await params;

    const appRef = adminDb.collection('loanApplications').doc(id);
    const appDoc = await appRef.get();
    if (!appDoc.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');

    const appData = appDoc.data()!;
    if (!['under_assessment', 'waiting_for_docs'].includes(appData.status)) {
      throw new AppError('BAD_REQUEST', 400, `Cannot submit assessment while status is: ${appData.status}`);
    }

    const body = await request.json();
    const parsed = affordabilityAssessmentSchema.parse(body);

    // Calculate income totals
    const incomeRows = parsed.incomeRows.map((row) => ({
      ...row,
      finalAmount: Math.min(
        row.centrixAmount > 0 ? row.centrixAmount : Infinity,
        row.verifiedAmount > 0 ? row.verifiedAmount : Infinity,
      ) === Infinity ? 0 : Math.min(
        row.centrixAmount > 0 ? row.centrixAmount : row.verifiedAmount,
        row.verifiedAmount > 0 ? row.verifiedAmount : row.centrixAmount,
      ),
    }));

    const expenseRows = parsed.expenseRows.map((row) => ({
      ...row,
      finalAmount: Math.max(0, Math.max(row.centrixAmount, row.benchmarkAmount) + row.adjustment),
    }));

    const totalVerifiedIncome = incomeRows.reduce((sum, r) => sum + r.finalAmount, 0);
    const totalExpenses = expenseRows.reduce((sum, r) => sum + r.finalAmount, 0);
    const netDisposableIncome = totalVerifiedIncome - totalExpenses;

    const requestedAmount = appData.loanDetails?.requestedAmount ?? 0;
    const loanFortnightlyPayment = (requestedAmount * 1.047) / 4;
    const finalAvailableSurplus = netDisposableIncome - loanFortnightlyPayment;

    // Days of transaction data
    const firstTxDate = new Date(parsed.checklist.firstTransactionDate);
    const today = new Date();
    const daysOfTransactionData = Math.floor((today.getTime() - firstTxDate.getTime()) / (1000 * 60 * 60 * 24));

    // Loan end date (56 days from today)
    const loanEndDate = new Date();
    loanEndDate.setDate(loanEndDate.getDate() + 56);

    const hardDeclineTriggers = detectHardDeclines({
      daysOfTransactionData,
      visaExpiry: appData.personalInfo?.visaExpiryDate,
      loanEndDate: loanEndDate.toISOString().split('T')[0],
      surplus: finalAvailableSurplus,
      loanPurpose: appData.loanRequest?.purpose ?? appData.loanDetails?.loanPurpose ?? '',
    });

    const surplusRating = calcSurplusRating(finalAvailableSurplus);
    const recommendation = hardDeclineTriggers.length > 0 ? 'decline' : parsed.recommendation;

    // Get current version number
    const existingSnap = await adminDb
      .collection('affordabilityAssessments')
      .where('applicationId', '==', id)
      .get();
    const nextVersion = existingSnap.size + 1;

    // Mark previous versions as superseded
    const batch = adminDb.batch();
    existingSnap.docs.forEach((d) => {
      batch.update(d.ref, { isSuperseded: true });
    });

    // Get lender display name
    const lenderDoc = await adminDb.collection('users').doc(auth.uid).get();
    const lenderData = lenderDoc.data();
    const lenderName = lenderData
      ? `${lenderData.firstName ?? ''} ${lenderData.lastName ?? ''}`.trim()
      : auth.email;

    const assessmentId = randomUUID();
    const assessmentRef = adminDb.collection('affordabilityAssessments').doc(assessmentId);

    batch.set(assessmentRef, {
      assessmentId,
      applicationId: id,
      version: nextVersion,
      lenderId: auth.uid,
      lenderName,
      assessedAt: FieldValue.serverTimestamp(),
      status: 'complete',
      isSuperseded: false,
      checklist: {
        ...parsed.checklist,
        daysOfTransactionData,
      },
      incomeRows,
      expenseRows,
      householdMultiplier: parsed.householdMultiplier,
      catalogVersionId: parsed.catalogVersionId,
      totalVerifiedIncome,
      totalExpenses,
      netDisposableIncome,
      loanFortnightlyPayment,
      finalAvailableSurplus,
      hardDeclineTriggers,
      redFlagsRaised: [],
      redFlagsAcknowledged: parsed.redFlagsAcknowledged,
      surplusRating,
      recommendation,
    });

    const now = FieldValue.serverTimestamp();
    batch.update(appRef, {
      affordabilityStatus: 'complete',
      affordabilityAssessmentIds: FieldValue.arrayUnion(assessmentId),
      'timeline.updatedAt': now,
    });

    await batch.commit();

    // --- Non-blocking: generate PDF and upload to Google Drive ---
    const applicantUid: string | undefined = appData.applicantId;
    if (applicantUid) {
      const parentKycFolderId = process.env.GOOGLE_DRIVE_KYC_FOLDER_ID;
      if (parentKycFolderId) {
        (async () => {
          try {
            // Build minimal assessment object for PDF (serverTimestamp not yet resolved, use Date.now)
            const assessmentForPdf: AffordabilityAssessment = {
              assessmentId,
              applicationId: id,
              version: nextVersion,
              lenderId: auth.uid,
              lenderName: lenderName ?? '',
              assessedAt: { toDate: () => new Date() } as unknown as import('firebase-admin/firestore').Timestamp,
              status: 'complete',
              isSuperseded: false,
              checklist: { ...parsed.checklist, daysOfTransactionData },
              incomeRows,
              expenseRows,
              householdMultiplier: parsed.householdMultiplier,
              catalogVersionId: parsed.catalogVersionId,
              totalVerifiedIncome,
              totalExpenses,
              netDisposableIncome,
              loanFortnightlyPayment,
              finalAvailableSurplus,
              hardDeclineTriggers,
              redFlagsRaised: [],
              redFlagsAcknowledged: parsed.redFlagsAcknowledged,
              surplusRating,
              recommendation,
            };
            const appForPdf = { ...appData, applicationId: id } as LoanApplication;
            const pdfBuffer = await generateAffordabilityPdf(assessmentForPdf, appForPdf);
            const dateStr = new Date().toISOString().split('T')[0];
            const pdfFileName = `affordability_assessment_v${nextVersion}_${dateStr}.pdf`;
            const drive = getDriveClient();
            const userFolderId = await getOrCreateSubfolder(drive, parentKycFolderId, applicantUid);
            const { fileId: pdfDriveFileId } = await uploadBufferToDrive(drive, userFolderId, pdfFileName, 'application/pdf', pdfBuffer);
            await adminDb.collection('affordabilityAssessments').doc(assessmentId).update({
              pdfDriveFileId,
              pdfFileName,
              pdfUploadedAt: FieldValue.serverTimestamp(),
            });
          } catch (pdfErr) {
            console.error('[affordability] PDF generation/upload failed (non-blocking):', pdfErr);
          }
        })();
      }
    }

    await auditLog({
      userId: auth.uid,
      action: 'affordability_assessment_submitted',
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      ipAddress: ip,
      changes: { assessmentId, version: nextVersion, recommendation, surplus: finalAvailableSurplus },
    });

    return NextResponse.json({
      assessmentId,
      recommendation,
      finalAvailableSurplus,
      surplusRating,
      hardDeclineTriggers,
    });
  } catch (err) {
    if (err instanceof ZodError) {
      console.error('[affordability POST] Validation error:', JSON.stringify(err.flatten().fieldErrors, null, 2));
      return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
    }
    if (err instanceof AppError) return errorResponse(err);
    console.error('[affordability POST] Unexpected error:', err);
    return internalError();
  }
}

/**
 * PATCH /api/applications/[id]/affordability
 * Lender saves an in-progress affordability assessment draft step-by-step.
 * Lightweight — no computation, just persists the current wizard state.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await withAuth(request, ['lender']);
    const { id } = await params;

    const appRef = adminDb.collection('loanApplications').doc(id);
    const appDoc = await appRef.get();
    if (!appDoc.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');

    const { currentStep, checklist, incomeRows, expenseRows, recommendation } =
      await request.json();

    await appRef.update({
      affordabilityDraft: {
        currentStep: currentStep ?? 0,
        checklist: checklist ?? {},
        incomeRows: incomeRows ?? [],
        expenseRows: expenseRows ?? [],
        recommendation: recommendation ?? 'proceed',
        savedAt: FieldValue.serverTimestamp(),
      },
    });

    await auditLog({
      userId: auth.uid,
      action: 'affordability_draft_saved',
      targetId: id,
      targetType: 'application',
      outcome: 'success',
      ipAddress: getClientIp(request),
      changes: { currentStep },
    });

    return NextResponse.json({ data: { saved: true } });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}

