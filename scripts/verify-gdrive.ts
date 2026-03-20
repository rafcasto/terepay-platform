/**
 * Diagnostic script: verifies Google Drive integration end-to-end.
 * Runs 4 sequential checks and reports pass/fail with actionable messages.
 *
 * Run:
 *   npm run verify:gdrive
 */

import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { Readable } from 'stream';

// Load .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const PASS = '✓';
const FAIL = '✗';

function log(icon: string, label: string, detail?: string) {
  const base = `  ${icon}  ${label}`;
  console.log(detail ? `${base}\n       ${detail}` : base);
}

async function main() {
  console.log('\n=== Google Drive Integration Verification ===\n');

  // -------------------------------------------------------------------------
  // CHECK 1: Environment variables present
  // -------------------------------------------------------------------------
  console.log('[1/4] Checking environment variables...');

  const email = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const folderId = process.env.GOOGLE_DRIVE_KYC_FOLDER_ID;

  let envOk = true;
  if (!email) {
    log(FAIL, 'GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL is missing');
    envOk = false;
  } else {
    log(PASS, `GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL = ${email}`);
  }
  if (!privateKeyRaw) {
    log(FAIL, 'GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY is missing');
    envOk = false;
  } else {
    const preview = privateKeyRaw.slice(0, 40).replace(/\n/g, '\\n');
    log(PASS, `GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY present (starts: ${preview}...)`);
  }
  if (!folderId) {
    log(FAIL, 'GOOGLE_DRIVE_KYC_FOLDER_ID is missing');
    envOk = false;
  } else {
    log(PASS, `GOOGLE_DRIVE_KYC_FOLDER_ID = ${folderId}`);
  }

  if (!envOk) {
    console.log('\nFix missing env vars in .env.local and re-run.\n');
    process.exit(1);
  }

  // Unescape newlines (same logic as the upload route)
  const privateKey = privateKeyRaw!.replace(/\\n/g, '\n');

  // -------------------------------------------------------------------------
  // CHECK 2: JWT auth — drive.about.get
  // -------------------------------------------------------------------------
  console.log('\n[2/4] Verifying service account credentials (JWT auth)...');

  const auth = new google.auth.JWT({
    email: email!,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });

  let authedEmail: string;
  try {
    const about = await drive.about.get({ fields: 'user' });
    authedEmail = about.data.user?.emailAddress ?? '(unknown)';
    log(PASS, `Authenticated as: ${authedEmail}`);
    if (authedEmail !== email) {
      log(
        FAIL,
        'Authenticated email does not match GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL',
        `Expected: ${email}\nGot:      ${authedEmail}`,
      );
      console.log('\nThe private key belongs to a different service account. Use the JSON key\nfile whose client_email matches GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL.\n');
      process.exit(1);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log(FAIL, `Auth failed: ${msg}`);
    console.log('\nPossible causes:');
    console.log('  • The private key does not belong to this service account email');
    console.log('  • Google Drive API is not enabled in GCP Console');
    console.log('    → https://console.cloud.google.com/apis/library/drive.googleapis.com\n');
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // CHECK 3: KYC folder access
  // -------------------------------------------------------------------------
  console.log('\n[3/4] Checking KYC folder access...');

  try {
    const folder = await drive.files.get({
      fileId: folderId!,
      fields: 'id,name,mimeType',
      supportsAllDrives: true,
    });
    const name = folder.data.name ?? '(no name)';
    const mime = folder.data.mimeType ?? '';
    if (mime !== 'application/vnd.google-apps.folder') {
      log(FAIL, `ID ${folderId} exists but is not a folder (mimeType: ${mime})`);
      process.exit(1);
    }
    log(PASS, `Found folder: "${name}" (${folderId})`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log(FAIL, `Cannot access folder ${folderId}: ${msg}`);
    console.log('\nPossible causes:');
    console.log('  • The folder has not been shared with the service account');
    console.log(`    → In Google Drive, share folder ${folderId} with:`);
    console.log(`      ${email}  (Editor access)`);
    console.log('  • GOOGLE_DRIVE_KYC_FOLDER_ID is wrong');
    console.log('  • If this is a Shared Drive, ensure the service account was added as a member\n');
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // CHECK 4: Upload a tiny test file then delete it
  // -------------------------------------------------------------------------
  console.log('\n[4/4] Upload + delete test file...');

  const testFileName = `verify_gdrive_${Date.now()}.txt`;
  const testContent = `TerePay Drive verification test — ${new Date().toISOString()}`;
  const stream = Readable.from(Buffer.from(testContent, 'utf8'));

  let uploadedId: string;
  try {
    const created = await drive.files.create({
      requestBody: {
        name: testFileName,
        parents: [folderId!],
      },
      media: {
        mimeType: 'text/plain',
        body: stream,
      },
      fields: 'id,name',
      supportsAllDrives: true,
    });
    uploadedId = created.data.id!;
    log(PASS, `Uploaded test file: "${testFileName}" (id: ${uploadedId})`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log(FAIL, `Upload failed: ${msg}`);
    console.log('\nPossible causes:');
    console.log('  • Service account has Viewer access — needs Editor or higher');
    console.log('  • Google Drive storage quota exceeded\n');
    process.exit(1);
  }

  try {
    await drive.files.delete({ fileId: uploadedId, supportsAllDrives: true });
    log(PASS, 'Test file deleted (cleanup successful)');
  } catch {
    log(FAIL, `Could not delete test file ${uploadedId} — delete it manually in Drive`);
  }

  console.log('\n=== All checks passed. Google Drive integration is working. ===\n');
}

main().catch((err) => {
  console.error('\nUnexpected error:', err);
  process.exit(1);
});
