import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { generateAffordabilityPdf } from '@/lib/pdf/affordability-report';
import type { AffordabilityAssessment, LoanApplication } from '@/types/application';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/applications/[id]/affordability/pdf
 * Lender-only. Generates an affordability assessment PDF on-demand for the
 * most recent complete assessment and returns it as an application/pdf response.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await withAuth(request, ['lender']);
    const { id } = await params;

    // Load application
    const appDoc = await adminDb.collection('loanApplications').doc(id).get();
    if (!appDoc.exists) throw new AppError('NOT_FOUND', 404, 'Application not found');

    // Load most recent complete assessment
    const assessmentSnap = await adminDb
      .collection('affordabilityAssessments')
      .where('applicationId', '==', id)
      .where('isSuperseded', '==', false)
      .where('status', '==', 'complete')
      .orderBy('version', 'desc')
      .limit(1)
      .get();

    if (assessmentSnap.empty) {
      throw new AppError('NOT_FOUND', 404, 'No completed affordability assessment found for this application');
    }

    const assessmentData = assessmentSnap.docs[0].data() as AffordabilityAssessment;
    const appData = { ...appDoc.data(), applicationId: id } as LoanApplication;

    const pdfBuffer = await generateAffordabilityPdf(assessmentData, appData);

    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `affordability_assessment_v${assessmentData.version}_${dateStr}.pdf`;

    return new NextResponse(pdfBuffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    console.error('[affordability/pdf] Unexpected error:', err);
    return internalError();
  }
}
