import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { AppError } from '@/lib/utils/api-error';
import { auditLog } from '@/lib/utils/audit';
import { normalizeRoles } from '@/lib/auth/roles';
import { loanCollectionMode, type LoanCollectionMode } from '@/lib/loan/collection-mode';
import type { LoanApplication } from '@/types/application';

/**
 * Admin data cleanup — remove test / non-production borrowers and loan
 * applications from a live environment one record at a time, with every
 * dependent record cascaded, instead of the all-or-nothing environment reset.
 *
 * Safeguards:
 *   - only `applicant` accounts can be deleted here — staff and admins never;
 *   - a borrower with a live loan (or a live application) is refused unless
 *     the caller explicitly opts in with `includeLiveLoans`;
 *   - every deletion is audit-logged individually, after the fact.
 *
 * What is NOT touched: KYC files in Google Drive (the Drive folder keeps its
 * own retention), audit logs, counters, and offline customer records — a
 * linked offline customer is unlinked, not deleted, because a lender created
 * it on purpose.
 */

const LIVE_STATUSES = new Set(['disbursed', 'active', 'awaiting_payment_consent', 'loan_accepted']);

export interface CleanupBorrower {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  customerId: string | null;
  status: string;
  profileComplete: boolean;
  createdAt: number | null;
  lastLoginAt: number | null;
  applicationCount: number;
  liveLoanCount: number;
}

export interface CleanupApplication {
  id: string;
  referenceNumber: string | null;
  status: string;
  applicantId: string;
  applicantEmail: string | null;
  applicantName: string | null;
  offlineCustomerId: string | null;
  requestedAmount: number | null;
  createdAt: number | null;
  isLive: boolean;
  collectionMode: LoanCollectionMode;
}

function toMillis(value: unknown): number | null {
  const v = value as { toMillis?: () => number } | undefined;
  return typeof v?.toMillis === 'function' ? v.toMillis() : null;
}

/** Every borrower account plus every application, for the cleanup page. */
export async function listCleanupCandidates(): Promise<{
  borrowers: CleanupBorrower[];
  applications: CleanupApplication[];
}> {
  const [usersSnap, appsSnap] = await Promise.all([
    adminDb.collection('users').where('role', '==', 'applicant').limit(1000).get(),
    adminDb.collection('loanApplications').orderBy('timeline.createdAt', 'desc').limit(1000).get(),
  ]);

  const userById = new Map<string, FirebaseFirestore.DocumentData>();
  for (const doc of usersSnap.docs) userById.set(doc.id, doc.data());

  const appCount = new Map<string, number>();
  const liveCount = new Map<string, number>();

  const applications: CleanupApplication[] = appsSnap.docs.map((doc) => {
    const d = doc.data();
    const applicantId = typeof d.applicantId === 'string' ? d.applicantId : '';
    const status = typeof d.status === 'string' ? d.status : 'unknown';
    const isLive = LIVE_STATUSES.has(status);
    appCount.set(applicantId, (appCount.get(applicantId) ?? 0) + 1);
    if (isLive) liveCount.set(applicantId, (liveCount.get(applicantId) ?? 0) + 1);
    const user = userById.get(applicantId);
    return {
      id: doc.id,
      referenceNumber: typeof d.referenceNumber === 'string' ? d.referenceNumber : null,
      status,
      applicantId,
      applicantEmail: typeof user?.email === 'string' ? user.email : null,
      applicantName: user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || null : null,
      offlineCustomerId: typeof d.offlineCustomerId === 'string' ? d.offlineCustomerId : null,
      requestedAmount: typeof d.loanDetails?.requestedAmount === 'number' ? d.loanDetails.requestedAmount : null,
      createdAt: toMillis(d.timeline?.createdAt),
      isLive,
      collectionMode: loanCollectionMode(d as Pick<LoanApplication, 'paymentConsent' | 'scheduledPayments'>),
    };
  });

  const borrowers: CleanupBorrower[] = usersSnap.docs
    .map((doc) => {
      const d = doc.data();
      return {
        uid: doc.id,
        email: typeof d.email === 'string' ? d.email : '',
        firstName: typeof d.firstName === 'string' ? d.firstName : '',
        lastName: typeof d.lastName === 'string' ? d.lastName : '',
        customerId: typeof d.customerId === 'string' ? d.customerId : null,
        status: typeof d.status === 'string' ? d.status : 'unknown',
        profileComplete: d.profileComplete === true,
        createdAt: toMillis(d.createdAt),
        lastLoginAt: toMillis(d.lastLoginAt),
        applicationCount: appCount.get(doc.id) ?? 0,
        liveLoanCount: liveCount.get(doc.id) ?? 0,
      };
    })
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  return { borrowers, applications };
}

async function deleteByQuery(query: FirebaseFirestore.Query): Promise<number> {
  const snap = await query.get();
  if (snap.empty) return 0;
  const batch = adminDb.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return snap.size;
}

async function deleteCollectionPath(path: string): Promise<number> {
  let deleted = 0;
  for (;;) {
    const snap = await adminDb.collection(path).limit(400).get();
    if (snap.empty) break;
    const batch = adminDb.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < 400) break;
  }
  return deleted;
}

export interface DeleteApplicationSummary {
  applicationId: string;
  status: string;
  affordabilityAssessments: number;
  creditAssessments: number;
  loanRecord: boolean;
}

/**
 * Delete one loan application and everything keyed to it: affordability
 * assessments, AI credit assessments and the canonical `loans` record.
 * Refuses a live loan unless `includeLiveLoans` is set.
 */
export async function deleteApplicationCascade(opts: {
  applicationId: string;
  includeLiveLoans: boolean;
  actor: string;
  ip?: string;
}): Promise<DeleteApplicationSummary> {
  const { applicationId, includeLiveLoans, actor, ip } = opts;
  const appRef = adminDb.collection('loanApplications').doc(applicationId);
  const snap = await appRef.get();
  if (!snap.exists) throw new AppError('NOT_FOUND', 404, `Application ${applicationId} not found`);
  const data = snap.data()!;
  const status = typeof data.status === 'string' ? data.status : 'unknown';

  if (LIVE_STATUSES.has(status) && !includeLiveLoans) {
    throw new AppError(
      'CONFLICT',
      409,
      `Application ${data.referenceNumber ?? applicationId} is a live loan (${status}). Tick "include live loans" to delete it.`,
    );
  }

  const [affordabilityAssessments, creditAssessments] = await Promise.all([
    deleteByQuery(adminDb.collection('affordabilityAssessments').where('applicationId', '==', applicationId)),
    deleteByQuery(adminDb.collection('creditAssessments').where('applicationId', '==', applicationId)),
  ]);

  const loanRef = adminDb.collection('loans').doc(applicationId);
  const loanSnap = await loanRef.get();
  if (loanSnap.exists) await loanRef.delete();

  await appRef.delete();

  await auditLog({
    userId: actor,
    action: 'admin_delete_application',
    targetId: applicationId,
    targetType: 'application',
    outcome: 'success',
    ipAddress: ip,
    changes: {
      status,
      referenceNumber: data.referenceNumber ?? null,
      applicantId: data.applicantId ?? null,
      affordabilityAssessments,
      creditAssessments,
      loanRecord: loanSnap.exists,
      includeLiveLoans,
    },
  });

  return { applicationId, status, affordabilityAssessments, creditAssessments, loanRecord: loanSnap.exists };
}

export interface DeleteBorrowerSummary {
  uid: string;
  email: string | null;
  applications: number;
  offlineCustomersUnlinked: number;
  authUserDeleted: boolean;
}

/**
 * Delete one borrower account end to end: every application they own
 * (cascaded), their profile subcollections, the user document and the
 * Firebase Auth account. A linked offline customer record is unlinked so a
 * lender can re-issue it; it is not deleted.
 */
export async function deleteBorrowerCascade(opts: {
  uid: string;
  includeLiveLoans: boolean;
  actor: string;
  ip?: string;
}): Promise<DeleteBorrowerSummary> {
  const { uid, includeLiveLoans, actor, ip } = opts;
  if (uid === actor) throw new AppError('FORBIDDEN', 403, 'You cannot delete your own account');

  const userRef = adminDb.collection('users').doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) throw new AppError('NOT_FOUND', 404, `User ${uid} not found`);
  const user = userSnap.data()!;

  const roles = normalizeRoles(user.role, user.roles);
  if (roles.some((r) => r !== 'applicant')) {
    throw new AppError('FORBIDDEN', 403, 'Only borrower accounts can be deleted here — manage staff on the Users page');
  }

  const appsSnap = await adminDb.collection('loanApplications').where('applicantId', '==', uid).get();

  // Check every application before deleting any, so a refusal leaves the
  // borrower whole rather than half-deleted.
  if (!includeLiveLoans) {
    const live = appsSnap.docs.find((d) => LIVE_STATUSES.has(String(d.data().status)));
    if (live) {
      throw new AppError(
        'CONFLICT',
        409,
        `${user.email ?? uid} has a live loan (${live.data().referenceNumber ?? live.id}). Tick "include live loans" to delete this borrower.`,
      );
    }
  }

  for (const doc of appsSnap.docs) {
    await deleteApplicationCascade({ applicationId: doc.id, includeLiveLoans: true, actor, ip });
  }

  await Promise.all([
    deleteCollectionPath(`users/${uid}/applicantProfile`),
    deleteCollectionPath(`users/${uid}/lenderReports`),
    deleteCollectionPath(`users/${uid}/creditSummary`),
  ]);

  // Unlink (do not delete) any offline customer this account had claimed.
  const linkedSnap = await adminDb.collection('offlineCustomers').where('linkedUid', '==', uid).get();
  if (!linkedSnap.empty) {
    const batch = adminDb.batch();
    linkedSnap.docs.forEach((doc) =>
      batch.update(doc.ref, {
        status: 'unlinked',
        linkedUid: FieldValue.delete(),
        linkedAt: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      }),
    );
    await batch.commit();
  }

  await userRef.delete();

  let authUserDeleted = false;
  try {
    await adminAuth.deleteUser(uid);
    authUserDeleted = true;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== 'auth/user-not-found') throw err;
  }

  await auditLog({
    userId: actor,
    action: 'admin_delete_borrower',
    targetId: uid,
    targetType: 'users',
    outcome: 'success',
    ipAddress: ip,
    changes: {
      email: user.email ?? null,
      customerId: user.customerId ?? null,
      applications: appsSnap.size,
      offlineCustomersUnlinked: linkedSnap.size,
      authUserDeleted,
      includeLiveLoans,
    },
  });

  return {
    uid,
    email: typeof user.email === 'string' ? user.email : null,
    applications: appsSnap.size,
    offlineCustomersUnlinked: linkedSnap.size,
    authUserDeleted,
  };
}
