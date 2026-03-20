import { getAdminDb } from '@/lib/firebase/admin';

/**
 * Returns the URL of the first incomplete onboarding step for the given user,
 * or null if all steps have been completed.
 *
 * Step order:
 *   1. Email verification
 *   2. Phone (SMS) verification
 *   3. Profile details (applicantProfile/profile subcollection)
 *   4. Identity documents (profileComplete flag)
 */
export async function resolveOnboardingStep(uid: string): Promise<string | null> {
  const db = getAdminDb();

  const [userSnap, profileSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('users').doc(uid).collection('applicantProfile').doc('profile').get(),
  ]);

  const user = userSnap.data();

  if (!user?.emailVerified) return '/applicant/onboarding/verify-email';
  if (!user?.phoneVerified) return '/applicant/onboarding/verify-mobile';
  if (!profileSnap.exists) return '/applicant/onboarding/profile';
  if (!user?.profileComplete) return '/applicant/onboarding/identity';

  return null;
}
