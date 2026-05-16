# TerePay

Lending platform connecting **applicants** (borrowers) with **lenders**. Next.js 16 App Router + Firebase (Auth + Firestore) + TypeScript strict.

Two user roles: `applicant` and `lender`. Two customer models:
- **Online applicants** — Firebase Auth users who self-onboard
- **Offline customers** — created by a lender (friendly IDs like `TERE001`) and later claimed by an online user via 3-way verification (email + DOB + name)

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` | Production build (also surfaces type errors) |
| `npm run lint` | ESLint |
| `npm run firebase:emulate` | Start Auth + Firestore emulators with `./emulator-data` snapshot. **Run this before `npm run dev`.** |
| `npm run firebase:emulate:clear` | Emulator with fresh state (does not import the snapshot) |
| `npm run firebase:export` | Persist current emulator state back to `./emulator-data` |
| `npm run seed:lender` | Seed a lender into the running emulator |
| `npm run seed:lender:prod` | **Production** seed — handle with care |
| `npm run reset:counter:prod` | **Production** customer-ID counter reset — handle with care |
| `npm run verify:gdrive` | Sanity-check Google Drive integration |

**No test runner is configured.** No `typecheck` script — type errors surface via `next build` or your editor.

## Stack

Next.js 16.1.6 · React 19.2.3 · TypeScript 5 (strict) · Tailwind CSS 4 · Firebase 12.10 / firebase-admin 13.7 · Zod 4 + React Hook Form 7 · Twilio (SMS) · Resend (email) · Upstash Ratelimit · `@react-pdf/renderer` · `googleapis` · **Babel React Compiler enabled** (auto-memoization — don't reach for `useMemo` / `useCallback` reflexively).

## Layout

- `src/app/applicant/*` — applicant routes (dashboard, apply, onboarding, profile, applications)
- `src/app/lender/*` — lender routes (dashboard, customers, applications, portfolio, benchmarks)
- `src/app/auth/*` — shared auth pages
- `src/app/api/*` — REST API routes
- `src/lib/firebase/client.ts` — lazy client SDK (proxy pattern, defers init to first browser use)
- `src/lib/firebase/admin.ts` — server-side admin SDK
- `src/lib/auth/middleware.ts` — `withAuth()` server helper
- `src/lib/auth/{onboarding,permissions}.ts` — onboarding gating + role checks
- `src/lib/pdf/affordability-report.tsx` — PDF generation
- `src/middleware.ts` — edge JWT fast-path for `/applicant/*` and `/lender/*`
- `src/hooks/useAuth.ts` — client auth state hydrated from `/api/auth/me`
- `src/types/{user,application,loan,api}.ts` — central types
- `scripts/` — seed + maintenance scripts (uses `tsconfig.scripts.json`)
- `docs/` — see Documentation index below
- `emulator-data/` — **committed** Firebase emulator snapshot. Do not wipe.

Import alias: `@/*` → `./src/*` ([tsconfig.json](tsconfig.json)).

## Conventions

- **Forms:** React Hook Form + Zod schemas. Don't introduce a different validator.
- **Errors:** `AppError` class + `errorResponse()` / `internalError()` helpers. Audit-log security-relevant outcomes via `auditLog()`.
- **Styling:** Tailwind v4, utility-first.
- **Files:** kebab-case for routes/files, PascalCase for React components.

## API route pattern (canonical)

```
Zod parse  →  withAuth() (role check)  →  rate limit (Upstash)
        →  reCAPTCHA (where applicable)  →  business logic
        →  errorResponse() | NextResponse.json()
```

**Never bypass `withAuth()` on state-changing routes.** Client code does not write to Firestore directly — it goes through `/api/*`.

## Auth model

- Session cookie `__session` is set after login and verified by `withAuth()` in API routes
- `src/middleware.ts` does an **edge fast-path** JWT decode (expiry + role only) and routes mismatched roles to their dashboard. Full verification still happens server-side in API routes — the edge check is a UX redirect, not a security boundary
- Roles set via Firebase custom claims (`adminAuth.setCustomUserClaims({ role })`) at signup. **After setting claims, force-refresh the ID token (`user.getIdToken(true)`) before minting the session cookie** — propagation lag is otherwise ~5–15s
- `useAuth()` ([src/hooks/useAuth.ts](src/hooks/useAuth.ts)) hydrates client state from `/api/auth/me`

## Documentation index

Don't duplicate these — point at them.

- [docs/QUICK_START.md](docs/QUICK_START.md) — local setup in ~15 minutes
- [docs/FIREBASE_LOCAL_SETUP.md](docs/FIREBASE_LOCAL_SETUP.md) — emulator install + config
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — env vars, dev vs prod projects, Vercel
- [docs/DATA_STRUCTURE.md](docs/DATA_STRUCTURE.md) — Firestore schema (PII fields marked 🔒)
- [docs/FEATURE_FLAGS.md](docs/FEATURE_FLAGS.md) — flag system (Vercel Edge Config / @vercel/flags)
- [docs/KYC_ONBOARDING_IMPLEMENTATION.md](docs/KYC_ONBOARDING_IMPLEMENTATION.md), [docs/ONBOARDING_UX_REQUIREMENTS.md](docs/ONBOARDING_UX_REQUIREMENTS.md) — onboarding flow + UX
- [docs/PLATFORM_PLAN.md](docs/PLATFORM_PLAN.md), [docs/TerePay_LMS_Requirements.md](docs/TerePay_LMS_Requirements.md) — product/architecture intent

`.env.local` is gitignored. See QUICK_START / DEPLOYMENT for the variable list (`NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_ADMIN_*`, `ENCRYPTION_KEY`, `NEXT_PUBLIC_ENVIRONMENT`, Twilio/Resend/Upstash/reCAPTCHA secrets).

## Things that surprise new agents

- **Lazy Firebase client** — [src/lib/firebase/client.ts](src/lib/firebase/client.ts) uses a proxy to defer SDK init until first browser use, avoiding SSR/build-time errors. Don't replace it with eager init.
- **Emulator auto-wiring** — when `NEXT_PUBLIC_ENVIRONMENT=development`, the client connects to Auth at `127.0.0.1:9099` and Firestore at `127.0.0.1:8080`. The admin SDK reads `FIREBASE_AUTH_EMULATOR_HOST` / `FIRESTORE_EMULATOR_HOST` at request time.
- **Session cookies in emulator** — Firebase doesn't support `createSessionCookie` under the emulator. Auth flow falls back to ID tokens locally.
- **PII encryption** — app-layer AES-256-GCM with key versioning (`ENCRYPTION_KEY_V1`, `_V2`, …). Old versions must remain decryptable across rotations until re-encryption finishes.
- **Rate limiting fails open** — if Upstash is unreachable, the limiter returns allow. It's defense-in-depth, not the only line.
- **reCAPTCHA v3 fails open** — server-side verify at `MIN_SCORE = 0.5`; if the secret is unset, requests pass with a warning log.
- **PDF generation** lives at [src/lib/pdf/affordability-report.tsx](src/lib/pdf/affordability-report.tsx) and uses `@react-pdf/renderer`.
- **KYC documents** upload to Google Drive via `googleapis` — not Firebase Storage.
- **Qippay SetPay consent gate** sits between `loan_accepted` and `disbursed`. The accept route now advances applications to `awaiting_payment_consent`; the applicant must complete a SetPay mandate (status → `active`) before the lender's disburse route will release funds. The SetPay client at [src/lib/qippay/setpay-client.ts](src/lib/qippay/setpay-client.ts) defaults to `QIPPAY_MODE=stub` (deterministic happy path, no upstream calls). Flip to `live` once Qippay developer docs are wired up. Status reconciliation: [src/lib/qippay/reconcile-consent.ts](src/lib/qippay/reconcile-consent.ts).

## Don't

- Don't bypass `withAuth()` on mutating API routes
- Don't write to Firestore from the client — go through `/api/*`
- Don't wipe `emulator-data/` (it's a shared seed snapshot — use `firebase:emulate:clear` only if intentional)
- Don't hand-add `useMemo` / `useCallback` reflexively — React Compiler handles it
- Don't commit `.env.local` or any service-account JSON
- Don't bypass git hooks (`--no-verify`)
- Don't assume custom claims are present on the token immediately after `setCustomUserClaims` — force a refresh first
- Don't run `seed:lender:prod` / `reset:counter:prod` without explicit confirmation
