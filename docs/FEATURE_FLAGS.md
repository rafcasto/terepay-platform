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
