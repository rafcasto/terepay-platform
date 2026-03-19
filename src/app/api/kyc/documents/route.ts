import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { kycDocumentSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * POST /api/kyc/documents
 * Saves document metadata (Google Drive file IDs) to Firestore and marks
 * the user's profile as complete with kycStatus = 'submitted'.
 */
export async function POST(request: NextRequest) {
  try {
    const { uid } = await withAuth(request, ['applicant']);

    const body = await request.json();
    const { documents } = kycDocumentSchema.parse(body);

    const now = FieldValue.serverTimestamp();

    // Store document metadata in a subcollection
    const batch = adminDb.batch();

    const docsCollectionRef = adminDb
      .collection('users')
      .doc(uid)
      .collection('applicantProfile')
      .doc('documents');

    batch.set(docsCollectionRef, {
      documents: documents.map((doc) => ({
        ...doc,
        uploadedAt: now,
        status: 'pending_review',
      })),
      submittedAt: now,
    });

    // Mark profile complete and KYC submitted
    const userRef = adminDb.collection('users').doc(uid);
    batch.update(userRef, {
      profileComplete: true,
      kycStatus: 'submitted',
      kycSubmittedAt: now,
      updatedAt: now,
    });

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(
        new AppError('VALIDATION_ERROR', 422, 'Invalid document data', err.flatten().fieldErrors),
      );
    }
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
