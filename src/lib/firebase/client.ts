'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';

function getClientApp(): FirebaseApp {
  if (getApps().length) return getApp();

  const app = initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });

  // Connect to local emulators in development (browser-only).
  if (process.env.NEXT_PUBLIC_ENVIRONMENT === 'development') {
    const auth = getAuth(app);
    const db = getFirestore(app);

    if (!auth.emulatorConfig) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    }

    // @ts-expect-error _settings is an internal Firestore property
    if (!db._settings?.host?.includes('127.0.0.1')) {
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
  }

  return app;
}

// Lazy proxy — defers Firebase initialization until first use in the browser.
// This prevents the SDK from running during Next.js SSR/SSG (where NEXT_PUBLIC_*
// vars are intentionally absent at build time).

function lazyAuth(): Auth {
  return getAuth(getClientApp());
}

function lazyDb(): Firestore {
  return getFirestore(getClientApp());
}

function makeProxy<T extends object>(getInstance: () => T): T {
  return new Proxy({} as T, {
    get(_t, prop) {
      const instance = getInstance();
      const value = (instance as unknown as Record<string | symbol, unknown>)[prop];
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(instance) : value;
    },
  });
}

export const clientAuth = makeProxy(lazyAuth);
export const clientDb = makeProxy(lazyDb);
export default makeProxy(getClientApp);
