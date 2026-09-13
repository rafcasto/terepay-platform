import { adminDb } from '@/lib/firebase/admin';
import type { AuthResult } from '@/lib/auth/middleware';
import { AppError } from '@/lib/utils/api-error';

/** Roles that can hold model-training access. Admins always have it; lenders need the per-user grant. */
export const TRAINING_ROLES = ['admin', 'lender'] as const;

export type TrainingAccess = { isAdmin: boolean };

/**
 * Model-training access is a per-user grant (`users/{uid}.trainingAccess`)
 * an admin switches on from the Users page. It is a Firestore flag rather
 * than a custom claim so it applies immediately without a re-login.
 */
export async function hasTrainingAccess(uid: string, roles: readonly string[]): Promise<TrainingAccess | null> {
  if (roles.includes('admin')) return { isAdmin: true };
  if (!roles.includes('lender')) return null;
  const snap = await adminDb.collection('users').doc(uid).get();
  const data = snap.data();
  if (!snap.exists || data?.trainingAccess !== true || data?.status !== 'active') return null;
  return { isAdmin: false };
}

/** Call right after `withAuth(request, ['admin', 'lender'])`. Throws 403 when the user has no grant. */
export async function assertTrainingAccess(auth: AuthResult): Promise<TrainingAccess> {
  const access = await hasTrainingAccess(auth.uid, auth.roles);
  if (!access) throw new AppError('FORBIDDEN', 403, 'Model training access has not been granted to your account');
  return access;
}
