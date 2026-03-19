# KYC Onboarding — Implementation Plan

**Status:** Pre-implementation review  
**Author:** Tech Lead  
**Date:** 2026-03-11  
**Related docs:** `ONBOARDING_UX_REQUIREMENTS.md`, `BR-001-PERSONAL-INFO-STEP.md`

---

## 1. Overview

This document defines the technical plan for the multi-step KYC (Know Your Customer) onboarding flow. The flow will gate loan applications behind identity verification and runs in two entry points:

1. **Post-registration redirect** — immediately after a user completes signup (sets their password).
2. **On-demand gate** — when a user attempts to submit a loan application from the dashboard without a complete KYC profile.

### KYC Steps

| # | Step | Status trigger |
|---|------|----------------|
| 1 | Quick Intro | Always shown first |
| 2 | Verify Email | Auto-satisfied (user verified email during signup) |
| 3 | Verify Mobile | Requires active completion — Firebase Phone Auth via SMS OTP |
| 4 | Complete Profile | DOB, home address, immigration status |
| 5 | Upload Identity Documents | Driver licence / passport / visa depending on residency |
| 6 | Apply for Loan | Redirect to existing `/applicant/apply` flow |

---

## 2. Firebase Phone Auth — Preview Notice

Firebase Phone Auth (SMS OTP) requires the **Firebase Blaze (pay-as-you-go) plan** in production. The feature itself is stable but carries a per-SMS cost and the Firebase console labels phone auth providers with a usage/billing caveat.

**Emulator support:** Full local testing is supported with the Firebase Auth emulator (`FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`). The emulator accepts a test phone number / fixed OTP pair so no real SMS is sent during development.

### What we're using

| SDK | Approach |
|-----|----------|
| `firebase` (client) v12.10 | `PhoneAuthProvider` + `RecaptchaVerifier` to obtain a `verificationId`, then `linkWithCredential` to attach the phone number to the existing email-authenticated user |
| `firebase-admin` v13.7 | Admin SDK to verify the `uid` claim and update `phoneVerified: true` in Firestore |
| Existing rate limiter | Upstash Redis rate-limit applied to the `/api/kyc/send-phone-otp` route (max 3 SMS per phone per 10 min) |

### Why `linkWithCredential` instead of `signInWithPhoneNumber`

The user is already authenticated via email when they reach the phone verification step. We need to **attach** a phone credential to the existing Firebase user, not create a new one. Using `PhoneAuthProvider.credential(verificationId, otp)` followed by `linkWithCredential(currentUser, credential)` ensures the phone number is associated with the correct UID and Firebase stores it on the `Auth` record.

---

## 3. New Pages & Routes

### 3.1 Pages

All new pages live under the existing `/applicant` layout (already auth-gated by middleware).

```
src/app/applicant/onboarding/
  page.tsx              ← Intro screen (Step 1)
  verify-phone/
    page.tsx            ← SMS OTP entry (Step 3)
  profile/
    page.tsx            ← DOB, address, immigration status (Step 4)
  documents/
    page.tsx            ← Identity document upload (Step 5)
```

Step 2 (email) is handled automatically — the page reads `emailVerified` from the session and marks it complete without user input.

### 3.2 API Routes

```
src/app/api/kyc/
  send-phone-otp/
    route.ts            ← POST: validates phone, rate-limits, triggers Firebase SMS
  verify-phone-otp/
    route.ts            ← POST: verifies OTP server-side, sets phoneVerified in Firestore
  profile/
    route.ts            ← POST: saves DOB, address, immigration status
  documents/
    route.ts            ← POST: validates upload metadata, marks documentsUploaded in Firestore
```

> **Note:** The actual SMS trigger happens on the **client** via `RecaptchaVerifier` + `signInWithPhoneNumber` — Firebase requires DOM access for reCAPTCHA. The `send-phone-otp` route acts as a pre-flight gate (rate limiting + phone number format validation) before the client calls Firebase directly.

---

## 4. Data Model Changes

### 4.1 Firestore `users/{uid}` — new fields

```ts
interface KycFields {
  // Phone verification
  phoneNumber?: string;          // E.164 format e.g. "+6421000000"
  phoneVerified: boolean;        // already exists — confirm it defaults to false on signup

  // KYC profile (Step 4)
  dateOfBirth?: string;          // 🔒 Encrypted — YYYY-MM-DD
  homeAddress?: {
    line1: string;
    suburb?: string;
    city: string;
    postCode: string;
    country: string;             // Default "NZ"
  };
  immigrationStatus?:
    | 'nz_citizen'
    | 'permanent_resident'
    | 'resident_visa'
    | 'work_visa'
    | 'student_visa';

  // Document upload (Step 5)
  identityDocuments?: {
    type: 'nz_drivers_licence' | 'nz_passport' | 'foreign_passport' | 'visa';
    storageRef: string;          // Firebase Storage path (not a public URL)
    uploadedAt: Timestamp;
  }[];
  documentsUploaded: boolean;    // true once required docs are confirmed uploaded

  // Overall KYC status
  kycStatus: 'not_started' | 'in_progress' | 'pending_review' | 'approved' | 'rejected';
  kycStartedAt?: Timestamp;
  kycCompletedAt?: Timestamp;
}
```

**Migrations:** No migration script required for existing users — Firestore is schemaless. Middleware and API routes must treat missing fields as `false` / `not_started`.

### 4.2 `src/types/user.ts` changes

Extend the existing `User` interface with the fields above. The `ApplicantProfile` sub-document and the `User` top-level document should both be updated to align.

---

## 5. Routing & Navigation Logic

### 5.1 Post-registration redirect

After the user completes signup (the existing `/auth/signup` page currently redirects to `/applicant/dashboard`), redirect to `/applicant/onboarding` instead.

Condition: `kycStatus !== 'approved'`

### 5.2 Onboarding step resolution

The intro page (`/applicant/onboarding`) reads the current user's Firestore document and derives the furthest incomplete step:

```ts
function resolveStep(user: User): KycStep {
  if (!user.emailVerified)    return 'verify-email';   // should never reach here
  if (!user.phoneVerified)    return 'verify-phone';
  if (!user.profileComplete)  return 'profile';
  if (!user.documentsUploaded) return 'documents';
  return 'complete';
}
```

The intro screen shows the full checklist (marking email as already ✓) then routes to the first incomplete step on "Continue".

### 5.3 Loan application gate

In `/applicant/apply/page.tsx`, add a server-side guard at the top of the page:

```ts
// Pseudocode
if (user.kycStatus !== 'approved') {
  redirect('/applicant/onboarding?from=apply');
}
```

The `?from=apply` query param allows the final onboarding step to redirect straight to the application form on completion.

### 5.4 Dashboard KYC banner

The dashboard (`src/app/applicant/dashboard/page.tsx`) already has an email verification banner. A second banner for incomplete KYC should be added, following the same amber-coloured design:

```
⚠ Complete your identity verification to apply for a loan. [Continue KYC →]
```

---

## 6. Component Architecture

### 6.1 Shared KYC Step Layout

All steps share a consistent two-column layout consistent with the Swyftx-inspired reference screenshot adapted to TerePay branding:

- **Left panel** (hidden on mobile): step progress list — numbered circles, connecting lines, step labels. Active step highlighted with `#0D1B2A` filled circle, completed steps show a checkmark with `#F5A523` border.
- **Right panel**: white card with the current step content, "Continue" primary button (`bg-[#0D1B2A]` or `bg-[#F5A523]` — decision needed, see §9).

```
src/app/applicant/onboarding/_components/
  KycLayout.tsx           ← Shared layout with step sidebar
  KycStepSidebar.tsx      ← Numbered step list
  KycStepCard.tsx         ← White card wrapper
```

### 6.2 Phone Verification Component (`verify-phone/page.tsx`)

Two sub-states:

1. **Phone entry** — E.164 formatted input with dial-code selector (reuse the `DIAL_CODES` array already defined in `src/app/auth/signup/page.tsx`).
2. **OTP entry** — 6-digit input (individual boxes for UX clarity), 60-second resend cooldown (same pattern as `verify-email` page).

Client-side flow:

```
1. User enters phone number
2. Client calls /api/kyc/send-phone-otp (rate-limit check + format validation)
3. If OK, client instantiates RecaptchaVerifier (invisible) and calls 
   firebase.auth().signInWithPhoneNumber(phone, recaptchaVerifier) — 
   this triggers the actual SMS via Firebase
4. Firebase returns verificationId; store in component state
5. User enters 6-digit OTP
6. Client creates PhoneAuthProvider.credential(verificationId, otp)
7. Client calls linkWithCredential(currentUser, phoneCredential)
8. On success: POST /api/kyc/verify-phone-otp with the refreshed idToken
9. Server verifies token, writes phoneVerified=true to Firestore, returns 200
10. Client navigates to next KYC step
```

**reCAPTCHA note:** Firebase phone auth requires either an invisible or visible reCAPTCHA to prevent abuse. Since the app already uses `react-google-recaptcha-v3`, we should configure `RecaptchaVerifier` with `size: 'invisible'` so the UX is seamless. In the emulator environment, reCAPTCHA is bypassed automatically.

### 6.3 Profile Step (`profile/page.tsx`)

Fields:
- Date of birth — date picker (native `<input type="date">` with max = 18 years ago)
- Home address — reuse the existing `AddressAutocomplete` component from the loan application form
- Immigration status — `<select>` with the following options:
  - `nz_citizen` → NZ Citizen
  - `permanent_resident` → Permanent Resident
  - `resident_visa` → Resident Visa
  - `work_visa` → Work Visa
  - `student_visa` → Student Visa

Validation: Zod schema. DOB must result in an age ≥ 18.

This data is encrypted before writing to Firestore (consistent with the existing `dateOfBirth` field in `ApplicantProfile` which is marked `🔒 Encrypted`). Reuse `src/lib/encryption/crypto.ts`.

### 6.4 Document Upload Step (`documents/page.tsx`)

Required documents by immigration status:

| Immigration Status | Required Documents |
|-------------------|--------------------|
| `nz_citizen` | NZ Driver Licence **or** NZ Passport |
| `permanent_resident` | NZ Driver Licence **or** NZ Passport |
| `resident_visa` | Passport + Visa |
| `work_visa` | Passport + Visa |
| `student_visa` | Passport + Visa |

UI:
- Card per document type showing what to upload and an accepted formats note (JPG, PNG, PDF — max 10 MB).
- Drag-and-drop zone with a file input fallback.
- Upload-in-progress indicator (spinner + percentage if Firebase Storage progress events available).
- Once all required documents are uploaded → show a "Review & Submit" state before calling the API.

Storage:
- Files are stored in Firebase Storage at `kyc-documents/{uid}/{documentType}/{filename}`.
- **Storage rules** must enforce that only the owning user can read/write their own path, and lenders/admin cannot access raw KYC documents directly (admin SDK only).
- After upload, the **Storage reference path** (not a signed URL) is written to Firestore. Signed URLs are generated server-side on demand with short TTLs when a lender / admin needs to review documents.

**No Firebase Storage SDK is currently in `client.ts`** — `getStorage` and `connectStorageEmulator` calls need to be added.

---

## 7. Feature Flag

Gate the entire KYC flow behind a Vercel Feature Flag to allow controlled rollout and instant kill-switch.

```ts
// src/lib/flags/flags.ts — add:
export const kycOnboarding = flag<boolean>({
  key: 'kyc_onboarding',
  decide: () => false, // disabled by default; enable per-environment
});
```

When the flag is `false`:
- Post-registration redirects to `/applicant/dashboard` as it does today.
- The loan application gate is skipped.
- The dashboard KYC banner is hidden.

---

## 8. Firestore Security Rules Changes

Add rules for the new `kyc-documents` storage path and protect the new Firestore KYC fields:

```
// firestore.rules additions

// KYC fields: only the owning user may write their own phone, profile, and document metadata.
// Lenders may not read raw KYC data — only admin (server-side) does.
match /users/{uid} {
  allow read: if request.auth != null && request.auth.uid == uid;
  allow update: if request.auth != null
    && request.auth.uid == uid
    && request.resource.data.role == resource.data.role // cannot self-promote role
    && request.resource.data.kycStatus == resource.data.kycStatus; // cannot self-approve KYC
}
```

The `kycStatus` field (`pending_review` → `approved` / `rejected`) must only be writable via the Admin SDK (server-side), never from a client-side Firestore write.

Firebase Storage rules (in `storage.rules`, to be created):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /kyc-documents/{uid}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

---

## 9. Open Questions — Needs Decision Before Implementation

| # | Question | Options | Impact |
|---|----------|---------|--------|
| 1 | **Primary button colour for KYC flow** | Option A: `#0D1B2A` (dark navy, more formal/serious for KYC) \ Option B: `#F5A523` (amber, consistent with rest of app) | Visual consistency vs. contextual tone |
| 2 | **KYC manual review workflow** | Option A: Auto-approve after document upload (MVP) \ Option B: Flag for manual lender/admin review queue | Requires lender-side UI for Option B |
| 3 | **Document storage backend** | Option A: Firebase Storage (simple, in-ecosystem) \ Option B: S3/R2 (more control, separate billing) | Firebase Storage requires adding `getStorage` to client |
| 4 | **Age verification cutoff** | 18 years old (assumed) | Confirm legal minimum for NZ lending |
| 5 | **Immigration status drives loan eligibility** | Should certain visa types be blocked from applying? (e.g. student visa) | Product decision; affects Step 4 validation logic |
| 6 | **Phone number uniqueness** | Should the same phone number be allowed on multiple accounts? | Firebase enforces uniqueness at the Auth level when phone is linked |
| 7 | **KYC document retention policy** | How long do we keep uploaded documents? | Privacy Act / AML compliance |
| 8 | **Emulator phone test numbers** | Define a list of test phone numbers + fixed OTPs for `emulator-data` | Required before the feature can be fully tested locally |

---

## 10. Implementation Sequence (Suggested Sprint Breakdown)

### Sprint A — Foundation
1. Add `kycOnboarding` feature flag (default off).
2. Extend `src/types/user.ts` with full KYC fields.
3. Update `src/app/auth/signup/page.tsx` to redirect to `/applicant/onboarding` (behind flag).
4. Build `KycLayout`, `KycStepSidebar`, `KycStepCard` shared components.
5. Build the **Intro page** (`/applicant/onboarding/page.tsx`) — static step list with auto-resolved email ✓.

### Sprint B — Phone Verification
6. Add `getStorage` and `connectStorageEmulator` to `src/lib/firebase/client.ts`.
7. Create `POST /api/kyc/send-phone-otp` route with rate limiting.
8. Build **Verify Phone page** — phone entry + OTP entry sub-states using `PhoneAuthProvider` + `linkWithCredential`.
9. Create `POST /api/kyc/verify-phone-otp` route — verifies Firebase ID token, writes `phoneVerified: true` to Firestore.
10. Add test phone numbers to emulator config.

### Sprint C — Profile & Documents
11. Create `POST /api/kyc/profile` route with Zod validation and field encryption.
12. Build **Complete Profile page** — DOB, AddressAutocomplete, immigration status.
13. Set up Firebase Storage bucket and storage rules.
14. Build **Document Upload page** — conditional doc requirements by immigration status, drag-and-drop, Firebase Storage upload.
15. Create `POST /api/kyc/documents` route — validates uploads exist in Storage, writes metadata to Firestore.

### Sprint D — Gating & Polish
16. Add KYC gate to `/applicant/apply/page.tsx` (server-side redirect if `kycStatus !== 'approved'`).
17. Add KYC incomplete banner to applicant dashboard.
18. Update Firestore security rules.
19. Enable `kycOnboarding` flag in staging; QA full flow end-to-end.
20. Production rollout — enable flag for new users first, then existing users.

---

## 11. Environment Variables Required

```bash
# Already present
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...

# New — Firebase Storage bucket
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...   # same project, already in initializeApp config

# Firebase requires the app to be on the Blaze plan for phone auth in production
# No new env vars — phone auth uses the same API key and project
```

The `storageBucket` value is already supplied to `initializeApp` in `client.ts` via `process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`. Only the `getStorage()` call is missing.

---

## 12. Testing Strategy

| Test type | What to cover |
|-----------|--------------|
| Unit | Zod schemas for profile + OTP validation; `resolveStep()` utility |
| Integration (emulator) | Full phone OTP flow using Firebase Auth test phone numbers; Firestore writes from API routes |
| Manual QA | Left-panel step progression; mobile responsiveness; document upload with each immigration status; KYC gate when accessing `/applicant/apply` without completion |
| Security | Attempt to self-set `kycStatus: 'approved'` via client Firestore write — must be rejected by rules; attempt to access another user's KYC documents in Storage |

### Emulator test phone numbers to configure

Add to `emulator-data/auth_export/config.json` (or firebase.json emulator config):

```json
{
  "signIn": {
    "phoneNumber": {
      "+64210000001": "123456",
      "+64210000002": "000000"
    }
  }
}
```

---

## 13. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Firebase SMS cost spikes from abuse | Medium | Rate limit (3 SMS / 10 min per phone) + invisible reCAPTCHA |
| User abandons KYC midway | High | Persist each step's data to Firestore as they complete it; step resolution picks up where they left off |
| Document uploads are large | Medium | Enforce 10 MB max client-side before upload; Firebase Storage has configurable quotas |
| `linkWithCredential` fails if phone already on another account | Low | Firebase throws `auth/credential-already-in-use`; show clear error asking user to use a different number |
| Firebase Phone Auth not available on Spark plan | High (production) | Document that the Firebase project **must** be on Blaze plan before enabling the `kycOnboarding` flag in production |
| Lender reviews sensitive documents | Medium | Storage rules + server-side signed URL generation with audit logging |
