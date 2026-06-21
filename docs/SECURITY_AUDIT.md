# TerePay — Security Audit Reference

This document is the authoritative security checklist for TerePay. It governs every code change before it is pushed. The pre-push hook at `scripts/security-precheck.sh` runs the automated portion; this document covers the full manual review.

**Jurisdiction:** New Zealand. Regulations that apply:
- [Privacy Act 2020](https://www.legislation.govt.nz/act/public/2020/0031/latest/LMS23223.html) (13 Information Privacy Principles — IPPs)
- [CCCFA 2003](https://www.legislation.govt.nz/act/public/2003/0052/latest/DLM211512.html) (Credit Contracts and Consumer Finance Act — responsible lending, affordability)
- [AML/CFT Act 2009](https://www.legislation.govt.nz/act/public/2009/0035/latest/DLM2140700.html) (Anti-Money Laundering / KYC)
- [Financial Markets Conduct Act 2013](https://www.legislation.govt.nz/act/public/2013/0069/latest/DLM4090578.html)
- [CERT NZ Critical Controls](https://www.cert.govt.nz/it-specialists/critical-controls/)

---

## Pre-Push Checklist

Run through every section. Mark each item **PASS / FAIL / N/A**. A single FAIL blocks the push until resolved.

---

### 1. Authentication & Session Management

| # | Check | How to verify |
|---|---|---|
| 1.1 | `withAuth()` is called on **every** API route that reads or writes user-owned data | `grep -r "export async function" src/app/api --include="*.ts" -l` then spot-check each file |
| 1.2 | No route returns user data without first verifying the session cookie | Read each handler — `withAuth` must precede any `adminDb` read returning PII |
| 1.3 | Session cookie `__session` is HttpOnly, Secure, SameSite=Strict | Check cookie-set code in `/api/auth/session/route.ts` |
| 1.4 | Custom claims (`role`) are set before the session cookie is minted, and the ID token is force-refreshed (`getIdToken(true)`) before `createSessionCookie` | Look for `setCustomUserClaims` → must always be followed by `getIdToken(true)` |
| 1.5 | The edge middleware JWT decode is treated as a UX redirect only — full verification still happens in API route handlers | Middleware never reads Firestore or returns data directly |
| 1.6 | Expired/malformed cookies are cleared and redirected to login | Middleware deletes the cookie on `catch` |

---

### 2. Authorisation & Access Control

| # | Check | How to verify |
|---|---|---|
| 2.1 | `withAuth(request, ['lender'])` or `['applicant']` is used wherever role matters — not just `withAuth(request)` | Search for routes under `/api/applications/[id]/decision`, `/api/customers`, `/api/benchmarks` — these must be lender-only |
| 2.2 | Applicants can only access their own applications (`where('applicantId', '==', auth.uid)`) | Any query returning loan applications for an applicant must filter by uid |
| 2.3 | Lenders cannot read or modify another lender's data | Lender-scoped data must be filtered by `createdByLenderId` or similar |
| 2.4 | Offline customer records can only be read/written by the lender who created them | Check `/api/customers/[customerId]` — verify `createdByLenderId === auth.uid` |
| 2.5 | No privilege escalation path — `role` is set **only** by the server via `setCustomUserClaims`, never accepted from the client request body | `grep -r "role" src/app/api --include="*.ts"` — confirm no route accepts a `role` field from the body |
| 2.6 | The SetPay consent and disburse routes are lender-only | `/api/applications/[id]/consent/*` and `/api/applications/[id]/disburse` — lender role enforced |

---

### 3. Input Validation

| # | Check | How to verify |
|---|---|---|
| 3.1 | Every route that accepts a request body calls `.parse()` on a Zod schema before using the data | No route accesses `body.field` without going through Zod |
| 3.2 | Zod schemas reject unexpected fields (`.strict()` or only named fields in `.object()`) | TerePay uses named fields in `z.object()` — check that no schema uses `z.any()` for user-facing inputs |
| 3.3 | Numeric fields have min/max bounds that reflect business limits | e.g., `requestedAmount` is capped at 50 000; `score` fields have 0–100 bounds |
| 3.4 | String fields have `max()` to prevent buffer/DB bloat attacks | Every string field in schemas has a `.max()` |
| 3.5 | File uploads validate MIME type **and** file size server-side (not just client-side) | Check `/api/kyc/upload/route.ts` |
| 3.6 | Dynamic route params (e.g., `[id]`, `[customerId]`) are validated before being used in Firestore queries — no injection via untrusted path segments | Params should be validated/allowlisted; Firestore is not SQL but path traversal is still possible |

---

### 4. PII & Data Privacy (NZ Privacy Act 2020)

| # | Check | How to verify |
|---|---|---|
| 4.1 | All PII fields marked 🔒 in type definitions are encrypted via `src/lib/encryption/crypto.ts` before writing to Firestore | `grep -r "🔒" src/types` — cross-check each field is encrypted at write sites |
| 4.2 | Encrypted payloads are never returned raw to the client — always decrypt server-side | Search for `encrypt(` — confirm the corresponding read path calls `decrypt()` before `NextResponse.json()` |
| 4.3 | `ENCRYPTION_KEY_V1` (and any future versions) is only ever read from `process.env` — never hardcoded | `grep -r "ENCRYPTION_KEY" src --include="*.ts"` — no hardcoded hex strings |
| 4.4 | Old encryption key versions are NOT removed until re-encryption of all documents is complete | `buildKeyMap()` in `crypto.ts` must retain all historical keys |
| 4.5 | KYC documents go to Google Drive (not Firebase Storage or the database) | No base64 file content stored in Firestore |
| 4.6 | API responses do not return more data than required (minimum disclosure) | e.g., applicant responses don't include lender-internal notes; lender responses don't expose other applicants' full PII |
| 4.7 | Audit logs do not contain raw PII — only IDs and actions | `grep -r "auditLog" src --include="*.ts"` — check no log entry includes email, DOB, or financial figures |
| 4.8 | Date of birth is stored encrypted; the 3-way claim verification (DOB + email + name) compares decrypted values server-side only | `/api/customers/[customerId]/claim` — verify DOB comparison happens after `decrypt()` |

**IPP obligations summary (Privacy Act 2020):**

| IPP | Obligation | TerePay implementation |
|---|---|---|
| 1 | Collect only necessary personal information | Loan form collects what is needed for CCCFA affordability assessment — justify any new field added |
| 2 | Collect information directly from the individual where practicable | Applicants self-fill; lender-created offline profiles are flagged separately |
| 3 | Inform individuals why information is collected | Disclosure statement in application declarations section |
| 5 | Protect against loss, access, use, modification, disclosure | AES-256-GCM encryption, Firebase Auth, Firestore rules, `withAuth()` |
| 6 | Allow individuals to access their own information | Applicant profile and application views expose only their own data |
| 7 | Allow individuals to correct their information | Profile edit routes |
| 8–10 | Accuracy, retention limits, cross-border transfer | Data stored in Firebase (Google infrastructure — check region settings) |
| 11 | No disclosure without consent or legal basis | API routes gate on authentication; no third-party sharing without explicit consent |

---

### 5. AML/CFT Compliance (AML/CFT Act 2009)

| # | Check | How to verify |
|---|---|---|
| 5.1 | KYC (Know Your Customer) identity documents are collected before any loan is disbursed | Application status flow: `kycStatus` must be `approved` before `disbursed` |
| 5.2 | PEP (Politically Exposed Person) flag is captured and acted upon | `isPEP` field in `loanRequest` schema — review whether lender affordability tool surfaces this as a red flag |
| 5.3 | Affordability assessment red flags are recorded and must be acknowledged by the lender before proceeding | `redFlagsAcknowledged` map in assessment schema |
| 5.4 | Decision rationale is mandatory for all approve/decline actions | `rationale: z.string().min(10, ...)` in `lenderDecisionSchema` |
| 5.5 | Audit logs provide a tamper-evident timeline of all state transitions | Every status change must have a corresponding `auditLog()` entry |

---

### 6. CCCFA Compliance (Credit Contracts and Consumer Finance Act 2003)

| # | Check | How to verify |
|---|---|---|
| 6.1 | Affordability assessment is completed before any loan is approved | Application cannot transition to `approved` without a completed assessment |
| 6.2 | Disclosure statement is captured and timestamped in declarations | `declarations.submittedAt` is an ISO timestamp set at the point the applicant submits |
| 6.3 | Application fee tier (new vs existing customer) is computed server-side, not trusted from the client | `isExistingCustomer` is inherited from the Firestore user doc — not accepted from the POST body |
| 6.4 | Loan amount does not exceed the assessed affordability | `lenderDecisionSchema.approvedAmount` should not exceed `assessedAmount` without documented rationale |
| 6.5 | All seven declaration checkboxes (CCCFA-aligned) must be `true` before submission is accepted | `declarations` schema uses `.refine((v) => v === true)` on all seven fields |

---

### 7. API & Network Security

| # | Check | How to verify |
|---|---|---|
| 7.1 | Every state-changing route has `export const dynamic = 'force-dynamic'` | Prevents Next.js from caching routes that read cookies/session state |
| 7.2 | Rate limiting is applied — at minimum `defaultLimiter` on all routes, stricter limiters on auth routes | `grep -r "checkRateLimit" src/app/api --include="*.ts"` — every route handler should have this |
| 7.3 | Auth routes use `authLoginLimiter` (5/min) and `authSignupLimiter` (3/5min) — not just `defaultLimiter` | Check `/api/auth/send-otp`, `/api/auth/session`, `/api/auth/signup` |
| 7.4 | reCAPTCHA v3 is verified server-side on all unauthenticated mutation routes | `verifyRecaptcha()` called before business logic in auth routes |
| 7.5 | No sensitive data in URL parameters or query strings — all PII goes in the request body (POST/PATCH) | Route params are IDs only, never email/DOB/financial data |
| 7.6 | Error responses never include stack traces, internal service names, or Firestore document paths | `internalError()` returns a generic message; catch blocks don't re-throw raw errors |
| 7.7 | CORS is not manually opened — rely on Next.js defaults (same-origin only for API routes) | No `Access-Control-Allow-Origin: *` in route handlers |
| 7.8 | External API calls (Qippay, Resend, Twilio, Google reCAPTCHA) use secrets from `process.env` only | `grep -rE "(api_key|secret|token)\s*=\s*['\"]" src` — should return nothing |

---

### 8. Secret & Key Management

| # | Check | How to verify |
|---|---|---|
| 8.1 | No secrets committed to the repository | `git diff --cached --name-only` — `.env.local`, `service-account.json`, `*.pem` must not appear |
| 8.2 | All `NEXT_PUBLIC_*` env vars contain only non-secret, browser-safe values | Review `.env.local.example` or `docs/DEPLOYMENT.md` — Firebase config public keys are intentionally public; anything else under `NEXT_PUBLIC_` is a red flag |
| 8.3 | `ENCRYPTION_KEY_V*` values are 32-byte hex strings (64 chars) — not short passwords | Check key length in documentation; the `buildKeyMap()` function calls `Buffer.from(v1, 'hex')` which silently truncates |
| 8.4 | Firebase Admin service account credentials are provided via `FIREBASE_ADMIN_*` env vars, not a JSON file committed to the repo | No `serviceAccount*.json` in project root or `src/` |
| 8.5 | The Vercel Edge Config token is restricted to read-only access | Verify in Vercel dashboard — only read permissions needed for feature flags |

---

### 9. Audit Trail Integrity

| # | Check | How to verify |
|---|---|---|
| 9.1 | Every state transition on `loanApplications` has a corresponding `auditLog()` call | Check all routes that call `.update({ status: ... })` — each must call `auditLog()` |
| 9.2 | `auditLog()` is called even on failure paths | Catch blocks include `auditLog({ outcome: 'failure', ... })` |
| 9.3 | Audit entries include `userId`, `action`, `targetId`, `targetType`, `outcome`, `ipAddress` | Spot-check a few routes for completeness |
| 9.4 | `getClientIp()` is used for IP — not `request.headers.get('x-real-ip')` directly | `getClientIp` from `@/lib/utils/audit` reads the first `x-forwarded-for` value |
| 9.5 | `auditLogs` collection is not writable by any client-side code | Confirmed by the "no direct Firestore writes from client" rule |

---

### 10. Dependency Security

| # | Check | How to verify |
|---|---|---|
| 10.1 | No known high/critical CVEs in production dependencies | `npm audit --production` — must return 0 critical, 0 high |
| 10.2 | `firebase`, `firebase-admin`, `next`, `zod` are on current minor versions | Check `package.json` against latest releases |
| 10.3 | No new packages introduced without justification | `git diff package.json` — any new dependency needs a comment in the PR explaining why it can't be done with existing packages |
| 10.4 | Dev dependencies are not imported in `src/` — only in scripts | `grep -r "from 'ts-node'" src` — should be empty |

---

### 11. Error Handling & Information Disclosure

| # | Check | How to verify |
|---|---|---|
| 11.1 | All catch blocks either return `errorResponse(err)` (for `AppError`) or `internalError()` (for unknown) | No `catch (err) { return NextResponse.json({ error: err }) }` patterns |
| 11.2 | `ZodError` details are returned as structured `fieldErrors` (safe) — not as the raw Zod error message | Check all `instanceof ZodError` branches |
| 11.3 | Firestore `DocumentNotFound` and internal errors surface as `AppError('NOT_FOUND', 404)` or `internalError()` — not as raw Firebase error codes | Firebase errors are never forwarded directly to the client |
| 11.4 | `console.error` is used for server-side logging of unexpected errors — `console.log` for nothing sensitive | No `console.log(user)`, `console.log(body)` with PII |

---

### 12. Cookie & Browser Security

| # | Check | How to verify |
|---|---|---|
| 12.1 | The `__session` cookie is set with `HttpOnly: true`, `Secure: true`, `SameSite: 'strict'` | Check `/api/auth/session/route.ts` cookie options |
| 12.2 | The cookie has a `maxAge` that matches the Firebase session cookie expiry (default 5 days) | Session cookie expiry and cookie `maxAge` should be aligned |
| 12.3 | On logout, the `__session` cookie is explicitly deleted server-side | `/api/auth/logout/route.ts` must set `maxAge: 0` or call `cookies().delete()` |
| 12.4 | Next.js security headers are set — at minimum `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` | Check `next.config.js` for a `headers()` export |

---

### 13. File Upload Security

| # | Check | How to verify |
|---|---|---|
| 13.1 | Uploaded files are not stored in Firestore — they go to Google Drive via `src/lib/gdrive/client.ts` | No base64 or binary content in Firestore documents |
| 13.2 | MIME type is validated server-side against an allowlist, not just the file extension or the client-provided `Content-Type` | Check `/api/kyc/upload/route.ts` |
| 13.3 | File size is capped server-side | Upload handler enforces a max byte limit |
| 13.4 | Google Drive file IDs returned from uploads are stored (not the file content) and only accessible via authenticated Drive API calls | `driveFileId` in `kycDocumentSchema` — no public URLs |

---

### 14. Third-Party Integration Security

| # | Check | How to verify |
|---|---|---|
| 14.1 | **Qippay SetPay** — `epcId` / `mandateId` returned from the provider is stored and later verified against the same provider before transitioning application to `disbursed` | `reconcile-consent.ts` must re-query Qippay, not trust a client-supplied status |
| 14.2 | **Twilio** — OTP codes expire server-side (not just client-enforced) | OTP route deletes the code after successful verification or after expiry |
| 14.3 | **Resend** — email content does not include PII in subject lines or plain-text fallbacks that bypass encryption | Review email templates for PII exposure |
| 14.4 | **Google Drive** — the service account has only the minimum required permissions (`drive.file` scope) | Check scopes in `src/lib/gdrive/client.ts` |
| 14.5 | **reCAPTCHA** — `action` parameter is validated server-side to prevent token reuse across endpoints | `verifyRecaptcha(token, 'login')` — action string must match |

---

## Automated Pre-Push Checks

The script `scripts/security-precheck.sh` is run automatically by the Claude hook before any `git push`. It checks:

1. **No secrets in staged files** — scans for API keys, base64-encoded credentials, hex strings > 32 chars in source files
2. **No `.env` files staged** — blocks commit of `.env.local`, `*.pem`, `serviceAccount*.json`
3. **`npm audit --production`** — blocks on critical/high CVEs
4. **ESLint** — `npm run lint` must pass
5. **No `console.log` with likely PII** — pattern-matches for `console.log(user`, `console.log(body`, `console.log(email`
6. **No `withAuth` bypass patterns** — checks that no route file has a `POST`/`PUT`/`PATCH`/`DELETE` handler missing `withAuth`

---

## Security Anti-Patterns (Instant Fail)

These are hard FAIL conditions. Any one of them blocks the push until resolved.

```
❌  Storing raw PII in Firestore without encryption
❌  A state-changing API route missing withAuth()
❌  Hardcoded secret, API key, or encryption key in source code
❌  Client-side code writing directly to Firestore
❌  Returning a raw ZodError, Firebase error, or stack trace to the client
❌  Accepting the `role` field from the client request body
❌  any type used for user-controlled input (should be Zod-validated)
❌  A new NEXT_PUBLIC_ env var that contains a secret value
❌  Using Math.random() for security tokens (use crypto.randomBytes() or randomUUID())
❌  Trusting a client-supplied application status or userId in a route body
```

---

## How to Use This in a PR Review

When reviewing a pull request, work through each numbered section above. For each changed file:

1. Identify what category of code it is (API route, component, utility, schema, type).
2. Apply the relevant sections (at minimum: §1–4 for any change touching auth/data, §7 for any new API route, §8 for any env var change).
3. If a check fails, note the section number and line in your review comment so it can be traced back here.

---

*Last reviewed against: Privacy Act 2020, CCCFA 2003, AML/CFT Act 2009, CERT NZ Critical Controls v1.0.*
