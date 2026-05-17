import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { renderLoanStatement } from '@/lib/pdf/loan-statement';
import type { Loan } from '@/types/application';

export const dynamic = 'force-dynamic';

/**
 * GET /api/loans/[id]/statement
 *
 * Returns a PDF statement of the loan. Available to the applicant who
 * owns the loan or any lender (lenders see all). Includes the disbursement
 * summary and the full instalment schedule with current statuses.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await withAuth(request, ['applicant', 'lender']);
    const { id } = await params;

    const snap = await adminDb.collection('loans').doc(id).get();
    if (!snap.exists) {
      throw new AppError('NOT_FOUND', 404, 'Loan not found');
    }
    const loan = snap.data() as Loan;

    if (auth.role === 'applicant' && loan.applicantId !== auth.uid) {
      throw new AppError('NOT_FOUND', 404, 'Loan not found');
    }

    // Get applicant name + reference number from the application doc.
    let applicantName: string | undefined;
    let referenceNumber: string | undefined;
    const appSnap = await adminDb
      .collection('loanApplications')
      .doc(loan.applicationId)
      .get();
    if (appSnap.exists) {
      const app = appSnap.data()!;
      referenceNumber = app.referenceNumber as string | undefined;
      const pi = app.personalInfo as { firstName?: string; lastName?: string } | undefined;
      if (pi?.firstName) {
        applicantName = pi.lastName ? `${pi.firstName} ${pi.lastName}` : pi.firstName;
      }
    }

    const pdf = await renderLoanStatement({
      loan,
      applicantName,
      referenceNumber,
      generatedAt: new Date(),
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="terepay-statement-${referenceNumber ?? id.slice(0, 8)}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
