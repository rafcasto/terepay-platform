import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { kycProfileSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { adminDb } from '@/lib/firebase/admin';
import { encrypt } from '@/lib/encryption/crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/kyc/profile
 * Saves the KYC profile step data:
 * – DOB (encrypted), immigration status, housing status, time at address, address fields.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { uid } = await withAuth(request, ['applicant']);

    const body = await request.json();
    const data = kycProfileSchema.parse(body);

    // Encrypt date of birth (PII)
    const encryptedDob = encrypt(data.dateOfBirth);

    const profileRef = adminDb
      .collection('users')
      .doc(uid)
      .collection('applicantProfile')
      .doc('profile');

    await profileRef.set(
      {
        dateOfBirth: encryptedDob,
        immigrationStatus: data.immigrationStatus,
        visaExpiryDate: data.visaExpiryDate ?? null,
        housingStatus: data.housingStatus,
        timeAtAddress: data.timeAtAddress,
        address: data.address,
        suburb: data.suburb ?? '',
        city: data.city,
        postCode: data.postCode,
        country: data.country ?? 'New Zealand',
        profileLastUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    // Also bump the parent user document updatedAt
    await adminDb.collection('users').doc(uid).update({
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(
        new AppError('VALIDATION_ERROR', 422, 'Invalid profile data', err.flatten().fieldErrors),
      );
    }
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
