/**
 * Seed script: creates an admin account in Firebase Auth + Firestore.
 * Run against the emulator:
 *   npm run seed:admin
 * Run against production (use with caution):
 *   npm run seed:admin:prod
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const {
  FIREBASE_ADMIN_PROJECT_ID,
  FIREBASE_ADMIN_CLIENT_EMAIL,
  FIREBASE_ADMIN_PRIVATE_KEY,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_FIRST_NAME = 'Admin',
  ADMIN_LAST_NAME = 'User',
} = process.env;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local');
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

console.log('[seed:admin] Auth emulator:', process.env.FIREBASE_AUTH_EMULATOR_HOST ?? 'PRODUCTION');

const auth = admin.auth();
const db = admin.firestore();

async function main() {
  let uid: string;

  try {
    const existing = await auth.getUserByEmail(ADMIN_EMAIL!);
    uid = existing.uid;
    console.log(`User already exists: ${uid} — updating claims.`);
  } catch {
    const user = await auth.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      displayName: `${ADMIN_FIRST_NAME} ${ADMIN_LAST_NAME}`,
      emailVerified: true,
    });
    uid = user.uid;
    console.log(`Created user: ${uid}`);
  }

  await auth.setCustomUserClaims(uid, { role: 'admin' });
  console.log('Set role: admin');

  const now = admin.firestore.FieldValue.serverTimestamp();
  await db.collection('users').doc(uid).set(
    {
      uid,
      email: ADMIN_EMAIL,
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      role: 'admin',
      status: 'active',
      profileComplete: true,
      kycStatus: 'approved',
      phoneVerified: false,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  console.log('Firestore user document upserted.');
  console.log(`\nAdmin account ready:\n  Email: ${ADMIN_EMAIL}\n  UID:   ${uid}`);
  console.log('\nLogin at /auth/login then visit /admin/dashboard');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
