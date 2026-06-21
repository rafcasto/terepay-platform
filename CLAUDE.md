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

## Workflow

- **Always branch from the `dev` branch.** Before starting any task, check out `dev`, pull latest, then create your working branch off it (`git checkout dev && git pull && git checkout -b <branch>`). Never branch off `main`/`master`.
- **On task completion:** build the project (`npm run build`) to surface type/build errors and confirm it passes, then commit your work and push the branch to create a PR (`gh pr create`). A task isn't done until the build is green and a PR exists.

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
- **Styling:** Tailwind v4, utility-first. Brand accent: `#F5A523` (hover `#E08B00`). No inline `style={}` for colors — use Tailwind arbitrary values (`text-[#F5A523]`).
- **Files:** kebab-case for routes/files, PascalCase for React components.
- **`'use client'`:** Add only when required (event handlers, hooks, browser APIs). Pages and layouts are Server Components by default — keep them that way unless there's a concrete reason not to.

## API route pattern (canonical)

```
export const dynamic = 'force-dynamic';

Zod parse  →  withAuth() (role check)  →  rate limit (Upstash)
         →  reCAPTCHA (where applicable)  →  business logic
         →  auditLog()  →  errorResponse() | NextResponse.json()
```

**Full anatomy — see [docs/CODING_PATTERNS.md](docs/CODING_PATTERNS.md#api-route-anatomy).**

**Never bypass `withAuth()` on state-changing routes.** Client code does not write to Firestore directly — it goes through `/api/*`.

## Auth model

- Session cookie `__session` is set after login and verified by `withAuth()` in API routes
- `src/middleware.ts` does an **edge fast-path** JWT decode (expiry + role only) and routes mismatched roles to their dashboard. Full verification still happens server-side in API routes — the edge check is a UX redirect, not a security boundary
- Roles set via Firebase custom claims (`adminAuth.setCustomUserClaims({ role })`) at signup. **After setting claims, force-refresh the ID token (`user.getIdToken(true)`) before minting the session cookie** — propagation lag is otherwise ~5–15s
- `useAuth()` ([src/hooks/useAuth.ts](src/hooks/useAuth.ts)) hydrates client state from `/api/auth/me`

## Security

TerePay handles financial and PII data for NZ customers. Security is non-negotiable.

**Before every `git push`**, the pre-push hook runs `scripts/security-precheck.sh` automatically (after first running `bash scripts/install-git-hooks.sh` on a fresh clone). You can also run it manually at any time:

```bash
bash scripts/security-precheck.sh
```

The script checks: secrets detection · `withAuth()` coverage · rate limiting coverage · PII in logs · raw error forwarding · TypeScript `any` in API routes · direct client Firestore writes · `Math.random()` usage · audit log coverage · npm audit (critical/high) · ESLint.

**Full audit reference — see [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md).** This covers NZ Privacy Act 2020, CCCFA 2003, and AML/CFT Act 2009 requirements in addition to technical security checks. Read the relevant sections before writing any new API route, auth flow, or data model.

**For agents:** before writing or modifying an API route, read [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md) §1–9. Before touching auth or PII handling, read §1–4 in full.

## Documentation index

Don't duplicate these — point at them.

- [docs/QUICK_START.md](docs/QUICK_START.md) — local setup in ~15 minutes
- [docs/FIREBASE_LOCAL_SETUP.md](docs/FIREBASE_LOCAL_SETUP.md) — emulator install + config
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — env vars, dev vs prod projects, Vercel
- [docs/DATA_STRUCTURE.md](docs/DATA_STRUCTURE.md) — Firestore schema (PII fields marked 🔒)
- [docs/FEATURE_FLAGS.md](docs/FEATURE_FLAGS.md) — flag system (Vercel Edge Config / @vercel/flags)
- [docs/KYC_ONBOARDING_IMPLEMENTATION.md](docs/KYC_ONBOARDING_IMPLEMENTATION.md), [docs/ONBOARDING_UX_REQUIREMENTS.md](docs/ONBOARDING_UX_REQUIREMENTS.md) — onboarding flow + UX
- [docs/PLATFORM_PLAN.md](docs/PLATFORM_PLAN.md), [docs/TerePay_LMS_Requirements.md](docs/TerePay_LMS_Requirements.md) — product/architecture intent
- [docs/CODING_PATTERNS.md](docs/CODING_PATTERNS.md) — **canonical code patterns with annotated examples**
- [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md) — **security checklist — NZ Privacy Act, CCCFA, AML/CFT**

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
- **Qippay SetPay consent gate** sits between `loan_accepted` and `disbursed`. The accept route now advances applications to `awaiting_payment_consent`; the applicant must complete a SetPay mandate (status → `active`) before the lender's disburse route will release funds. The SetPay client at [src/lib/qippay/setpay-client.ts](src/lib/qippay/setpay-client.ts) talks to `POST /v1/enduring_initiation` and `GET /v1/enduring_initiation/{epcId}` (Hosted-style: one redirect, no embedded bank picker). `QIPPAY_MODE=live` hits the real API; `QIPPAY_MODE=stub` keeps the integration deterministic for offline dev. Status reconciliation: [src/lib/qippay/reconcile-consent.ts](src/lib/qippay/reconcile-consent.ts).

## Don't

- Don't bypass `withAuth()` on mutating API routes
- Don't write to Firestore from the client — go through `/api/*`
- Don't wipe `emulator-data/` (it's a shared seed snapshot — use `firebase:emulate:clear` only if intentional)
- Don't hand-add `useMemo` / `useCallback` reflexively — React Compiler handles it
- Don't commit `.env.local` or any service-account JSON
- Don't bypass git hooks (`--no-verify`) — the pre-push security check exists for a reason
- Don't assume custom claims are present on the token immediately after `setCustomUserClaims` — force a refresh first
- Don't run `seed:lender:prod` / `reset:counter:prod` without explicit confirmation
- Don't use `any` in TypeScript — use `unknown` and narrow, or define the type properly
- Don't add `'use client'` to a file without a concrete reason (event handlers, hooks, browser APIs)
- Don't introduce new UI libraries or form libraries — use what's already in the stack
- Don't store PII fields in Firestore without encrypting them — mark with 🔒 in type definitions
- Don't use inline `style={}` for brand colors — use Tailwind arbitrary values
- Don't use `Math.random()` for any security-sensitive value — use `crypto.randomBytes()` or `randomUUID()`
- Don't return raw Firebase errors, Zod errors, or stack traces to the client — use `errorResponse()` / `internalError()`

---

## Design System

TerePay uses a brand design system defined in [src/app/globals.css](src/app/globals.css). Every agent working on UI **must read this section** before writing any styling or components.

### Token layers

`globals.css` has two layers of tokens — both are live, both must be preserved:

| Layer | Token style | Purpose |
|---|---|---|
| **App tokens** | `--ink`, `--accent`, `--surface`, `--border` | Used by all existing components — do not remove |
| **DS tokens** | `--orange-500`, `--ink-900`, `--surface-card` | Full design system scale — use for all new work |

### Brand identity

TerePay is a New Zealand micro-lending service for migrant communities. The visual language is **clean, trustworthy, institutional** — warm orange identity on a disciplined navy-slate-and-white base. The orange brings human, optimistic energy; the navy keeps it feeling like a regulated financial service, not a payday app.

**Tagline:** *Borrowing power in your hands.*
**Always beside borrowing CTAs:** *All loans are charged interest (see below).*

### Compliance rules — never break

TerePay is a registered NZ financial service provider (CCCFA / Commerce Commission guidelines, Aug 2025):

- **Never** imply a loan is free, guaranteed, instant-with-no-checks, or consequence-free.
- **Always** keep interest + fees visible wherever an amount or borrow/apply CTA appears.
- **Always** state that applications can be declined and keep hardship + dispute-resolution links reachable.
- CTAs must be honest: "Apply now", "Ready to borrow?", "Check what you'll repay" — never "Get free cash" or "Approved instantly".
- No emoji in product UI (user-generated content is the exception).

### Colour system

Use **semantic aliases** in components. Reach for raw scale tokens only in the token layer.

| Token | Value | Use |
|---|---|---|
| `--orange-500` | `#F08000` | BRAND — surfaces and large graphics only, **never body text on white** |
| `--orange-700` | `#B45600` | Accessible orange **text / CTAs** on white (≥ 4.5:1) |
| `--gold-500` | `#F59A1E` | Hero band amber (≈ `--accent`) |
| `--gold-300` | `#FBC78D` | Peach accent (the "Pay" wordmark colour) |
| `--ink-800` | `#16263B` | Dark surfaces, primary "ink" buttons |
| `--ink-900` | `#0F1D2E` | Text on bright orange/gold surfaces |
| `--slate-50` | `#F6F8FB` | Page background |
| `--text-body` | `#1C2A3A` | Body text (≈ 12:1 on white) |
| `--text-muted` | `--slate-500` | Secondary text (≈ 4.9:1) |
| `--text-accent` | `--orange-700` | Accessible orange text |

**Accessibility contract:**
- `--orange-500` on white fails AA — never use as text.
- `--orange-700` is the minimum for orange text/icon on white.
- Ink text on bright-orange/gold surfaces; white text only on `--orange-700`+.

### Typography

New components should use the DS font tokens (via Tailwind `font-display`, `font-brand`, `font-tabular`). Existing components using `font-sans` / `font-mono` continue to get Inter / JetBrains — both font sets are loaded.

| Token | Family | Use |
|---|---|---|
| `--font-serif` / `font-serif` | Lora | Brand wordmark, big editorial moments |
| `--font-display` / `font-display` | Poppins | Marketing headings |
| `--font-brand` | Public Sans | Body & UI for new DS components |
| `--font-tabular` | IBM Plex Mono | Money figures, reference numbers |
| `--font-sans` / `font-sans` | Inter | Existing components (backward compat) |
| `--font-mono` / `font-mono` | JetBrains Mono | Existing components (backward compat) |

Type scale: `--text-caption` (12px min) → `--text-body-sm` (14) → `--text-body-size` (16) → `--text-h4` (18) → `--text-h3` (20) → `--text-h2` (24) → `--text-h1` (32) → display sizes up to 56px.

### Spacing & radii

4px base grid: `--space-1` (4px) … `--space-24` (96px).

| Token | Value | Use |
|---|---|---|
| `--radius-md` | 10px | Inputs, small controls |
| `--radius` / `--radius-card` | 14px | Cards |
| `--radius-xl` | 20px | Large panels |
| `--radius-2xl` | 28px | Hero/feature surfaces |
| `--radius-pill` | 999px | Tags, chips, pills |

### Shadows

Cool navy-tinted, low opacity — cards lift gently, never float dramatically.

| Token | Use |
|---|---|
| `--shadow-md` | Default card shadow |
| `--shadow-lg` | Elevated panels, modals |
| `--shadow-brand` | Rare warm orange glow for brand emphasis |

### Cards

```css
background: var(--surface-card);
border-radius: var(--radius-card);
border: 1px solid var(--border-default);
box-shadow: var(--shadow-md);
```

Use utility class `.tp-card` or replicate these four rules.

### Motion

Quick and confident — 120–200ms, `--ease-standard`. No decorative looping animation in product UI. All motion respects `prefers-reduced-motion` (handled globally in `globals.css`).

| Token | Value |
|---|---|
| `--dur-fast` | 120ms |
| `--dur-base` | 200ms |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` |

### Focus

Always visible: `2px solid var(--focus-ring)` with `2px offset`. Never remove focus outlines. Handled globally in `globals.css` via `:focus-visible`.

### Icons

Use **Lucide** icons — line style, 20–24px in UI, stroke `1.75`, `currentColor`. The TerePay chevron mark (`/brand/terepay-mark.png`) is the one brand glyph for logo lockups only. No emoji in product UI.

### Logo assets

Stored in `public/brand/`. Use correct variant per surface:

| File | Use |
|---|---|
| `terepay-logo.png` | Primary lockup (chevron mark + wordmark) |
| `terepay-mark.png` | Compact / favicon / icon |
| `terepay-wordmark.png` | Inline / footer |
| `terepay-logo-white.png` | On dark or orange surfaces |
| `terepay-mark-white.png` | Compact on dark/orange |
| `terepay-wordmark-white.png` | Wordmark on dark/orange |

Keep clear space of at least one chevron-height around the mark. Don't recolour or stretch.

### Design system utility classes

| Class | Purpose |
|---|---|
| `.tp-card` | White card with 14px radius, hairline border, `--shadow-md` |
| `.tp-num` | IBM Plex Mono tabular figures (money amounts) |
| `.tp-eyebrow` | Uppercase Poppins label in `--text-accent` |
| `.tp-wave` | Signature concave/convex section-transition wave divider |

### Surfaces

| Context | Background | Text |
|---|---|---|
| Page | `--surface-page` (`#F6F8FB`) | `--text-body` |
| Card | `--surface-card` (white) | `--text-body` |
| Hero/CTA band | `--surface-hero` (amber) | `--text-on-brand` (ink) |
| Dark section | `--surface-inverse` (navy) | `--text-on-inverse` |
| Brand accent | `--surface-brand` (orange) | `--text-on-brand` (ink) |

### Voice & tone

- **Warm but factual** — reassuring yet always paired with real terms.
- **Second person, active** — "you" for the reader, "we" for TerePay.
- **Plain words, short sentences** — "pay back" not "amortise"; spell out jargon.
- **Transparent, never minimising** — costs and decline risk are stated openly.
- **No emoji in product UI.** Sentence case for body; Title Case for a few marketing display lines only.
- Currency: `$1,067.00` NZD, two decimals, comma thousands. Rates as `0.04%`.

### Tailwind mapping

DS tokens are bridged into Tailwind utilities via `@theme inline` in `globals.css`:

```tsx
className="bg-brand text-brand-text border-border-default rounded-card shadow-md"
className="font-display"   // Poppins headings
className="font-tabular"   // IBM Plex Mono money figures
```

See the `@theme inline` block in `globals.css` for the full token → utility mapping.
