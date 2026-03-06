# TerePay Platform - Architecture & Implementation Plan

## 1. Project Overview

**TerePay** is a micro-lending platform for migrants. It provides a single lender with the tools to review, approve, and manage micro-loan applications submitted by applicants through a dedicated interface. The platform uses role-based access (Applicant & Lender) with the current scope supporting one lender.

### Key Objectives
- Dual-interface design with role-based access control (Loan Applicants & single Lender)
- Secure data management using Firebase with application-layer encryption for PII
- Scalable hosting on Vercel
- Feature flag system via Vercel Feature Flags for controlled rollouts
- API-layer authentication and authorization with rate limiting
- Support for local development and production deployments
- Seamless CI/CD pipeline

---

## 2. Technology Stack

### Frontend & Framework
- **Next.js** - Full-stack React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **React Hook Form** - Form state management

### Backend & Services
- **Next.js API Routes** - Backend endpoints with auth middleware and rate limiting
- **Firebase Admin SDK** - Server-side Firebase operations
- **Firebase Authentication** - User management and auth (custom claims for roles)
- **Firestore** - Real-time NoSQL database
- **Application-layer encryption** - AES-256-GCM with key versioning for PII fields via Node.js `crypto`
- **Zod** - Runtime schema validation on all API route inputs
- **Upstash Redis** (`@upstash/ratelimit`) - Distributed rate limiting across serverless functions

### Hosting & DevOps
- **Vercel** - Production hosting, deployment, and native feature flags
- **Vercel Feature Flags** (`@vercel/flags`) - Built-in flag management for controlled rollouts
- **GitHub Actions** - CI/CD pipeline for deployments
- **Environment-based configuration** - Development (local) and Production

---

## 3. Project Structure

```
terepay-platform/
├── docs/
│   ├── PLATFORM_PLAN.md (this file)
│   ├── DATA_STRUCTURE.md
│   ├── DEPLOYMENT.md
│   └── FEATURE_FLAGS.md
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout
│   │   ├── page.tsx                   # Home page
│   │   │
│   │   ├── applicant/                 # Applicant routes (/applicant/*)
│   │   │   ├── layout.tsx              # Applicant layout wrapper
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── apply/
│   │   │   │   └── page.tsx
│   │   │   ├── applications/
│   │   │   │   └── page.tsx
│   │   │   └── profile/
│   │   │       └── page.tsx
│   │   │
│   │   ├── lender/                    # Lender routes (/lender/*)
│   │   │   ├── layout.tsx              # Lender layout wrapper
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── applications/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   ├── portfolio/
│   │   │   │   └── page.tsx
│   │   │   └── profile/
│   │   │       └── page.tsx
│   │   │
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── signup/
│   │   │   │   └── page.tsx
│   │   │   └── callback/
│   │   │       └── page.tsx
│   │   │
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/
│   │       │   │   └── route.ts
│   │       │   ├── signup/
│   │       │   │   └── route.ts
│   │       │   ├── session/
│   │       │   │   └── route.ts        # POST (exchange ID token for session cookie)
│   │       │   └── logout/
│   │       │       └── route.ts
│   │       │
│   │       ├── applications/
│   │       │   ├── route.ts            # GET (list), POST (create)
│   │       │   └── [id]/
│   │       │       ├── route.ts        # GET, PATCH, DELETE
│   │       │       └── approve/
│   │       │           └── route.ts
│   │       │
│   │       ├── documents/
│   │       │   ├── upload/
│   │       │   │   └── route.ts        # POST (upload to Google Drive)
│   │       │   └── [id]/
│   │       │       └── url/
│   │       │           └── route.ts    # GET (proxy download from Drive)
│   │       │
│   │       ├── users/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       └── route.ts
│   │       │
│   │       └── payments/
│   │           ├── route.ts            # GET (list), POST (create)
│   │           └── [id]/
│   │               └── route.ts        # GET, PATCH
│   │
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   └── SignupForm.tsx
│   │   │
│   │   ├── shared/
│   │   │   ├── Navigation.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Loading.tsx
│   │   │   └── ErrorBoundary.tsx
│   │   │
│   │   ├── applicant/
│   │   │   ├── LoanApplicationForm.tsx
│   │   │   ├── ApplicationStatus.tsx
│   │   │   └── ApplicationList.tsx
│   │   │
│   │   └── lender/
│   │       ├── ApplicationReviewCard.tsx
│   │       ├── LoanApprovalForm.tsx
│   │       └── PortfolioOverview.tsx
│   │
│   ├── lib/
│   │   ├── firebase/
│   │   │   ├── admin.ts               # Firebase Admin SDK
│   │   │   ├── client.ts              # Firebase Client SDK
│   │   │   ├── auth.ts                # Auth utilities
│   │   │   └── firestore.ts           # Firestore queries
│   │   │
│   │   ├── auth/
│   │   │   ├── middleware.ts          # API auth middleware (token verify + role check)
│   │   │   ├── permissions.ts         # Role-based permissions
│   │   │   └── session.ts             # Session handling
│   │   │
│   │   ├── encryption/
│   │   │   └── crypto.ts              # AES-256-GCM encrypt/decrypt for PII
│   │   │
│   │   ├── flags/
│   │   │   └── flags.ts               # Vercel @vercel/flags definitions
│   │   │
│   │   ├── rate-limit/
│   │   │   └── limiter.ts             # Upstash Redis distributed rate limiter
│   │   │
│   │   ├── validation/
│   │   │   └── schemas.ts             # Zod schemas for API input validation
│   │   │
│   │   └── utils/
│   │       ├── validators.ts
│   │       ├── formatters.ts
│   │       └── logger.ts
│   │       └── audit.ts               # Reusable audit logging utility
│   │       └── api-error.ts           # Unified AppError class + errorResponse()
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                 # Authentication hook
│   │   ├── useUser.ts                 # User data hook
│   │   ├── useFeatureFlag.ts          # Feature flag hook
│   │   └── useApplication.ts          # Application data hook
│   │
│   ├── types/
│   │   ├── api.ts                     # ApiErrorResponse type
│   │   ├── user.ts                    # User types
│   │   ├── application.ts             # Loan application types
│   │   ├── loan.ts                    # Loan types
│   │   └── flags.ts                   # Feature flag types
│   │
│   ├── middleware.ts                  # Next.js middleware
│   └── env.ts                         # Environment variables validation
│
├── public/
│   ├── images/
│   └── icons/
│
├── .env.local.example                 # Environment template
├── .env.local                         # Local environment (git ignored)
├── .env.production                    # Production configuration
├── scripts/
│   └── seed-lender.ts                 # One-time script to create lender account
├── vercel.json                        # Vercel configuration
├── firebase.json                      # Firebase configuration
├── firestore.rules                    # Firestore security rules
├── next.config.js                     # Next.js config
├── tailwind.config.ts                 # Tailwind config
├── tsconfig.json                      # TypeScript config
├── package.json
├── package-lock.json
└── README.md
```

---

## 4. Data Structure

### 4.1 Firestore Collections

**Note:** Feature flags are managed exclusively via Vercel's native feature flag system (`@vercel/flags`). No `featureFlags` collection exists in Firestore.

#### **users** Collection (Common fields only)

Role-specific data is stored in subcollections  to keep documents small, enable granular security rules, and separate PII.

```
users/{userId}
├── uid: string
├── email: string
├── firstName: string
├── lastName: string
├── role: "applicant" | "lender"
├── profileComplete: boolean
├── createdAt: timestamp
├── updatedAt: timestamp
├── status: "active" | "suspended" | "inactive"
```

#### **users/{userId}/applicantProfile** Subcollection (single doc)

PII fields (`dateOfBirth`, `ssn`, `annualIncome`, `creditScore`) are encrypted at the application layer using AES-256-GCM before writing to Firestore (see Section 8.3).

```
users/{userId}/applicantProfile/profile
├── phone: string
├── address: string
├── city: string
├── state: string
├── zipCode: string
├── employmentStatus: string
├── annualIncome: string               # encrypted
├── creditScore: string                # encrypted
├── dateOfBirth: string                # encrypted
└── creditHistory: object
```

#### **users/{userId}/lenderProfile** Subcollection (single doc)
```
users/{userId}/lenderProfile/profile
├── businessName: string
├── businessType: string
├── annualFundingCapacity: number
├── activeLoans: number
├── totalFundsDispersed: number
├── verification: object
│   ├── isVerified: boolean
│   ├── verifiedAt: timestamp
│   └── documentUrls: string[]
└── metrics: object
    ├── averageROI: number
    ├── defaultRate: number
    └── totalLoansManaged: number
```

#### **loanApplications** Collection

Single-lender model: all submitted applications are visible to the lender. No assignment or marketplace matching is needed at this stage.

```
loanApplications/{applicationId}
├── applicationId: string
├── applicantId: string (reference to users)
├── status: "draft" | "submitted" | "under_review" | "approved" | "rejected" | "funded" | "completed"
├── loanDetails: object
│   ├── requestedAmount: number
│   ├── currency: string (default: "USD")
│   ├── loanTerm: number (months)
│   ├── purpose: string
│   ├── interestRate: number (percentage, optional - set after approval)
│   └── monthlyPayment: number (calculated, optional)
├── financialInformation: object
│   ├── monthlyIncome: number
│   ├── currentDebts: number
│   ├── existingLoans: number
│   └── debtToIncomeRatio: number
├── documents: array
│   ├── documentId: string
│   ├── type: string (e.g., "pay_stub", "bank_statement", "id_verification")
│   ├── url: string
│   ├── uploadedAt: timestamp
│   └── status: "pending" | "verified" | "rejected"
├── approval: object (single lender decision)
│   ├── approverId: string (lender userId)
│   ├── approvedAt: timestamp
│   ├── comments: string
│   └── terms: object
├── underwriting: object
│   ├── riskScore: number
│   ├── recommendation: string
│   ├── notes: string
│   └── lastAssessedAt: timestamp
├── timeline: object
│   ├── submittedAt: timestamp
│   ├── reviewStartedAt: timestamp
│   ├── approvedAt: timestamp
│   ├── fundedAt: timestamp
│   └── completedAt: timestamp
└── metadata: object
    ├── createdAt: timestamp
    └── updatedAt: timestamp
```

#### **loans** Collection (After Approval)

The document ID is the `applicationId` (1:1 relationship), providing natural idempotency for loan creation. See Section 8.8.

```
loans/{applicationId}
├── applicationId: string (also the document ID)
├── applicantId: string (reference)
├── lenderId: string (reference)
├── principal: number
├── interestRate: number
├── term: number (months)
├── monthlyPayment: number
├── status: "active" | "delinquent" | "paid_off" | "defaulted"
├── dateIssued: timestamp
├── dueDate: timestamp
├── nextPaymentDate: timestamp
└── metrics: object
    ├── totalPaid: number
    ├── remainingBalance: number
    ├── daysOverdue: number
    └── lastPaymentDate: timestamp
```

#### **payments** Collection (Top-level)

Payments are stored as a top-level collection (not a subcollection under loans) to enable cross-loan queries such as "all payments for the lender" or "all overdue payments" without collection group queries.

```
payments/{paymentId}
├── paymentId: string
├── loanId: string (reference to loans)
├── applicantId: string (reference to users)
├── lenderId: string (reference to users)
├── amount: number
├── principal: number
├── interest: number
├── dueDate: timestamp
├── paidDate: timestamp (nullable)
├── method: string
├── status: "scheduled" | "pending" | "completed" | "failed"
├── idempotencyKey: string             # Prevents duplicate payment processing
├── transactionId: string
├── createdAt: timestamp
└── updatedAt: timestamp
```

#### **auditLogs** Collection

Audit events are written by a **reusable `auditLog()` utility** (see Section 8.10) — not inline in each route. Both successful and **failed operations** (rejected logins, failed payments, authorization violations) are logged.

```
auditLogs/{logId}
├── userId: string
├── action: string (e.g., "loan_approved", "payment_received", "login_failed", "payment_failed")
├── targetId: string (e.g., applicationId, loanId)
├── targetType: string (e.g., "application", "loan", "payment", "auth")
├── outcome: "success" | "failure"      # Distinguishes successful vs. failed operations
├── changes: object
├── timestamp: timestamp
├── ipAddress: string                     # Extracted from x-forwarded-for (see caveat below)
├── userAgent: string
└── errorDetail: string (nullable)         # Populated on failure (e.g., "RATE_LIMITED", "INVALID_TOKEN")
```

> **Caveat:** `ipAddress` is extracted from the `x-forwarded-for` header on Vercel. This header can be spoofed by clients if there is no trusted proxy chain. On Vercel's infrastructure, the **first** value in `x-forwarded-for` is set by Vercel's edge and is reliable. However, treat IP-based analytics as best-effort — never use it as a sole security signal.

---

## 5. User Roles & Permissions

### Loan Applicants
- **Create** loan applications
- **View** own applications and status
- **Upload** required documents
- **Edit** draft applications
- **View** terms after approval
- **View** loan payment schedule
- **Make** loan payments

### Lender (Single)
- **View** all submitted applications (single-lender model, no assignment needed)
- **Filter** and search applications
- **Review** applicant documents
- **Approve/Reject** applications
- **Set** loan terms and interest rates
- **View** loan portfolio
- **Track** payments and performance
- **View** analytics and metrics

### Admin (Future)
- Access audit logs
- Generate reports
- Manage user accounts

---

## 6. Feature Flag Strategy

### 6.1 Implementation: Vercel Feature Flags (`@vercel/flags`)

Feature flags are managed **exclusively** through Vercel's native system. There is no custom Firestore-based flag engine or `featureFlags` collection.

**Why Vercel Flags:**
- Zero backend code — flags defined in code, toggled in the Vercel dashboard
- Edge-evaluated for performance
- Built-in A/B testing, percentage rollout, and targeting
- No additional Firestore reads or cost

### 6.2 Flag Types

1. **Release Flags** - Control rollout of new features
2. **Experiment Flags** - A/B testing new UI or workflows
3. **Operational Flags** - Toggle integrations on/off

### 6.3 Implementation Pattern

```typescript
// src/lib/flags/flags.ts
import { flag } from '@vercel/flags/next';

export const newApplicantDashboard = flag({
  key: 'new_applicant_dashboard',
  decide: () => false, // default off, overridden in Vercel dashboard
});

export const paymentTrackingV2 = flag({
  key: 'payment_tracking_v2',
  decide: () => false,
});
```

```tsx
// Usage in Server Components
import { newApplicantDashboard } from '@/lib/flags/flags';

export default async function ApplicantDashboard() {
  const showNew = await newApplicantDashboard();
  return showNew ? <NewDashboard /> : <LegacyDashboard />;
}
```

### 6.4 Example Flags

| Flag Name | Purpose | Initial Rollout |
|-----------|---------|------------------|
| `new_applicant_dashboard` | Redesigned applicant UI | 25% rollout |
| `payment_tracking_v2` | New payment history interface | 10% rollout |
| `auto_underwriting` | Automated credit assessment | Internal only |

### 6.5 Management & Deployment

- Flags managed via **Vercel Dashboard** → Feature Flags tab
- No code deployment needed to toggle flags
- Changes propagate globally within seconds
- Built-in analytics for flag adoption and impact

---

## 7. Deployment Architecture

### 7.1 Environments & Branch Strategy

Small-team two-branch strategy: `main` (production) and short-lived feature branches. Vercel Preview Deployments provide a staging-like environment for every PR automatically.

| Environment | Branch | Firebase Project | Vercel | Use Case |
|-------------|--------|------------------|--------|----------|
| **Development** | Feature branches | `terepay-dev` | Preview Deploy (auto per PR) | Development & QA |
| **Production** | `main` | `terepay-prod` | Production Deploy (auto on merge) | Live platform |

### 7.2 Deployment Pipeline

```
Feature Branch (local dev + Firebase emulator)
  ↓
Push → PR to main (Vercel auto-creates Preview Deployment)
  ↓
Code Review & Testing on Preview URL
  ↓
Merge to main (Auto-deploy to Vercel production)
  ↓
Toggle Feature Flags in Vercel Dashboard
  ↓
Live on Production (with controlled rollout)
```

### 7.3 Local Development Setup

1. **Firebase Local Emulator Suite**
   - Firestore emulator for offline development
   - Firebase Auth emulator
   - No real database writes during development

2. **Environment Variables** (`.env.local`)
   - Firebase config (dev project)
   - Encryption key for PII fields
   - Next.js configuration

3. **Start Commands**
   ```bash
   npm run dev              # Start Next.js + Firebase emulator
   npm run firebase:emulate # Start Firebase emulator only
   npm run build            # Production build
   ```

---

## 8. Security

### 8.1 Key Principles
- Users can only access their own data
- The lender can read all submitted applications (single-lender model)
- All API routes require valid Firebase ID token + role verification
- PII is encrypted at the application layer before Firestore writes
- Rate limiting on all public-facing API endpoints
- Idempotency keys for financial operations (payments, loan creation)

### 8.2 Lender Account Provisioning

The lender account is **never** created through the public signup flow. Since TerePay is a single-lender platform, lender access is provisioned through one of the following admin-only mechanisms:

1. **Seed Script (recommended for MVP):** A one-time Firebase Admin SDK script creates the lender user and sets the `role: 'lender'` custom claim.
2. **Protected Admin Endpoint (Phase 4):** When the Admin portal is built, an authenticated admin can invite a lender via a secured API endpoint.

```typescript
// scripts/seed-lender.ts  (run once via `npx ts-node scripts/seed-lender.ts`)
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

initializeApp({ credential: cert('./service-account.json') });

async function seedLender() {
  const email = process.env.LENDER_EMAIL!;
  const password = process.env.LENDER_PASSWORD!;

  const user = await getAuth().createUser({ email, password, displayName: 'TerePay Lender' });
  await getAuth().setCustomUserClaims(user.uid, { role: 'lender' });
  console.log(`Lender seeded: ${user.uid}`);
}

seedLender();
```

The public `/api/auth/signup` route hard-codes `role: 'applicant'` regardless of any client-submitted value. The Zod signup schema does not accept a `role` field.

### 8.3 Client-Side Auth Flow & Session Management

Next.js middleware runs at the **Edge Runtime**, which cannot use the Firebase Admin SDK (it requires Node.js). To protect pages before they render, TerePay uses a **cookie-based session strategy**:

**Flow:**
1. Client signs in via Firebase Client SDK and obtains an ID token.
2. Client sends the ID token to `POST /api/auth/session` (a server-side API route).
3. The API route verifies the token with Firebase Admin SDK, then creates a **Firebase session cookie** (`admin.auth().createSessionCookie(idToken, { expiresIn })`) and sets it as an `httpOnly`, `Secure`, `SameSite=Lax` cookie on the response.
4. Subsequent requests (pages and API calls) automatically include the session cookie.
5. **Next.js middleware** (`src/middleware.ts`) reads the session cookie and verifies it via a lightweight JWT decode (checking `exp`, `iss`, and signature against the Firebase public keys cached at the edge). If invalid or expired, it redirects to `/auth/login`.
6. **API routes** continue to use `admin.auth().verifySessionCookie(cookie)` for full server-side verification before executing business logic.
7. On logout, the client calls `POST /api/auth/logout`, which clears the session cookie and optionally revokes refresh tokens via `admin.auth().revokeRefreshTokens(uid)`.

```typescript
// src/app/api/auth/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

const SESSION_EXPIRY = 60 * 60 * 24 * 5 * 1000; // 5 days

export async function POST(request: NextRequest) {
  const { idToken } = await request.json();
  const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: SESSION_EXPIRY });

  const response = NextResponse.json({ status: 'ok' });
  response.cookies.set('__session', sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_EXPIRY / 1000,
    path: '/',
  });
  return response;
}
```

```typescript
// src/middleware.ts — Edge-compatible page protection
import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PATHS = ['/applicant', '/lender'];

export function middleware(request: NextRequest) {
  const session = request.cookies.get('__session')?.value;
  const isProtected = PROTECTED_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // Decode JWT payload (no Admin SDK needed) to enforce role-based routing
  if (session) {
    const payload = JSON.parse(Buffer.from(session.split('.')[1], 'base64').toString());
    const role = payload.role as string;
    if (request.nextUrl.pathname.startsWith('/lender') && role !== 'lender') {
      return NextResponse.redirect(new URL('/applicant/dashboard', request.url));
    }
    if (request.nextUrl.pathname.startsWith('/applicant') && role !== 'applicant') {
      return NextResponse.redirect(new URL('/lender/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ['/applicant/:path*', '/lender/:path*'] };
```

**Why cookie-based sessions over Bearer tokens in headers:**
- `httpOnly` cookies are immune to XSS — JavaScript cannot read them.
- Cookies are sent automatically on every request, including SSR page navigations.
- Next.js middleware can read cookies at the edge without the Firebase Admin SDK.
- `SameSite=Lax` provides baseline CSRF protection; state-changing API routes additionally verify the session cookie server-side.

### 8.4 API Authentication & Authorization Middleware

Since API routes use the Firebase Admin SDK (which **bypasses Firestore security rules**), every API route must enforce auth and authorization at the application layer.

**Flow:**
1. API route reads the `__session` cookie from the request
2. Middleware calls `admin.auth().verifySessionCookie(cookie, true)` to validate (the `true` flag checks for revocation)
3. Middleware extracts `role` from Firebase custom claims
4. Route-level permission check verifies the role is allowed for that operation
5. Request proceeds or returns `401`/`403`

```typescript
// src/lib/auth/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

export type AuthResult = {
  uid: string;
  email: string;
  role: 'applicant' | 'lender';
};

export async function withAuth(
  request: NextRequest,
  allowedRoles?: ('applicant' | 'lender')[]
): Promise<AuthResult> {
  const sessionCookie = request.cookies.get('__session')?.value;
  if (!sessionCookie) throw new AuthError('Missing session', 401);

  // checkRevoked: true — rejects tokens after revokeRefreshTokens()
  const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
  const role = decoded.role as 'applicant' | 'lender';

  if (allowedRoles && !allowedRoles.includes(role)) {
    throw new AuthError('Forbidden', 403);
  }

  return { uid: decoded.uid, email: decoded.email ?? '', role };
}
```

### 8.5 PII Encryption (Application Layer)

Sensitive fields are encrypted using AES-256-GCM before writing to Firestore and decrypted on read. The encryption key is stored in environment variables (Vercel encrypted env vars in production).

**Encrypted fields:** `dateOfBirth`, `ssn` (last 4), `annualIncome`, `creditScore`, bank routing/account numbers.

**Key versioning:** Every encrypted payload is prefixed with the key version (e.g., `v1:iv:tag:ciphertext`). This is **mandatory from day one** — it enables incremental key rotation without downtime or big-bang migrations. The `decrypt` function reads the version prefix and selects the corresponding key from a key map.

```typescript
// src/lib/encryption/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// Key map: version → 32-byte key. Add new entries on rotation; never remove old ones
// until all data has been re-encrypted.
const KEYS: Record<string, Buffer> = {
  v1: Buffer.from(process.env.ENCRYPTION_KEY_V1!, 'hex'),
  // v2: Buffer.from(process.env.ENCRYPTION_KEY_V2!, 'hex'),  // add on rotation
};

const CURRENT_KEY_VERSION = 'v1';

export function encrypt(plaintext: string): string {
  const key = KEYS[CURRENT_KEY_VERSION];
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: version:iv:tag:ciphertext (all base64 except version)
  return [
    CURRENT_KEY_VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

export function decrypt(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(':');
  const key = KEYS[version];
  if (!key) throw new Error(`Unknown encryption key version: ${version}`);
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final('utf8');
}
```

**Key rotation process:**
1. Generate a new 32-byte key and add it as `ENCRYPTION_KEY_V2` in environment variables.
2. Add the new key to the `KEYS` map and update `CURRENT_KEY_VERSION` to `v2`.
3. New writes use `v2`; reads transparently decrypt both `v1` and `v2` payloads.
4. Run a background migration script to re-encrypt all `v1` records with `v2`.
5. Once all records are migrated, the old key can be retired.

### 8.6 Rate Limiting & Abuse Prevention

Rate limiting is enforced at the API route level using **Upstash Redis** with `@upstash/ratelimit`. This is a Phase 1 requirement — an in-memory store is ineffective on Vercel because each serverless invocation gets its own isolated memory, meaning rate limits would never accumulate. Upstash provides a serverless-native Redis instance with a generous free tier and sub-millisecond latency.

| Endpoint | Limit | Window | Algorithm |
|----------|-------|--------|-----------|
| `POST /api/auth/login` | 5 requests | 1 minute | Sliding window |
| `POST /api/auth/signup` | 3 requests | 5 minutes | Sliding window |
| `POST /api/applications` | 10 requests | 1 hour | Sliding window |
| `POST /api/payments` | 5 requests | 1 minute | Sliding window |
| All other API routes | 60 requests | 1 minute | Fixed window |

```typescript
// src/lib/rate-limit/limiter.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Pre-configured limiters for different endpoint tiers
export const authLoginLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  prefix: 'rl:auth:login',
});

export const authSignupLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '5 m'),
  prefix: 'rl:auth:signup',
});

export const paymentLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'),
  prefix: 'rl:payments',
});

export const defaultLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(60, '1 m'),
  prefix: 'rl:default',
});

// Usage in API routes:
// const { success, remaining } = await authLoginLimiter.limit(identifier);
// if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
```

**Environment variables required:** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (set in Vercel Dashboard and `.env.local`).

### 8.7 Firestore Security Rules (Summary)

Firestore rules provide defense-in-depth alongside the API middleware. Since the single lender reads all submitted applications, rules reflect this.

```
// Users can read/write only their own data
match /users/{userId} {
  allow read, write: if request.auth.uid == userId

  match /applicantProfile/{doc} {
    allow read, write: if request.auth.uid == userId
  }
  match /lenderProfile/{doc} {
    allow read, write: if request.auth.uid == userId
  }
}

// Applicants: own applications. Lender: all submitted+ applications.
match /loanApplications/{docId} {
  allow read, write: if request.auth.uid == resource.data.applicantId
  allow read: if isLender(request.auth.uid)
}

// Payments: applicant sees own, lender sees all
match /payments/{docId} {
  allow read: if request.auth.uid == resource.data.applicantId
  allow read: if isLender(request.auth.uid)
  allow create: if request.auth.uid == resource.data.applicantId
}
```

### 8.8 Financial Operation Idempotency

All state-changing financial operations (loan creation, payment submission, status transitions) must be idempotent to prevent duplicate processing from retries or network failures.

**Approach — Deterministic Document IDs:**
- **Payments:** The client generates an `idempotencyKey` (UUID) for each payment request. The `idempotencyKey` is used **as the Firestore document ID** (e.g., `payments/{idempotencyKey}`). This enables a transactionally-safe `tx.get(docRef)` instead of a `where()` query, which is **not transactionally isolated** in Firestore and could allow duplicates under concurrent retries.
- **Loans:** Since there is a strict 1:1 relationship between an approved application and a loan, the `applicationId` is used **as the Firestore document ID** (i.e., `loans/{applicationId}`). This naturally deduplicates — retrying loan creation for the same application hits the same document path and the transaction detects it already exists.
- Multi-document state changes (e.g., approve application → create loan → update metrics) use **Firestore transactions** to ensure atomicity.

```typescript
// Example: Idempotent payment creation within a transaction
async function createPayment(paymentData: PaymentInput) {
  // Use the idempotencyKey as the document ID for transactional safety
  const paymentRef = db.collection('payments').doc(paymentData.idempotencyKey);

  return db.runTransaction(async (tx) => {
    // 1. Check idempotency via direct doc reference (transactionally safe)
    const existing = await tx.get(paymentRef);
    if (existing.exists) return existing.data(); // Already processed — return existing result

    // 2. Read loan to validate
    const loanRef = db.collection('loans').doc(paymentData.loanId);
    const loan = await tx.get(loanRef);
    if (!loan.exists) throw new Error('Loan not found');

    // 3. Write payment + update loan metrics atomically
    tx.create(paymentRef, {
      ...paymentData,
      paymentId: paymentData.idempotencyKey,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.update(loanRef, {
      'metrics.totalPaid': FieldValue.increment(paymentData.amount),
      'metrics.remainingBalance': FieldValue.increment(-paymentData.amount),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return paymentData;
  });
}
```

> **Why not `where()` inside a transaction?** Firestore transactions only guarantee read consistency for document references obtained via `tx.get(docRef)`. A `where()` query inside a transaction is not isolated — two concurrent requests could both see zero results and both proceed, creating duplicate payments. Using the idempotency key as the document ID eliminates this race condition.
```

### 8.9 Unified API Error Response Contract

All API routes return errors in a **consistent shape** regardless of status code. This prevents client-side fragility from handling different error formats per endpoint.

```typescript
// src/types/api.ts
export type ApiErrorResponse = {
  error: {
    code: string;       // Machine-readable, e.g., "AUTH_EXPIRED", "NOT_FOUND", "VALIDATION_ERROR"
    message: string;    // Human-readable description
    details?: unknown;  // Optional: Zod field errors, additional metadata
  };
};
```

**Standard error codes and status mappings:**

| Status | Code | When |
|--------|------|------|
| 400 | `BAD_REQUEST` | Malformed JSON, missing required headers |
| 401 | `AUTH_MISSING` | No session cookie / token provided |
| 401 | `AUTH_EXPIRED` | Session cookie expired or revoked |
| 403 | `FORBIDDEN` | Valid auth but insufficient role / ownership |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Duplicate resource (e.g., email already registered) |
| 422 | `VALIDATION_ERROR` | Zod schema validation failed (`details` contains field errors) |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unhandled server error (never leak stack traces) |

```typescript
// src/lib/utils/api-error.ts
import { NextResponse } from 'next/server';
import type { ApiErrorResponse } from '@/types/api';

export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function errorResponse(error: AppError): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { error: { code: error.code, message: error.message, details: error.details } },
    { status: error.statusCode },
  );
}

// Usage in a catch block:
// catch (err) {
//   if (err instanceof AppError) return errorResponse(err);
//   return errorResponse(new AppError('INTERNAL_ERROR', 500, 'Something went wrong'));
// }
```

**Rules:**
- Every API route wraps its handler in a `try/catch` that funnels through `errorResponse()`.
- `500` responses **never** include stack traces or internal details.
- The `AuthError` class from the auth middleware extends `AppError`.
- Client-side API utilities parse all error responses against the `ApiErrorResponse` type.

### 8.10 Audit Logging Strategy

Audit logging is implemented as a **reusable utility function** called in a `finally` block or post-action — **not** sprinkled inline in each route. This ensures consistent coverage and prevents missed events.

**Triggering events (logged automatically):**

| Category | Events |
|----------|--------|
| **Auth** | `signup_success`, `login_success`, `login_failed`, `logout`, `session_created`, `session_revoked` |
| **Applications** | `application_created`, `application_submitted`, `application_updated`, `application_deleted` |
| **Lending** | `application_approved`, `application_rejected`, `loan_created`, `loan_terms_set` |
| **Payments** | `payment_created`, `payment_completed`, `payment_failed` |
| **Documents** | `document_uploaded`, `document_accessed`, `document_deleted` |
| **Security** | `rate_limited`, `forbidden_access`, `invalid_token`, `pii_decrypted` |

```typescript
// src/lib/utils/audit.ts
import { db } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

type AuditEntry = {
  userId: string;
  action: string;
  targetId?: string;
  targetType?: string;
  outcome: 'success' | 'failure';
  changes?: Record<string, unknown>;
  errorDetail?: string;
  ipAddress?: string;
  userAgent?: string;
};

export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await db.collection('auditLogs').add({
      ...entry,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch {
    // Audit logging must never break the request — log to stderr and continue
    console.error('[audit] Failed to write audit log', entry);
  }
}

// Helper to extract IP from Vercel's edge-set header
export function getClientIp(request: Request): string {
  // On Vercel, x-forwarded-for first value is set by Vercel's edge (reliable)
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() ?? 'unknown';
}
```

**Usage pattern in API routes:**

```typescript
export async function POST(request: NextRequest) {
  let auth: AuthResult | null = null;
  try {
    auth = await withAuth(request, ['applicant']);
    const result = await createLoanApplication(auth.uid, parsed.data);
    await auditLog({
      userId: auth.uid, action: 'application_created',
      targetId: result.id, targetType: 'application', outcome: 'success',
      ipAddress: getClientIp(request), userAgent: request.headers.get('user-agent') ?? '',
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    await auditLog({
      userId: auth?.uid ?? 'anonymous', action: 'application_created',
      targetType: 'application', outcome: 'failure',
      errorDetail: err instanceof Error ? err.message : 'unknown',
      ipAddress: getClientIp(request), userAgent: request.headers.get('user-agent') ?? '',
    });
    // ... error response
  }
}
```

### 8.11 API Input Validation with Zod

Every API route validates incoming request bodies and query parameters using **Zod** schemas before any business logic executes. This is a Phase 1 requirement — it prevents malformed data from reaching Firestore and provides clear, structured error responses to clients.

**Why Zod:**
- Runtime type checking that complements TypeScript's compile-time types
- Excellent error messages with per-field detail
- Schema inference (`z.infer<typeof schema>`) generates TypeScript types automatically
- Small footprint, zero dependencies

```typescript
// src/lib/validation/schemas.ts
import { z } from 'zod';

// --- Loan Application ---
export const createApplicationSchema = z.object({
  loanDetails: z.object({
    requestedAmount: z.number().min(100).max(50_000),
    currency: z.literal('USD').default('USD'),
    loanTerm: z.number().int().min(1).max(60),        // 1-60 months
    purpose: z.string().min(10).max(500),
  }),
  financialInformation: z.object({
    monthlyIncome: z.number().positive(),
    currentDebts: z.number().min(0),
    existingLoans: z.number().int().min(0),
  }),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

// --- Payment ---
export const createPaymentSchema = z.object({
  loanId: z.string().min(1),
  amount: z.number().positive(),
  method: z.string().min(1),
  idempotencyKey: z.string().uuid(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

// --- Auth ---
// Public signup is restricted to applicants only.
// Lender accounts are seeded via a Firebase Admin script or a protected
// admin endpoint — never through the public signup flow.
export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  // role is always 'applicant' — lender creation is admin-only
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
```

**Usage pattern in API routes:**

```typescript
// src/app/api/applications/route.ts
import { createApplicationSchema } from '@/lib/validation/schemas';

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, ['applicant']);

  const body = await request.json();
  const parsed = createApplicationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors } },
      { status: 422 }
    );
  }

  // parsed.data is fully typed — proceed with business logic
  const application = await createLoanApplication(auth.uid, parsed.data);
  return NextResponse.json(application, { status: 201 });
}
```

**Rules:**
- Every `POST` and `PATCH` route **must** parse the body through a Zod schema before proceeding.
- `GET` routes with query parameters validate them via `z.object({ ... }).safeParse(Object.fromEntries(url.searchParams))`.
- Validation errors return `422` with a consistent `{ error: { code, details } }` shape.
- Schemas are co-located in `src/lib/validation/schemas.ts` and imported by both API routes and client-side forms (shared validation).

---

## 9. Feature Roadmap (Phase-Based)

### Phase 1 (MVP - Week 1-2)
- [x] Basic user authentication (signup/login)
- [x] Applicant loan application form
- [x] Lender application review dashboard
- [x] Role-based routing
- [x] Firebase integration
- [ ] Seed lender account via `scripts/seed-lender.ts` (admin-only provisioning)
- [ ] Cookie-based session management (`POST /api/auth/session`, `httpOnly` cookies)
- [ ] API auth middleware (`verifySessionCookie()` + role enforcement)
- [ ] Next.js middleware for edge page protection (cookie-based role routing)
- [ ] PII encryption layer (AES-256-GCM with key versioning)
- [ ] Upstash Redis rate limiting (`@upstash/ratelimit`) on auth and financial endpoints
- [ ] Zod schema validation on all API route inputs (signup hardcoded to `applicant`)
- [ ] Unified API error contract (`AppError` + `errorResponse()`)
- [ ] Audit logging utility (`auditLog()` with success/failure tracking)
- [ ] Vercel feature flags setup (`@vercel/flags`)
- [ ] Deploy Firestore composite indexes (`firestore.indexes.json`)

### Phase 2 (Core Features - Week 3-4)
- [ ] Google Drive document integration (signed URL upload, server-side validation)
- [ ] Loan approval workflow with Firestore transactions
- [ ] Loan creation post-approval (idempotent via `loans/{applicationId}` doc path)
- [ ] Top-level payments collection with deterministic idempotency keys as doc IDs
- [ ] Payment tracking interface

### Phase 3 (Enhancement - Week 5-6)
- [ ] Advanced analytics dashboard
- [ ] Automated underwriting score
- [ ] Email notifications
- [ ] API documentation
- [ ] Performance optimization

### Phase 4 (Post-Launch)
- [ ] Mobile app (React Native)
- [ ] Advanced risk assessment
- [ ] Integration with credit bureaus
- [ ] Automated payment processing
- [ ] Admin portal
- [ ] Multi-lender support (marketplace model)

---

## 10. Performance & Scalability

### Optimization Strategies
- **Code Splitting** - Next.js automatic code splitting
- **Caching** - Vercel edge caching, Firestore caching
- **Database Indexes** - Firestore composite indexes (see Section 10.1)
- **Image Optimization** - Next.js Image component
- **Lazy Loading** - React Suspense for components

### 10.1 Firestore Composite Indexes

Firestore requires composite indexes for queries that filter/order on multiple fields. Without them, queries silently fail or return incomplete results. The following indexes must be defined in `firestore.indexes.json` and deployed via `firebase deploy --only firestore:indexes`.

```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "loanApplications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "metadata.createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "loanApplications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "applicantId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "metadata.createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "payments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "loanId", "order": "ASCENDING" },
        { "fieldPath": "dueDate", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "payments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "applicantId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "dueDate", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "payments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "lenderId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "dueDate", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "auditLogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "targetId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "auditLogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "loans",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "nextPaymentDate", "order": "ASCENDING" }
      ]
    }
  ]
}
```

**Index purposes:**

| Collection | Fields | Use Case |
|------------|--------|----------|
| `loanApplications` | `(status, metadata.createdAt)` | Lender dashboard: filter by status, sort by newest |
| `loanApplications` | `(applicantId, status, metadata.createdAt)` | Applicant: view own applications filtered by status |
| `payments` | `(loanId, dueDate)` | Payment schedule view for a specific loan |
| `payments` | `(applicantId, status, dueDate)` | Applicant payment history filtered by status |
| `payments` | `(lenderId, status, dueDate)` | Lender: all payments across loans filtered by status |
| `auditLogs` | `(targetId, timestamp)` | Audit trail for a specific resource |
| `auditLogs` | `(userId, timestamp)` | Audit trail for a specific user |
| `loans` | `(status, nextPaymentDate)` | Dashboard: loans nearing payment due dates |

### Monitoring & Observability
- **Vercel Analytics** - Core Web Vitals monitoring
- **Firebase Console** - Usage and performance metrics
- **Error Tracking** - Sentry integration
- **Logging** - Custom logger for audit trails

---

## 11. Document Management (Google Drive)

Applicant documents (pay stubs, bank statements, ID verification) are stored in **Google Drive** rather than Firebase Storage. This leverages the lender's existing Google Workspace and keeps documents accessible through familiar tooling while maintaining security boundaries.

### 11.1 Architecture Overview

```
Applicant uploads file
  ↓
Client sends file to POST /api/documents/upload
  ↓
API route validates: auth, file type, file size, virus scan
  ↓
Server uploads to Google Drive via Service Account
  (into a per-applicant folder under a TerePay root folder)
  ↓
Server stores metadata in Firestore (documentId, driveFileId, type, status)
  ↓
When lender/applicant needs to view → GET /api/documents/[id]/url
  ↓
Server generates a short-lived download URL and returns it
```

### 11.2 Google Drive Service Account Setup

1. **Create a Google Cloud Service Account** in the same GCP project as Firebase.
2. **Enable the Google Drive API** in the GCP Console.
3. **Create a dedicated TerePay Drive folder** owned by the lender's Google Workspace account.
4. **Share the root folder with the service account** email (`terepay-docs@project-id.iam.gserviceaccount.com`) granting "Editor" access. This gives the service account access only to that specific folder — not the lender's entire Drive.
5. Store the service account credentials JSON as environment variables (`GOOGLE_SERVICE_ACCOUNT_KEY`).

### 11.3 Folder Structure in Google Drive

```
TerePay Documents/                       (root — shared with service account)
├── applicants/
│   ├── {userId_1}/
│   │   ├── pay_stub_2026-03-01.pdf
│   │   ├── bank_statement_feb.pdf
│   │   └── id_verification.jpg
│   ├── {userId_2}/
│   │   └── ...
```

Each applicant gets an isolated subfolder. Folder creation happens lazily on first document upload.

### 11.4 Upload Flow (Server-Side Only)

**Documents are NEVER uploaded directly from the client to Google Drive.** All uploads go through the TerePay API to enforce validation, virus scanning, and access control.

```typescript
// src/app/api/documents/upload/route.ts
import { google } from 'googleapis';
import { Readable } from 'stream';
import { withAuth } from '@/lib/auth/middleware';
import { auditLog, getClientIp } from '@/lib/utils/audit';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ROOT_FOLDER_ID = process.env.GDRIVE_ROOT_FOLDER_ID!;

export async function POST(request: NextRequest) {
  const auth = await withAuth(request, ['applicant']);
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const documentType = formData.get('type') as string; // e.g., "pay_stub"

  // --- Validation ---
  if (!file) throw new AppError('BAD_REQUEST', 400, 'No file provided');
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new AppError('VALIDATION_ERROR', 422, `File type not allowed: ${file.type}`);
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new AppError('VALIDATION_ERROR', 422, 'File exceeds 10 MB limit');
  }

  // --- Upload to Google Drive ---
  const drive = getDriveClient();
  const folderId = await getOrCreateApplicantFolder(drive, auth.uid);

  const driveResponse = await drive.files.create({
    requestBody: {
      name: `${documentType}_${Date.now()}_${file.name}`,
      parents: [folderId],
    },
    media: {
      mimeType: file.type,
      body: Readable.from(Buffer.from(await file.arrayBuffer())),
    },
    fields: 'id,name,webViewLink',
  });

  // --- Store metadata in Firestore ---
  const docRef = await db.collection('documents').add({
    applicantId: auth.uid,
    driveFileId: driveResponse.data.id,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    documentType,
    status: 'pending',           // pending → verified | rejected (by lender)
    uploadedAt: FieldValue.serverTimestamp(),
  });

  await auditLog({
    userId: auth.uid, action: 'document_uploaded',
    targetId: docRef.id, targetType: 'document', outcome: 'success',
    ipAddress: getClientIp(request),
  });

  return NextResponse.json({ documentId: docRef.id }, { status: 201 });
}
```

### 11.5 Download Flow (Short-Lived URLs)

To view or download a document, clients request a short-lived download URL from the API. The server generates a **time-limited export link** — documents are never served directly from Google Drive URLs stored in Firestore.

```typescript
// src/app/api/documents/[id]/url/route.ts
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await withAuth(request);

  // Fetch metadata and verify ownership / lender access
  const docSnap = await db.collection('documents').doc(params.id).get();
  if (!docSnap.exists) throw new AppError('NOT_FOUND', 404, 'Document not found');

  const docData = docSnap.data()!;
  if (auth.role === 'applicant' && docData.applicantId !== auth.uid) {
    throw new AppError('FORBIDDEN', 403, 'Access denied');
  }

  // Generate short-lived download URL via Google Drive API
  const drive = getDriveClient();

  // Option A: Create a temporary permission (auto-expires idea below)
  // Option B: Use service account to fetch file content and stream it
  // Recommended: Stream through our API to avoid exposing Drive URLs
  const response = await drive.files.get(
    { fileId: docData.driveFileId, alt: 'media' },
    { responseType: 'stream' },
  );

  await auditLog({
    userId: auth.uid, action: 'document_accessed',
    targetId: params.id, targetType: 'document', outcome: 'success',
    ipAddress: getClientIp(request),
  });

  // Stream file content through our API — never expose raw Drive URLs
  return new NextResponse(response.data as ReadableStream, {
    headers: {
      'Content-Type': docData.mimeType,
      'Content-Disposition': `inline; filename="${docData.fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
```

### 11.6 Security Controls

| Control | Implementation |
|---------|----------------|
| **Access control** | API routes verify auth + ownership (applicant sees own docs, lender sees all) |
| **No direct Drive URLs** | Documents are proxied through the API — clients never get Google Drive file IDs or links |
| **File type validation** | Server-side MIME type allowlist: PDF, JPEG, PNG, WebP only |
| **File size limit** | 10 MB max per file, enforced server-side |
| **Scoped service account** | Service account has access only to the TerePay root folder, not the entire Drive |
| **Per-applicant isolation** | Each applicant's files are in a separate subfolder; the folder is created server-side |
| **Audit trail** | Every upload, access, and deletion is logged in `auditLogs` |
| **Virus scanning** | (Phase 3) Integrate Google Cloud DLP or ClamAV scanning before storing metadata as `verified` |
| **Deletion** | Soft-delete in Firestore (mark as `deleted`); periodic cleanup job removes from Drive |

### 11.7 Firestore `documents` Collection

```
documents/{documentId}
├── applicantId: string (reference to users)
├── applicationId: string (optional — linked after submission)
├── driveFileId: string              # Google Drive file ID (never exposed to client)
├── fileName: string
├── mimeType: string
├── sizeBytes: number
├── documentType: string             # "pay_stub" | "bank_statement" | "id_verification" | "proof_of_address"
├── status: "pending" | "verified" | "rejected" | "deleted"
├── reviewedBy: string (nullable)    # Lender userId who verified/rejected
├── reviewedAt: timestamp (nullable)
├── reviewNotes: string (nullable)
├── uploadedAt: timestamp
└── updatedAt: timestamp
```

### 11.8 Environment Variables for Google Drive

```
GOOGLE_SERVICE_ACCOUNT_KEY=<base64-encoded service account JSON>
GDRIVE_ROOT_FOLDER_ID=<ID of the TerePay Documents root folder>
```

In production, set via Vercel encrypted environment variables. In local development, use the Firebase emulator's service account or a separate dev Google Drive folder.

---

## 12. Summary & Next Steps

1. **Initialize Next.js Project** - Create app with TypeScript
2. **Configure Firebase** - Set up Admin SDK and Client SDK
3. **Seed Lender Account** - Run `scripts/seed-lender.ts` to create the lender with custom claims
4. **Set Up Authentication** - Firebase Auth with cookie-based session management (`httpOnly` session cookies)
5. **Implement API Auth Middleware** - `verifySessionCookie()` + role-based route protection
6. **Implement Session API Route** - `POST /api/auth/session` to exchange ID tokens for session cookies
7. **Implement PII Encryption Layer** - AES-256-GCM with key versioning (`v1:iv:tag:ciphertext` format)
8. **Add Rate Limiting** - Upstash Redis (`@upstash/ratelimit`) on auth and financial endpoints
9. **Add Zod Validation** - Schema validation on all API route inputs (signup hardcoded to `applicant` role)
10. **Add Unified Error Contract** - `AppError` class + `errorResponse()` utility across all routes
11. **Implement Audit Logging Utility** - Reusable `auditLog()` function with success/failure tracking
12. **Design UI Components** - Prefixed route layouts (`/applicant/*`, `/lender/*`)
13. **Implement API Routes** - Backend logic with deterministic idempotency doc IDs (`loans/{applicationId}`, `payments/{idempotencyKey}`)
14. **Deploy Firestore Composite Indexes** - `firebase deploy --only firestore:indexes`
15. **Deploy to Vercel** - GitHub integration with two-branch strategy (main + feature branches)
16. **Set Up Vercel Feature Flags** - Configure `@vercel/flags` definitions
17. **Firestore Security Rules** - Single-lender access model + subcollection rules
18. **Google Drive Integration** - Service account setup, upload/download API routes, `documents` collection
19. **Testing & Documentation** - Unit tests, E2E tests, API docs
20. **Launch** - Monitor metrics and gather user feedback

---

## Document References
- [Data Structure Details](./DATA_STRUCTURE.md)
- [Deployment Guide](./DEPLOYMENT.md)
