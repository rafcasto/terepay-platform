# TerePay Platform - Architecture & Implementation Plan

## 1. Project Overview

**TerePay** is a lending platform that connects loan applicants with lenders through two separate, role-based interfaces. The platform enables users to apply for loans and allows lenders to review, approve, and manage loan portfolios.

### Key Objectives
- Dual-interface design with role-based access control (Loan Applicants & Lenders)
- Secure data management using Firebase
- Scalable hosting on Vercel
- Feature flag system for controlled rollouts and A/B testing
- Support for local development and production deployments
- Seamless CI/CD pipeline

---

## 2. Technology Stack

### Frontend & Framework
- **Next.js** - Full-stack React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **React Hook Form** - Form state management
- **Zustand** - Lightweight state management

### Backend & Services
- **Next.js API Routes** - Backend endpoints
- **Firebase Admin SDK** - Server-side Firebase operations
- **Firebase Authentication** - User management and auth
- **Firestore** - Real-time NoSQL database

### Hosting & DevOps
- **Vercel** - Production hosting and deployment
- **Firebase Hosting** (optional fallback)
- **GitHub Actions** - CI/CD pipeline for feature flags and deployments
- **Environment-based configuration** - Local, staging, production

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
│   │   ├── (applicant)/               # Applicant routes group
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
│   │   ├── (lender)/                  # Lender routes group
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
│   │       ├── users/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       └── route.ts
│   │       │
│   │       └── feature-flags/
│   │           └── route.ts            # GET flags for user
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
│   │   │   ├── middleware.ts          # Authentication middleware
│   │   │   ├── permissions.ts         # Role-based permissions
│   │   │   └── session.ts             # Session handling
│   │   │
│   │   ├── flags/
│   │   │   ├── featureFlags.ts        # Feature flag engine
│   │   │   └── strategies.ts          # Flag evaluation strategies
│   │   │
│   │   └── utils/
│   │       ├── validators.ts
│   │       ├── formatters.ts
│   │       └── logger.ts
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                 # Authentication hook
│   │   ├── useUser.ts                 # User data hook
│   │   ├── useFeatureFlag.ts          # Feature flag hook
│   │   └── useApplication.ts          # Application data hook
│   │
│   ├── types/
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
├── .vercelrc                          # Vercel configuration
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

#### **users** Collection
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
│
├── applicant-specific/
│   ├── phone: string
│   ├── address: string
│   ├── city: string
│   ├── state: string
│   ├── zipCode: string
│   ├── employmentStatus: string
│   ├── annualIncome: number
│   ├── creditScore: number
│   ├── dateOfBirth: string
│   └── creditHistory: subcollection
│
└── lender-specific/
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
        └── totalLendersManaged: number
```

#### **loanApplications** Collection
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
├── approvals: array
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
    ├── updatedAt: timestamp
    └── viewedBy: array of {userId, timestamp}
```

#### **loans** Collection (After Approval)
```
loans/{loanId}
├── loanId: string
├── applicationId: string (reference)
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
│
├── payments: subcollection
│   ├── paymentId: string
│   ├── amount: number
│   ├── date: timestamp
│   ├── method: string
│   ├── status: "pending" | "completed" | "failed"
│   └── transactionId: string
│
└── metrics: object
    ├── totalPaid: number
    ├── remainingBalance: number
    ├── daysOverdue: number
    └── lastPaymentDate: timestamp
```

#### **featureFlags** Collection
```
featureFlags/{flagId}
├── name: string (e.g., "new_dashboard", "advanced_analytics")
├── description: string
├── enabled: boolean
├── rolloutPercentage: number (0-100)
├── targetRoles: array<"applicant" | "lender">
├── targetUsers: array<userId> (empty array = all users)
├── startDate: timestamp (optional)
├── endDate: timestamp (optional)
├── metadata: object
│   ├── createdBy: string
│   ├── createdAt: timestamp
│   ├── updatedAt: timestamp
│   └── version: number
└── rules: array
    ├── condition: string (e.g., "creditScore > 700")
    ├── enabled: boolean
    └── priority: number
```

#### **auditLogs** Collection
```
auditLogs/{logId}
├── userId: string
├── action: string (e.g., "loan_approved", "payment_received")
├── targetId: string (e.g., applicationId, loanId)
├── targetType: string (e.g., "application", "loan")
├── changes: object
├── timestamp: timestamp
├── ipAddress: string
└── userAgent: string
```

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

### Lenders
- **View** submitted applications
- **Filter** and search applications
- **Review** applicant documents
- **Approve/Reject** applications
- **Set** loan terms and interest rates
- **View** loan portfolio
- **Track** payments and performance
- **View** analytics and metrics

### Admin (Future)
- Manage feature flags
- Access audit logs
- Generate reports
- Manage user accounts

---

## 6. Feature Flag Strategy

### 6.1 Flag Types

1. **Release Flags** - Control rollout of new features
2. **Operational Flags** - Toggle services/integrations
3. **Experiment Flags** - A/B testing and personalization
4. **Permission Flags** - Control feature access by role

### 6.2 Implementation Approach

#### Server-Side (Default)
- Flag evaluation on Next.js API routes
- More secure, can't be bypassed via client
- Stored in Firestore with evaluation rules

#### Client-Side (When Needed)
- Feature flags fetched on user login
- Cached in browser for performance
- Re-evaluated periodically

### 6.3 Flag Evaluation Rules

- **Percentage-based rollout** - Deploy to X% of users
- **User-based targeting** - Specific user IDs
- **Role-based targeting** - Applicants vs. Lenders
- **Date-based rollout** - Scheduled releases
- **Custom conditions** - Credit score, account age, etc.

### 6.4 Example Flags

```typescript
{
  name: "advanced_loan_search",
  description: "Advanced filtering for lenders",
  enabled: true,
  rolloutPercentage: 50,
  targetRoles: ["lender"],
  rules: [
    { condition: "totalLoansManaged > 10", enabled: true, priority: 1 }
  ]
},
{
  name: "new_applicant_dashboard",
  description: "Redesigned applicant dashboard",
  enabled: true,
  rolloutPercentage: 25,
  targetRoles: ["applicant"],
  startDate: "2026-03-15",
  endDate: "2026-04-15"
}
```

---

## 7. Deployment Architecture

### 7.1 Environments

| Environment | Vercel Branch | Firebase Project | Use Case |
|-------------|---------------|------------------|----------|
| **Development** | Feature branches | `terepay-dev` | Local testing |
| **Staging** | `staging` | `terepay-staging` | QA & testing |
| **Production** | `main` | `terepay-prod` | Live platform |

### 7.2 Deployment Pipeline

```
Feature Branch
  ↓
PR to Development (Auto-deploy to staging)
  ↓
Code Review & Testing
  ↓
Merge to Main (Auto-deploy to Vercel production)
  ↓
GitHub Actions Updates Firestore flags
  ↓
Live on Production
```

### 7.3 Local Development Setup

1. **Firebase Local Emulator Suite**
   - Firestore emulator for offline development
   - Firebase Auth emulator
   - No real database writes during development

2. **Environment Variables** (`.env.local`)
   - Firebase config (dev, staging, prod)
   - Next.js configuration
   - Feature flag defaults

3. **Start Commands**
   ```bash
   npm run dev              # Start Next.js + Firebase emulator
   npm run firebase:emulate # Start Firebase emulator only
   npm run build            # Production build
   ```

---

## 8. Security & Firestore Rules

### 8.1 Key Principles
- Users can only access their own data
- Lenders can access applications assigned to them
- Admin operations protected
- Document validation on client and server

### 8.2 Firestore Security Rules (Summary)

```typescript
// Users can read/write only their own data
match /users/{userId} {
  allow read, write: if request.auth.uid == userId
}

// Applicants can read/write their own applications
match /loanApplications/{docId} {
  allow read, write: if request.auth.uid == resource.data.applicantId
  allow read: if existsLenderAssignment(request.auth.uid, docId)
}
```

---

## 9. Feature Roadmap (Phase-Based)

### Phase 1 (MVP - Week 1-2)
- [x] Basic user authentication (signup/login)
- [x] Applicant loan application form
- [x] Lender application review dashboard
- [x] Role-based routing
- [x] Firebase integration

### Phase 2 (Core Features - Week 3-4)
- [ ] Document upload & verification
- [ ] Loan approval workflow
- [ ] Loan creation post-approval
- [ ] Payment tracking interface
- [ ] Feature flags implementation

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

---

## 10. Performance & Scalability

### Optimization Strategies
- **Code Splitting** - Next.js automatic code splitting
- **Caching** - Vercel edge caching, Firestore caching
- **Database Indexes** - Firestore composite indexes for frequent queries
- **Image Optimization** - Next.js Image component
- **Lazy Loading** - React Suspense for components

### Monitoring & Observability
- **Vercel Analytics** - Core Web Vitals monitoring
- **Firebase Console** - Usage and performance metrics
- **Error Tracking** - Sentry integration
- **Logging** - Custom logger for audit trails

---

## 11. Summary & Next Steps

1. **Initialize Next.js Project** - Create app with TypeScript
2. **Configure Firebase** - Set up Admin SDK and Client SDK
3. **Set Up Authentication** - Firebase Auth with custom claims for roles
4. **Design UI Components** - Separate layouts for applicants and lenders
5. **Implement API Routes** - Backend logic for applications, approvals
6. **Deploy to Vercel** - GitHub integration for automatic deployments
7. **Feature Flags System** - Firestore-backed flag engine
8. **Firestore Security Rules** - Implement role-based access control
9. **Testing & Documentation** - Unit tests, E2E tests, API docs
10. **Launch** - Monitor metrics and gather user feedback

---

## Document References
- [Data Structure Details](./DATA_STRUCTURE.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Feature Flags Implementation](./FEATURE_FLAGS.md)
