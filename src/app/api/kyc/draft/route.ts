import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/kyc/draft
 * Returns any persisted KYC upload drafts for the authenticated user.
 * Shape: { data: { [docType]: { driveFileId, fileName, mimeType, uploadedAt } } }
 */
export async function GET(request: NextRequest) {
  try {
    const { uid } = await withAuth(request, ['applicant']);

    const snap = await adminDb
      .collection('users')
      .doc(uid)
      .collection('applicantProfile')
      .doc('kycDraft')
      .get();

    const uploads: Record<string, unknown> = snap.exists ? (snap.data()?.uploads ?? {}) : {};

    return NextResponse.json({ data: uploads });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
