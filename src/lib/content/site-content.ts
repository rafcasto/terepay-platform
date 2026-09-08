import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  DEFAULT_CONTENT,
  withDefaults,
  type ContentSectionValues,
} from '@/types/content';

const COLLECTION = 'siteContent';

/**
 * Read one content section, merged over its defaults. Fail-open — if the read
 * fails or the doc is missing, returns the built-in defaults so pages never
 * break because of a content read error.
 */
export async function getContentSection(key: string): Promise<ContentSectionValues> {
  try {
    const snap = await adminDb.collection(COLLECTION).doc(key).get();
    if (!snap.exists) return withDefaults(key, undefined);
    const data = snap.data() as { values?: ContentSectionValues } | undefined;
    return withDefaults(key, data?.values);
  } catch {
    return withDefaults(key, undefined);
  }
}

/**
 * Read several sections in one round-trip (defaults-merged, fail-open). Use
 * this in server layouts that feed a `SiteContentProvider`.
 */
export async function getContentSections(
  keys: readonly string[],
): Promise<Record<string, ContentSectionValues>> {
  const out: Record<string, ContentSectionValues> = {};
  if (keys.length === 0) return out;
  try {
    const snaps = await adminDb.getAll(...keys.map((k) => adminDb.collection(COLLECTION).doc(k)));
    snaps.forEach((snap, i) => {
      const key = keys[i];
      const data = snap.exists ? (snap.data() as { values?: ContentSectionValues }) : undefined;
      out[key] = withDefaults(key, data?.values);
    });
  } catch {
    for (const key of keys) out[key] = withDefaults(key, undefined);
  }
  return out;
}

/** Read every known content section (defaults-merged). Used by the editor. */
export async function getAllContent(): Promise<Record<string, ContentSectionValues>> {
  return getContentSections(Object.keys(DEFAULT_CONTENT));
}

/**
 * Persist a content section. Call from the content API route only (after
 * `withAuth` + validation). Only known field keys should reach here.
 */
export async function setContentSection(
  key: string,
  values: ContentSectionValues,
  updatedBy: string,
): Promise<void> {
  await adminDb.collection(COLLECTION).doc(key).set(
    {
      values,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy,
    },
    { merge: true },
  );
}
