/**
 * One-off script: resets the Firestore customer ID counter to 0.
 * The next customer created will be assigned TERE001.
 *
 * Run against production:
 *   npm run reset:counter:prod
 *
 * WARNING: Resetting while existing customers hold TERE* IDs will cause
 * duplicate ID collisions. The script warns and aborts if existing customers
 * are detected unless --force is passed.
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import * as readline from 'readline';

// Load .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const {
  FIREBASE_ADMIN_PROJECT_ID,
  FIREBASE_ADMIN_CLIENT_EMAIL,
  FIREBASE_ADMIN_PRIVATE_KEY,
} = process.env;

if (!FIREBASE_ADMIN_PROJECT_ID || !FIREBASE_ADMIN_CLIENT_EMAIL || !FIREBASE_ADMIN_PRIVATE_KEY) {
  console.error('❌  Missing FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, or FIREBASE_ADMIN_PRIVATE_KEY in .env.local');
  process.exit(1);
}

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();
const COUNTER_DOC = 'settings/customerIdCounter';
const force = process.argv.includes('--force');

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log(`\n🔧  Customer ID Counter Reset`);
  console.log(`   Project: ${FIREBASE_ADMIN_PROJECT_ID}\n`);

  // Read current counter value
  const counterSnap = await db.doc(COUNTER_DOC).get();
  const currentSequence: number = counterSnap.exists ? (counterSnap.data()?.lastSequence ?? 0) : 0;
  console.log(`📊  Current lastSequence: ${currentSequence}  (last assigned: TERE${String(currentSequence).padStart(3, '0')})`);

  // Count offline customers
  const offlineSnap = await db.collection('offlineCustomers').count().get();
  const offlineCount = offlineSnap.data().count;

  // Count online users with a customerId assigned
  const onlineSnap = await db.collection('users').where('customerId', '!=', '').count().get();
  const onlineCount = onlineSnap.data().count;

  const totalWithId = offlineCount + onlineCount;

  if (totalWithId > 0) {
    console.log(`\n⚠️   WARNING: ${totalWithId} existing customer(s) already have a TERE* ID assigned:`);
    console.log(`     • offlineCustomers collection: ${offlineCount} document(s)`);
    console.log(`     • users with customerId:       ${onlineCount} document(s)`);
    console.log(`\n   Resetting the counter to 0 WILL cause duplicate ID collisions`);
    console.log(`   when the next customer is created (TERE001 will be reused).\n`);

    if (!force) {
      const answer = await prompt('   Type "yes" to proceed anyway, or anything else to abort: ');
      if (answer.toLowerCase() !== 'yes') {
        console.log('\n🚫  Aborted. Counter was NOT changed.\n');
        process.exit(0);
      }
    } else {
      console.log('   --force flag detected, skipping confirmation prompt.\n');
    }
  }

  // Reset the counter
  await db.doc(COUNTER_DOC).set({ lastSequence: 0 }, { merge: true });

  console.log(`\n✅  Counter reset to 0. The next customer will be assigned TERE001.\n`);
}

main().catch((err) => {
  console.error('❌  Unexpected error:', err);
  process.exit(1);
});
