import { initializeApp, cert, getApps, getApp, type ServiceAccount, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

function getAdminApp(): App {
  if (getApps().length > 0) return getApp();

  const serviceAccount: ServiceAccount = {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    // Vercel and some CI systems escape newlines in env vars; unescape them.
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  return initializeApp({ credential: cert(serviceAccount) });
}

// Lazy singletons — initialized only on first access (at request time, not build time).
// Firebase Admin SDK automatically reads FIREBASE_AUTH_EMULATOR_HOST and
// FIRESTORE_EMULATOR_HOST from process.env when auth/db instances are created.
let _adminAuth: Auth | null = null;
let _adminDb: Firestore | null = null;

export function getAdminAuth(): Auth {
  if (!_adminAuth) _adminAuth = getAuth(getAdminApp());
  return _adminAuth;
}

export function getAdminDb(): Firestore {
  if (!_adminDb) _adminDb = getFirestore(getAdminApp());
  return _adminDb;
}

/**
 * Verifies either a Firebase session cookie (production) or an ID token
 * (emulator, where createSessionCookie is not supported).
 * Returns the decoded token claims in both cases.
 */
export async function verifySessionOrIdToken(token: string) {
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    return getAdminAuth().verifyIdToken(token);
  }
  return getAdminAuth().verifySessionCookie(token, true);
}

// Proxy objects that forward property access to the lazy singletons.
// This preserves backwards-compat with `adminAuth.xxx` and `adminDb.xxx` call sites.
function makeProxy<T extends object>(getInstance: () => T): T {
  return new Proxy({} as T, {
    get(_t, prop) {
      const instance = getInstance();
      const value = (instance as unknown as Record<string | symbol, unknown>)[prop];
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(instance) : value;
    },
  });
}

export const adminAuth = makeProxy(getAdminAuth);
export const adminDb = makeProxy(getAdminDb);
