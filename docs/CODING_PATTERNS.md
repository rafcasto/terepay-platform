# TerePay — Coding Patterns

Authoritative reference for how code is written in this repo. When in doubt, follow what's already here rather than importing something new. All examples are derived from real production files.

---

## Table of Contents

1. [API Route Anatomy](#api-route-anatomy)
2. [Zod Schemas & Inferred Types](#zod-schemas--inferred-types)
3. [Error Handling](#error-handling)
4. [Auth & Role Gating](#auth--role-gating)
5. [Firestore Access Patterns](#firestore-access-patterns)
6. [Audit Logging](#audit-logging)
7. [React Components](#react-components)
8. [Client-Side Data Fetching](#client-side-data-fetching)
9. [TypeScript Rules](#typescript-rules)
10. [PII & Encryption](#pii--encryption)
11. [Styling Conventions](#styling-conventions)
12. [File & Export Conventions](#file--export-conventions)

---

## API Route Anatomy

Every route handler follows the same pipeline. Don't reorder the steps.

```ts
// src/app/api/some-resource/route.ts

import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { someSchema } from '@/lib/validation/schemas';
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';
import { auditLog, getClientIp } from '@/lib/utils/audit';
import { defaultLimiter, checkRateLimit } from '@/lib/rate-limit/limiter';
import { adminDb } from '@/lib/firebase/admin';
import { ZodError } from 'zod';

// Required — prevents Next.js from statically caching routes that read
// request context (cookies, headers).
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  let uid = 'unknown'; // used in failure audit log before auth resolves

  try {
    // 1. Rate limit (pre-auth, keyed on IP)
    const allowed = await checkRateLimit(defaultLimiter, ip);
    if (!allowed) {
      return errorResponse(new AppError('RATE_LIMITED', 429, 'Too many requests.'));
    }

    // 2. Auth + role check
    const auth = await withAuth(request, ['lender']); // omit array to allow any role
    uid = auth.uid;

    // 3. Parse + validate body
    const body = await request.json();
    const parsed = someSchema.parse(body); // throws ZodError on failure

    // 4. Business logic (Firestore reads/writes via adminDb)
    const doc = await adminDb.collection('someCollection').doc(parsed.id).get();
    if (!doc.exists) {
      return errorResponse(new AppError('NOT_FOUND', 404, 'Resource not found'));
    }

    await adminDb.collection('someCollection').doc(parsed.id).update({
      field: parsed.value,
    });

    // 5. Audit log — always on state change
    await auditLog({
      userId: uid,
      action: 'some_action',
      targetId: parsed.id,
      targetType: 'someCollection',
      outcome: 'success',
      ipAddress: ip,
      userAgent: request.headers.get('user-agent') ?? '',
    });

    // 6. Return success
    return NextResponse.json({ data: { id: parsed.id } });

  } catch (err) {
    // ZodError → 422 with field details
    if (err instanceof ZodError) {
      return errorResponse(
        new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors),
      );
    }
    // Known AppError → forward its status/code
    if (err instanceof AppError) return errorResponse(err);

    // Unknown → audit the failure, return 500
    await auditLog({ userId: uid, action: 'some_action', targetType: 'someCollection', outcome: 'failure', ipAddress: ip });
    return internalError();
  }
}
```

### GET routes are simpler — no body, no reCAPTCHA

```ts
export async function GET(request: NextRequest) {
  try {
    const auth = await withAuth(request);           // any role
    await checkRateLimit(defaultLimiter, auth.uid); // post-auth, keyed on uid

    const snap = await adminDb.collection('someCollection')
      .where('ownerId', '==', auth.uid)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ data: items });

  } catch (err) {
    if (err instanceof AppError) return errorResponse(err);
    return internalError();
  }
}
```

### Dynamic segment routes

```ts
// src/app/api/some-resource/[id]/route.ts

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params; // Next.js 16: params is a Promise
  // ... rest of handler
}
```

---

## Zod Schemas & Inferred Types

All schemas live in `src/lib/validation/schemas.ts`. Add new schemas there — don't define them inline in route files unless they're route-local and small.

```ts
// In schemas.ts

// 1. Define the schema
export const mySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  amount: z.number().min(0),
  status: z.enum(['active', 'inactive']),
});

// 2. Export the inferred type alongside it
export type MyInput = z.infer<typeof mySchema>;
```

Use `.parse()` (throws) not `.safeParse()` in route handlers — the catch block handles `ZodError` centrally.

For partial/draft versions, derive from the full schema:

```ts
export const myDraftSchema = mySchema.partial(); // all fields optional
// or pick specific fields:
export const myPatchSchema = mySchema.pick({ name: true, status: true }).partial();
```

---

## Error Handling

### In API routes

```ts
import { AppError, errorResponse, internalError } from '@/lib/utils/api-error';

// Throw known errors; the catch block translates them
throw new AppError('NOT_FOUND', 404, 'Application not found');
throw new AppError('FORBIDDEN', 403, 'You do not have access to this resource');
throw new AppError('VALIDATION_ERROR', 422, 'Invalid input', fieldDetails);

// In catch:
if (err instanceof ZodError) {
  return errorResponse(new AppError('VALIDATION_ERROR', 422, 'Invalid request', err.flatten().fieldErrors));
}
if (err instanceof AppError) return errorResponse(err);
return internalError(); // 500 with generic message
```

### Standard error codes

| Code | HTTP | When |
|---|---|---|
| `AUTH_MISSING` | 401 | No session cookie |
| `AUTH_EXPIRED` | 401 | Cookie present but invalid/expired |
| `FORBIDDEN` | 403 | Authenticated but wrong role |
| `NOT_FOUND` | 404 | Document doesn't exist |
| `VALIDATION_ERROR` | 422 | Zod parse failure |
| `RATE_LIMITED` | 429 | Upstash limit exceeded |
| `INTERNAL_ERROR` | 500 | Unexpected exception |

### In client components

```ts
// Fetch and surface errors, never throw unhandled
try {
  const res = await fetch('/api/some-resource', { method: 'POST', ... });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message ?? 'Something went wrong');
  }
  // handle success
} catch (err) {
  setError(err instanceof Error ? err.message : 'Something went wrong');
}
```

---

## Auth & Role Gating

```ts
import { withAuth } from '@/lib/auth/middleware';

// Allow any authenticated user
const auth = await withAuth(request);
// auth.uid, auth.email, auth.role, auth.emailVerified

// Allow lenders only
const auth = await withAuth(request, ['lender']);

// Allow applicants only
const auth = await withAuth(request, ['applicant']);
```

`withAuth` throws `AppError` (401/403) — no need to check its return value for errors; the catch block handles it.

**Never skip `withAuth` on any route that reads or writes user-specific or sensitive data.** Read-only public routes are the only exception, and there are none in this app currently.

---

## Firestore Access Patterns

All Firestore access is server-side only, via `adminDb` from `@/lib/firebase/admin`.

```ts
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

// Read a document
const snap = await adminDb.collection('users').doc(uid).get();
if (!snap.exists) { /* handle */ }
const data = snap.data(); // typed as DocumentData — cast or validate

// Create
await adminDb.collection('loanApplications').doc(id).set({
  ...fields,
  timeline: { createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() },
});

// Update (partial)
await adminDb.collection('loanApplications').doc(id).update({
  status: 'under_assessment',
  'timeline.updatedAt': FieldValue.serverTimestamp(),
});

// Query
const snapshot = await adminDb
  .collection('loanApplications')
  .where('applicantId', '==', uid)
  .where('status', '!=', 'draft')
  .orderBy('status')                         // compound ordering needs matching index
  .orderBy('timeline.createdAt', 'desc')
  .limit(20)
  .get();

const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
```

### Timestamp convention

- Always use `FieldValue.serverTimestamp()` for `createdAt` / `updatedAt` on write.
- Timestamps come back as Firestore `Timestamp` objects — use `.toDate()` or `.toMillis()` when serializing for JSON responses.
- The `timeline` field is the canonical home for timestamps on `loanApplications`.

---

## Audit Logging

Every state-changing route must log at least one audit entry. Log failures too, even if you can't construct the full entry.

```ts
import { auditLog, getClientIp } from '@/lib/utils/audit';

await auditLog({
  userId: auth.uid,           // required
  action: 'application_submitted', // snake_case verb
  targetId: applicationId,    // the affected document ID
  targetType: 'loanApplications', // collection name
  outcome: 'success',         // 'success' | 'failure'
  changes: { status: { from: 'draft', to: 'pending_review' } }, // optional diff
  ipAddress: ip,
  userAgent: request.headers.get('user-agent') ?? '',
});
```

**`auditLog` never throws** — a failed write is logged to console but won't surface to the user. Don't `await` it in the same try/catch as business logic if you don't want it to affect the response.

---

## React Components

### When to use `'use client'`

Add the directive only when the component needs:
- Event handlers (`onClick`, `onChange`, `onSubmit`)
- React hooks (`useState`, `useEffect`, `useRef`, `useAuth`, etc.)
- Browser-only APIs (`window`, `document`, `navigator`)

Pages, layouts, and data-display components should stay as Server Components.

### Component file structure

```tsx
// src/app/lender/customers/_components/SomePanel.tsx
'use client'; // only if needed

import { useState } from 'react';
import type { SomeType } from '@/types/some';

// Props type inline (small) or imported if shared
type Props = {
  item: SomeType;
  onClose: () => void;
};

// Default export for all components
export default function SomePanel({ item, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ...

  return (
    <div>
      {/* ... */}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
```

### Co-location rule

Route-specific components live in `_components/` next to the page that uses them. Shared components (used across 2+ routes) live in `src/components/shared/`.

### Simple forms (no React Hook Form)

Use plain `useState` for simple forms with ≤4 fields and no validation complexity:

```tsx
const [value, setValue] = useState('');
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError(null);
  try {
    const res = await fetch('/api/some', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error?.message ?? 'Failed');
    }
    // handle success
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Something went wrong');
  } finally {
    setLoading(false);
  }
};
```

### Multi-section forms (React Hook Form)

Use `useForm` with a Zod resolver for forms with many fields, cross-field validation, or step-by-step wizards. See `src/app/applicant/apply/` for the canonical multi-step form pattern.

---

## Client-Side Data Fetching

There is no SWR or React Query in this project. Use `useEffect` + `fetch` for simple cases:

```ts
const [data, setData] = useState<SomeType | null>(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  fetch('/api/some-resource')
    .then((res) => res.json())
    .then((json) => setData(json.data))
    .catch(() => setError('Failed to load'))
    .finally(() => setLoading(false));
}, []);
```

All API responses follow `{ data: T }` for success and `{ error: { code, message, details? } }` for errors — see `src/types/api.ts`.

---

## TypeScript Rules

TypeScript is strict. The compiler catches errors at build time (`npm run build`).

```ts
// ✅ Good — narrow unknown in catch
} catch (err) {
  const message = err instanceof Error ? err.message : 'Unknown error';
}

// ❌ Bad
} catch (err: any) { ... }

// ✅ Good — explicit return types on exported server functions
export async function GET(request: NextRequest): Promise<Response> { ... }

// ✅ Good — use type imports to avoid value/type confusion
import type { LoanApplication } from '@/types/application';

// ✅ Good — infer types from Zod schemas, don't duplicate
export type MyInput = z.infer<typeof mySchema>;

// ❌ Bad — hand-writing types that duplicate a schema
interface MyInput { name: string; amount: number; }
```

`any` is banned except for very specific cases (e.g., `z.any()` in Zod for truly untyped Firestore blobs during a migration). If you reach for `any`, use `unknown` and narrow instead.

---

## PII & Encryption

Fields containing Personally Identifiable Information must be:
1. Encrypted with `src/lib/encryption/crypto.ts` before writing to Firestore
2. Marked with 🔒 in the TypeScript type definition
3. Decrypted server-side before returning to the client (never return raw ciphertext)

```ts
// In type definitions
export interface ApplicantProfile {
  dateOfBirth: string;    // 🔒 Encrypted (YYYY-MM-DD)
  annualIncome: string;   // 🔒 Encrypted (number as string)
  ssn?: string;           // 🔒 Encrypted (last 4 digits)
}
```

Fields that are PII but not currently encrypted (e.g., `email` in `User`) are stored as plaintext because Firebase Auth already holds them. Do not encrypt fields that are also Firebase Auth primary keys.

KYC documents go to **Google Drive** (via `src/lib/gdrive/client.ts`), not Firebase Storage.

---

## Styling Conventions

**Tailwind v4, utility-first. No CSS modules, no styled-components.**

### Brand colors

| Purpose | Class |
|---|---|
| Primary action / accent | `bg-[#F5A523]` |
| Primary hover state | `hover:bg-[#E08B00]` |
| Accent text | `text-[#F5A523]` |
| Focus ring | `focus:border-[#F5A523] focus:ring-1 focus:ring-[#F5A523]` |

### Input / form field pattern

```tsx
<input
  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900
             focus:border-[#F5A523] focus:outline-none focus:ring-1 focus:ring-[#F5A523]"
/>
```

### Button patterns

```tsx
{/* Primary */}
<button className="inline-flex items-center gap-2 rounded-lg bg-[#F5A523] px-4 py-2
                   text-sm font-medium text-white hover:bg-[#E08B00] transition-colors
                   disabled:opacity-60">
  Save changes
</button>

{/* Secondary / cancel */}
<button className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium
                   text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
  Cancel
</button>
```

### Error / status messages inline

```tsx
{error && (
  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
    {error}
  </p>
)}
```

### Loading spinner (inline)

```tsx
{loading && (
  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
  </svg>
)}
```

---

## File & Export Conventions

| Thing | Convention | Example |
|---|---|---|
| Route files | kebab-case | `src/app/api/loan-applications/route.ts` |
| Component files | PascalCase | `CustomerEditPanel.tsx` |
| Utility/lib files | kebab-case | `api-error.ts`, `setpay-client.ts` |
| Page components | `default export`, named `Page` | `export default function DashboardPage()` |
| UI components | `default export`, named after file | `export default function CustomerEditPanel()` |
| Shared types | named `export interface` / `export type` | `export interface LoanApplication` |
| Zod schemas | named `export const` + schema suffix | `export const mySchema = z.object(...)` |
| Zod inferred types | named `export type` | `export type MyInput = z.infer<typeof mySchema>` |

Co-located components use `_components/` directories (prefixed with underscore so Next.js doesn't treat them as routes).

---

## Application Status Flow

```
draft
  └─► pending_review         (applicant submits)
        └─► under_assessment  (lender claims)
              ├─► waiting_for_docs  (lender requests docs)
              │     └─► under_assessment  (docs received)
              └─► credit_check
                    ├─► approved         (lender approves)
                    │     └─► loan_accepted           (applicant accepts offer)
                    │           └─► awaiting_payment_consent  (SetPay mandate gate)
                    │                 └─► disbursed    (mandate active + lender disburses)
                    │                       ├─► active
                    │                       └─► closed_repaid
                    ├─► declined         (lender declines)
                    └─► offer_declined   (applicant declines offer)
```

Never write raw status strings — import `ApplicationStatus` from `@/types/application` and use the union type.
