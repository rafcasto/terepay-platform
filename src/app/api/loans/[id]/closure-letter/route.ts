import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { renderClosureLetter } from '@/lib/pdf/closure-letter';
import type { Loan } from '@/types/application';

export const dynamic = 'force-dynamic';

/**
 * GET /api/loans/[id]/closure-letter
 *
 * Returns a PDF closure letter — only available once the loan has been
 * fully repaid (`status === 'closed_repaid'`). Both the applicant who
 * owns the loan and any lender may fetch it.
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
    if (loan.status !== 'closed_repaid') {
      throw new AppError(
        'BAD_REQUEST',
        409,
        'Closure letter is only available for fully repaid loans',
      );
    }

    const closedAtTs = loan.timeline?.closedAt;
    const closedAt =
      closedAtTs && typeof closedAtTs.toDate === 'function'
        ? closedAtTs.toDate().toISOString()
        : new Date().toISOString();

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

    const pdf = await renderClosureLetter({
      loan,
      applicantName,
      referenceNumber,
      closedAt,
      generatedAt: new Date(),
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="terepay-closure-${referenceNumber ?? id.slice(0, 8)}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
