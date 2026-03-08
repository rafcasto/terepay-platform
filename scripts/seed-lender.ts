/**
 * Seed script: creates a lender account in Firebase Auth + Firestore.
 * Run once against the emulator:
 *   npm run seed:lender
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const {
  FIREBASE_ADMIN_PROJECT_ID,
  FIREBASE_ADMIN_CLIENT_EMAIL,
  FIREBASE_ADMIN_PRIVATE_KEY,
  LENDER_EMAIL,
  LENDER_PASSWORD,
  LENDER_FIRST_NAME = 'Lender',
  LENDER_LAST_NAME = 'Admin',
} = process.env;

if (!LENDER_EMAIL || !LENDER_PASSWORD) {
  console.error('Set LENDER_EMAIL and LENDER_PASSWORD in .env.local');
  process.exit(1);
}

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

// FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST are set via the
// package.json command before Node.js starts, so the Admin SDK picks them up.
console.log('[seed] Auth emulator:', process.env.FIREBASE_AUTH_EMULATOR_HOST ?? 'PRODUCTION');

const auth = admin.auth();
const db = admin.firestore();

async function main() {
  let uid: string;

  try {
    const existing = await auth.getUserByEmail(LENDER_EMAIL!);
    uid = existing.uid;
    console.log(`User already exists: ${uid}`);
  } catch {
    const user = await auth.createUser({
      email: LENDER_EMAIL,
      password: LENDER_PASSWORD,
      displayName: `${LENDER_FIRST_NAME} ${LENDER_LAST_NAME}`,
    });
    uid = user.uid;
    console.log(`Created user: ${uid}`);
  }

  await auth.setCustomUserClaims(uid, { role: 'lender' });
  console.log('Set role: lender');

  const now = admin.firestore.FieldValue.serverTimestamp();
  await db.collection('users').doc(uid).set(
    {
      uid,
      email: LENDER_EMAIL,
      firstName: LENDER_FIRST_NAME,
      lastName: LENDER_LAST_NAME,
      role: 'lender',
      status: 'active',
      profileComplete: true,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  console.log('Firestore user document upserted.');
  console.log(`\nLender account ready:\n  Email: ${LENDER_EMAIL}\n  UID:   ${uid}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
