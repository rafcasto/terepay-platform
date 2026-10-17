# Feature Flags Implementation Guide

## 1. Overview

Feature flags provide a mechanism to control feature rollout, A/B testing, and operational switches without code deployment. TerePay uses **Vercel Feature Flags (`@vercel/flags`)** exclusively — there is no custom Firestore-backed flag system.

---

## 2. Architecture

```
┌─────────────────────────────────────┐
│   Vercel Dashboard                  │
│   (Create / toggle / target flags)  │
└──────────────┬──────────────────────┘
               │  Edge-propagated config
               ▼
┌─────────────────────────────────────┐
│   @vercel/flags SDK                 │
│   (flag definitions in code)        │
│   src/lib/flags/flags.ts            │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
  Server Components   API Routes
  (await flag())      (await flag())
```

- Flags are **defined in code** using `@vercel/flags/next`.
- Flags are **toggled** via the Vercel Dashboard (no code deploy needed).
- Evaluation happens at the edge — no Firestore reads, no custom engine.

---

## 3. Setup

### 3.1 Install

```bash
npm install @vercel/flags
```

### 3.2 Define Flags

```typescript
// src/lib/flags/flags.ts
import { flag } from '@vercel/flags/next';

export const newApplicantDashboard = flag({
  key: 'new_applicant_dashboard',
  description: 'Redesigned applicant dashboard UI',
  decide: () => false, // default off; overridden in Vercel dashboard
});

export const paymentTrackingV2 = flag({
  key: 'payment_tracking_v2',
  description: 'New payment history interface',
  decide: () => false,
});

export const autoUnderwriting = flag({
  key: 'auto_underwriting',
  description: 'Automated credit assessment',
  decide: () => false,
});
```

### 3.3 Configure `.well-known` endpoint

Vercel needs a metadata endpoint to discover flag definitions.

```typescript
// src/app/.well-known/vercel/flags/route.ts
import { getProviderData } from '@vercel/flags/next';
import * as flags from '@/lib/flags/flags';

export async function GET() {
  const data = await getProviderData(flags);
  return Response.json(data);
}
```

---

## 4. Usage

### 4.1 In Server Components

```tsx
import { newApplicantDashboard } from '@/lib/flags/flags';

export default async function ApplicantDashboard() {
  const showNew = await newApplicantDashboard();
  return showNew ? <NewDashboard /> : <LegacyDashboard />;
}
```

### 4.2 In API Routes

```typescript
import { autoUnderwriting } from '@/lib/flags/flags';

export async function POST(request: NextRequest) {
  const useAuto = await autoUnderwriting();

  if (useAuto) {
    return runAutomatedUnderwriting(request);
  }
  return NextResponse.json({ message: 'Manual review required' });
}
```

### 4.3 Passing Flags to Client Components

Since `@vercel/flags` evaluates on the server, pass the result as a prop:

```tsx
// Server Component
import { paymentTrackingV2 } from '@/lib/flags/flags';

export default async function PaymentPage() {
  const useV2 = await paymentTrackingV2();
  return <PaymentClient useV2={useV2} />;
}

// Client Component
'use client';
export function PaymentClient({ useV2 }: { useV2: boolean }) {
  return useV2 ? <PaymentV2 /> : <PaymentLegacy />;
}
```

---

## 5. Flag Catalog

| Flag Key | Purpose | Default | Initial Rollout |
|----------|---------|---------|-----------------|
| `new_applicant_dashboard` | Redesigned applicant UI | `false` | 25% |
| `payment_tracking_v2` | New payment history | `false` | 10% |
| `auto_underwriting` | Automated credit scoring | `false` | Internal only |
| `disable-sms-otp` | Skip SMS OTP step | `true` | All |
| `env_reset_enabled` | Full environment data reset from admin console | `false` (`ENV_RESET_ENABLED=true`) | Dev/staging only |
| `recaptcha_disabled` | Skip reCAPTCHA v3 (client script + server verify) | `false` (`DISABLE_RECAPTCHA=true`) | Any env except Vercel production |
| `qippay_enabled` | Qippay SetPay/PayBy payment flows; off = lender records repayments manually | `false` (`QIPPAY_ENABLED=true`) | Off until the Qippay authorisation flow goes live |
| `arrears_auto_enabled` | Payment-refresh sweep runs the arrears engine on every live loan; off = lender triggers it per loan | `false` (`ARREARS_AUTO_ENABLED=true`) | Off while repayments are recorded manually |

### 5.1 `recaptcha_disabled`

Lets you run the app without real reCAPTCHA keys.

When on:
- `src/app/auth/layout.tsx` skips rendering `GoogleReCaptchaProvider`, so the Google script never loads and no token is minted.
- `verifyRecaptcha()` short-circuits to `true` before hitting Google's siteverify endpoint.

Default is **off** — opt in with a single runtime env var:

```bash
DISABLE_RECAPTCHA=true
```

Remove the line (or set it to anything other than `true`) to exercise the real
verification path.

**Works in any environment.** The flag is deliberately *not* keyed off
`NEXT_PUBLIC_ENVIRONMENT` — that value is inlined at build time and is set to
`production` in setups that are not production, so it is not a reliable signal here.
`DISABLE_RECAPTCHA` is a plain server-side env var read at request time, so no rebuild
is needed to flip it and it never reaches the client bundle.

**One hard guard remains:** `decide()` returns `false` when `VERCEL_ENV === 'production'`,
regardless of `DISABLE_RECAPTCHA`. reCAPTCHA is the bot and credential-stuffing control
on signup and login, so it stays on where real customer data is. `VERCEL_ENV` is set by
Vercel only on deployments, so this never affects local runs; preview and staging
deployments honour the env var. Flag evaluation in `verifyRecaptcha()` also fails
closed — if the flag throws, verification stays on.

Client code must use `useRecaptchaToken()` from `src/app/auth/recaptcha-provider.tsx`
rather than `useGoogleReCaptcha()` directly — the raw hook throws when the provider
is absent, which is exactly what happens with the flag on.

### 5.2 `qippay_enabled`

The Qippay payment-authorisation integration is **not live yet**, so the whole
Qippay surface sits behind this flag. Default is **off**.

| | Flag **off** — manual repayment mode (default) | Flag **on** — Qippay mode |
|---|---|---|
| Applicant accepts offer | `approved` → `loan_accepted` | `approved` → `awaiting_payment_consent` |
| Bank authorisation step | Not shown | SetPay mandate via `InitiatePaymentConsentCard`; lender's disburse button is locked until the mandate is `active` |
| Disbursement | Lender disburses directly; `initialiseManualSchedule()` writes `scheduledPayments` from the approved figures | `scheduleInstallments()` lodges instalments with Qippay |
| Recording repayments | Lender marks each instalment paid/unpaid on the application page (`ManualPaymentsPanel` → `POST /api/applications/[id]/payments/record`) | Qippay webhook + payment-status polling (`ScheduledPaymentsPanel`) |
| Loan closes | Automatically when the last instalment is marked paid (`closed_repaid`) | Early repayment via PayBy; otherwise stays `active` |
| Early repayment (PayBy) | Not offered | `EarlyRepaymentCard` |
| Payment-refresh sweep | Walks every `disbursed`/`active` loan; arrears only if `arrears_auto_enabled` (§5.3) | Reconciles against Qippay, then arrears if `arrears_auto_enabled` |
| Qippay-only routes (`consent/*`, `early-repayment/*`, `payment-status`, `schedule-payments`, `admin/setpay-testing*`) | `404 FEATURE_DISABLED` | Normal |
| Webhook `/api/webhooks/qippay` | `200 { received: false, reason: 'qippay_disabled' }` | Normal |
| Cron `/api/cron/schedule-payments` | No-op (`skipped: true`) | Normal |
| Admin nav | "SetPay Testing" hidden | Shown |

Turn it on with a runtime env var (no rebuild) or from the Vercel dashboard:

```bash
QIPPAY_ENABLED=true
```

Flag evaluation **fails closed** (`isQippayEnabled()` in `src/lib/qippay/feature.ts`
returns `false` if the flag throws), so a flag outage can never start lodging real
bank mandates. The manual-record route refuses with `409` while the flag is on so a
lender can never overwrite what the bank reported.

Both modes share the same data: `scheduledPayments` on the application is the
source of truth for balances, the arrears engine, statements and the borrower's
tracker, so flipping the flag does not require a data migration. Manually recorded
instalments carry a `manualRecord` (date received, reference, who recorded it) and
are the only ones the "Undo" action can reverse. Applications caught in
`awaiting_payment_consent` when the flag is turned off can still be disbursed —
the consent gate only applies while the flag is on.

### 5.3 `arrears_auto_enabled`

Controls whether the arrears engine ([src/lib/loan/assess-arrears.ts](../src/lib/loan/assess-arrears.ts)
— late payment fees, the payment default fee, post-default interest, dunning reminder
emails) runs **automatically** inside the payment-refresh sweep. Default is **off**.

| | Flag **off** (default) | Flag **on** |
|---|---|---|
| Payment-refresh sweep (cron / admin "Verify now") | Skips the arrears step for every loan | Assesses every live loan after reconciliation |
| Lender's application page | **Arrears assessment** card, badge "Manual only"; "Assess arrears now" runs the engine on that loan (`POST /api/applications/[id]/arrears/assess`) | Same card, badge "Automatic"; the button brings the loan up to date ahead of the next sweep |
| Borrower impact | Nothing is charged or emailed until a lender runs it | Charged/emailed on the sweep's schedule |

The manual trigger is available in both modes, is restricted to the assigned lender on a
`disbursed`/`active` loan, and is idempotent (the engine re-checks fee ids and reminder
keys in a transaction, so pressing it twice never double-charges). Each run is audited as
`arrears_assessment_requested`, plus the engine's own `arrears_fee_assessed` /
`arrears_assessed` entries.

Why it exists: while `qippay_enabled` is off the lender records repayments by hand, and
an automatic sweep would charge a late fee the moment the lender was slower to record a
payment than the borrower was to make it. Keeping arrears manual makes every fee and
reminder a deliberate decision on a loan the lender has just looked at.

```bash
ARREARS_AUTO_ENABLED=true
```

Evaluation fails closed (`isArrearsAutoEnabled()` in `src/lib/loan/arrears-feature.ts`).

---

## 6. Rollout Process

1. **Define** flag in `src/lib/flags/flags.ts` with `decide: () => false`
2. **Deploy** code to production — feature is off for everyone
3. **Toggle** in Vercel Dashboard → Feature Flags → enable for a percentage
4. **Monitor** error rates and user feedback
5. **Increase** rollout: 10% → 25% → 50% → 100%
6. **Remove** flag from code after 2 weeks at 100%, ship the feature as default

---

## 7. Management

- **Dashboard:** Vercel Project → Settings → Feature Flags
- **Targeting:** Percentage-based, user ID targeting, custom rules
- **Propagation:** Changes go live globally within seconds
- **Analytics:** Built-in Vercel analytics for adoption and impact
- No Firestore reads, no custom backend, no maintenance overhead

---

## Document References
- [PLATFORM_PLAN.md](./PLATFORM_PLAN.md) - Architecture overview (Section 6)
- [DEPLOYMENT.md](./DEPLOYMENT.md) - CI/CD integration
