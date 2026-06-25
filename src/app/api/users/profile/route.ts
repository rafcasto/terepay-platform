import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
import { withAuth } from '@/lib/auth/middleware';
import { patchProfileSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { FieldValue } from 'firebase-admin/firestore';
import { decrypt } from '@/lib/encryption/crypto';
import { ZodError } from 'zod';

/**
 * GET /api/users/profile
 * Returns a merged flat object from users/{uid} + users/{uid}/applicantProfile/profile.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);

    const [userSnap, profileSnap] = await Promise.all([
      adminDb.collection('users').doc(auth.uid).get(),
      adminDb
        .collection('users')
        .doc(auth.uid)
        .collection('applicantProfile')
        .doc('profile')
        .get(),
    ]);

    if (!userSnap.exists) throw new AppError('NOT_FOUND', 404, 'User not found');

    const merged = {
      id: userSnap.id,
      ...userSnap.data(),
      ...(profileSnap.exists ? profileSnap.data() : {}),
    };

    // Decrypt the owner's own DOB (stored encrypted by the KYC step) so the
    // client can prefill it. Guards for the plaintext form written elsewhere.
    const m = merged as Record<string, unknown>;
    if (typeof m.dateOfBirth === 'string' && /^v\d+:/.test(m.dateOfBirth)) {
      try {
        m.dateOfBirth = decrypt(m.dateOfBirth);
      } catch {
        delete m.dateOfBirth;
      }
    }

    return NextResponse.json({ data: merged, user: merged });
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}

/**
 * PATCH /api/users/profile
 * Writes user-level fields (firstName, lastName) to users/{uid} and
 * applicant profile fields (address, phone, etc.) to the applicantProfile subcollection.
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await withAuth(request);
    const body = await request.json();
    const parsed = patchProfileSchema.parse(body);

    const now = FieldValue.serverTimestamp();

    // Fields that belong on the top-level user document
    const userFields: Record<string, unknown> = { updatedAt: now };
    if (parsed.firstName != null) userFields.firstName = parsed.firstName;
    if (parsed.lastName != null) userFields.lastName = parsed.lastName;
    if (parsed.profilePhotoUrl != null) userFields.profilePhotoUrl = parsed.profilePhotoUrl;

    // Fields that belong in the applicantProfile subcollection
    const profileFields: Record<string, unknown> = { profileLastUpdatedAt: now };
    const phone = parsed.phone ?? parsed.phoneNumber;
    if (phone != null) profileFields.phone = phone;
    if (parsed.dateOfBirth != null) profileFields.dateOfBirth = parsed.dateOfBirth;

    // address can be a string (loan form) or object (profile settings page)
    if (typeof parsed.address === 'string') {
      profileFields.address = parsed.address;
    } else if (parsed.address && typeof parsed.address === 'object') {
      if (parsed.address.street) profileFields.address = parsed.address.street;
      if (parsed.address.city) profileFields.city = parsed.address.city;
      if (parsed.address.state) profileFields.state = parsed.address.state;
      if (parsed.address.zipCode) profileFields.postCode = parsed.address.zipCode;
      if (parsed.address.country) profileFields.country = parsed.address.country;
    }

    if (parsed.suburb != null) profileFields.suburb = parsed.suburb;
    if (parsed.city != null) profileFields.city = parsed.city;
    if (parsed.postCode != null) profileFields.postCode = parsed.postCode;
    if (parsed.country != null) profileFields.country = parsed.country;
    if (parsed.housingStatus != null) profileFields.housingStatus = parsed.housingStatus;
    if (parsed.timeAtAddress != null) profileFields.timeAtAddress = parsed.timeAtAddress;
    if (parsed.visaStatus != null) profileFields.visaStatus = parsed.visaStatus;
    if (parsed.visaExpiryDate != null) profileFields.visaExpiryDate = parsed.visaExpiryDate;
    if (parsed.householdType != null) profileFields.householdType = parsed.householdType;
    if (parsed.numberOfChildren != null) profileFields.numberOfChildren = parsed.numberOfChildren;
    if (parsed.numberOfDependents != null) profileFields.numberOfDependents = parsed.numberOfDependents;

    const writes: Promise<unknown>[] = [
      adminDb.collection('users').doc(auth.uid).update(userFields),
    ];

    if (Object.keys(profileFields).length > 1) {
      writes.push(
        adminDb
          .collection('users')
          .doc(auth.uid)
          .collection('applicantProfile')
          .doc('profile')
          .set(profileFields, { merge: true }),
      );
    }

    await Promise.all(writes);

    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(
        new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors),
      );
    }
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
