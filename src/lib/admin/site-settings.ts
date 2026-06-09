import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { SiteSettings } from '@/types/admin';
import { DEFAULT_SITE_SETTINGS } from '@/types/admin';

const COLLECTION = 'siteSettings';
const DOC_ID = 'global';

/**
 * Read the global site settings document.
 * Returns defaults if the document does not exist yet.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const snap = await adminDb.collection(COLLECTION).doc(DOC_ID).get();
    if (!snap.exists) return DEFAULT_SITE_SETTINGS;
    const data = snap.data() as SiteSettings;
    return {
      maintenanceMode: {
        public: data.maintenanceMode?.public ?? false,
        applicants: data.maintenanceMode?.applicants ?? false,
        lenders: data.maintenanceMode?.lenders ?? false,
      },
      maintenanceMessage: data.maintenanceMessage ?? DEFAULT_SITE_SETTINGS.maintenanceMessage,
      updatedAt: data.updatedAt,
      updatedBy: data.updatedBy,
    };
  } catch {
    // Fail open — never block users due to a settings read failure
    return DEFAULT_SITE_SETTINGS;
  }
}

/**
 * Persist site settings. Call from admin API routes only.
 */
export async function setSiteSettings(
  patch: Partial<Omit<SiteSettings, 'updatedAt' | 'updatedBy'>>,
  updatedBy: string,
): Promise<void> {
  await adminDb.collection(COLLECTION).doc(DOC_ID).set(
    {
      ...patch,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy,
    },
    { merge: true },
  );
}
