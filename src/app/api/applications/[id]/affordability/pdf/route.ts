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
    // Simple single-field query avoids requiring a composite index.
    // Filter and sort in memory since results are small (1 application's assessments).
    const assessmentSnap = await adminDb
      .collection('affordabilityAssessments')
      .where('applicationId', '==', id)
      .get();

    const completedAssessments = assessmentSnap.docs
      .map(d => d.data() as AffordabilityAssessment)
      .filter(a => a.status === 'complete' && !a.isSuperseded)
      .sort((a, b) => (b.version ?? 0) - (a.version ?? 0));

    if (completedAssessments.length === 0) {
      throw new AppError('NOT_FOUND', 404, 'No completed affordability assessment found for this application');
    }

    const assessmentData = completedAssessments[0];
    const appData = { ...appDoc.data(), applicationId: id } as LoanApplication;

    const pdfBuffer = await generateAffordabilityPdf(assessmentData, appData);

    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `affordability_assessment_v${assessmentData.version}_${dateStr}.pdf`;

    // Pass the Buffer directly — pdfBuffer.buffer is the Node.js pool ArrayBuffer
    // (with byteOffset != 0) which causes truncated/corrupted PDF responses.
    const arrayBuffer = pdfBuffer.buffer.slice(
      pdfBuffer.byteOffset,
      pdfBuffer.byteOffset + pdfBuffer.byteLength,
    ) as ArrayBuffer;
    return new NextResponse(arrayBuffer, {
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
