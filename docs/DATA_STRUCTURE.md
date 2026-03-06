# Data Structure - Detailed Reference

## Firestore Collections Schema

### 1. Users Collection (Common fields)

**Path:** `users/{userId}`

**Purpose:** Store common user profile data. Role-specific data is in subcollections to keep documents small, enable granular security rules, and isolate PII.

**Document Schema:**
```typescript
interface User {
  uid: string;                          // Firebase Auth UID
  email: string;
  firstName: string;
  lastName: string;
  role: "applicant" | "lender";
  profileComplete: boolean;
  status: "active" | "suspended" | "inactive";
  profilePhotoUrl?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;

  phoneVerified: boolean;
  emailVerified: boolean;
}
```

**Indexes Required:**
- `users.role` (Ascending)
- `users.status` (Ascending)
- `users.createdAt` (Descending)

---

### 1a. Applicant Profile Subcollection

**Path:** `users/{userId}/applicantProfile/profile` (single document)

**Purpose:** Store applicant-specific personal, employment, and credit data.

**PII Encryption:** Fields marked with `🔒` are encrypted at the application layer using AES-256-GCM before writing to Firestore. They are stored as opaque strings and decrypted server-side on read. See PLATFORM_PLAN.md Section 8.3 for implementation.

```typescript
interface ApplicantProfile {
  // Personal Information
  dateOfBirth: string;                   // 🔒 Encrypted (YYYY-MM-DD)
  ssn?: string;                          // 🔒 Encrypted (last 4 digits)
  phone: string;

  // Address
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;

  // Employment
  employmentStatus: "employed" | "self-employed" | "unemployed" | "retired";
  employerName?: string;
  jobTitle?: string;
  yearsAtCurrentJob?: number;
  annualIncome: string;                  // 🔒 Encrypted (number as string)

  // Credit Information
  creditScore?: string;                  // 🔒 Encrypted (number as string)
  creditHistory: {
    accounts: number;
    inquiries: number;
    latePayments: number;
    totalDebt: number;
  };

  // Documents
  identityVerified: boolean;
  incomeVerified: boolean;

  // Preferences
  loanPreferences: {
    preferredLoanTerms: number[];
    maxDesiredRate: number;
    notificationPreferences: string[];
  };
}
```

---

### 1b. Lender Profile Subcollection

**Path:** `users/{userId}/lenderProfile/profile` (single document)

**Purpose:** Store lender business information, verification, metrics, and preferences.

```typescript
interface LenderProfile {
  // Business Information
  businessName: string;
  businessEntity: "sole_proprietor" | "llc" | "corporation" | "partnership";
  einOrTaxId: string;                    // 🔒 Encrypted
  businessType: "traditional_lender" | "crowdfunding" | "peer_to_peer" | "other";
  yearsInBusiness: number;

  // Lending Capacity
  annualFundingCapacity: number;
  currentlyAvailable: number;

  // Verification
  verification: {
    isVerified: boolean;
    verificationLevel: "basic" | "standard" | "premium";
    verifiedAt?: Timestamp;
    documentUrls: string[];
    approvedBy?: string;
    approvalDate?: Timestamp;
  };

  // Performance Metrics
  metrics: {
    activeLoans: number;
    totalFundsDispersed: number;
    totalLoansCompleted: number;
    averageROI: number;
    defaultRate: number;
    earlyPayoffRate: number;
    averageLoanDuration: number;
  };

  // Banking Details
  bankingInfo?: {
    bankName: string;
    accountType: "checking" | "savings" | "money_market";
    routingNumber: string;               // 🔒 Encrypted
    accountNumber: string;               // 🔒 Encrypted (last 4)
    verified: boolean;
  };

  // Preferences
  lendingPreferences: {
    minCreditScore: number;
    maxDebtToIncome: number;
    preferredLoanTypes: string[];
    geographicFocus?: string[];
    autoApprovalThreshold?: number;
  };
}
```

---

### 2. Loan Applications Collection

**Path:** `loanApplications/{applicationId}`

**Purpose:** Store loan application data submitted by applicants

**Document Schema:**
```typescript
interface LoanApplication {
  // Identifiers
  applicationId: string;                 // UUID
  applicantId: string;                   // Reference to users/{userId}
  // Single-lender model: no lenderId field needed. The lender sees all submitted applications.
  
  // Status Tracking
  status: "draft" | "submitted" | "under_review" | "approved" | 
          "rejected" | "funded" | "completed";
  substatus?: string;                    // More granular status
  submittedAt?: Timestamp;
  
  // Loan Specifications
  loanDetails: {
    requestedAmount: number;
    currency: string;                    // ISO 4217 (default: "USD")
    loanPurpose: "personal" | "business" | "auto" | "home_improvement" | "consolidation" | "other";
    purposeDescription: string;
    
    // Terms (determined by lender)
    requestedTerm?: number;              // Months (applicant preference)
    approvedTerm?: number;               // Months (lender decision)
    approvedLoanAmount?: number;         // Actual approved amount
    
    // Rates
    requestedRate?: number;              // Applicant's expectation
    approvedRate?: number;               // Lender's rate
    monthlyPayment?: number;             // Calculated: P * (r*(1+r)^n)/((1+r)^n-1)
  };
  
  // Applicant Financial Information
  financialInformation: {
    monthlyIncome: number;
    incomeSource: string;
    employmentType: string;
    monthlyExpenses: number;
    currentDebts: number;
    existingLoans: number;
    debtToIncomeRatio: number;           // Calculated: totalMonthlyDebts / monthlyIncome
    savingsBalance: number;
    
    // Assets
    assets: {
      homeValue?: number;
      vehicleValue?: number;
      investmentValue?: number;
    };
  };
  
  // Document Management
  documents: Document[];
  
  // Underwriting
  underwriting: {
    riskScore?: number;                  // 0-999
    recommendation?: "approve" | "decline" | "manual_review";
    notes: string;
    underwriterIds: string[];
    lastAssessedAt?: Timestamp;
  };
  
  // Approval (single lender decision)
  approval?: LenderApproval;
  
  // Timeline
  timeline: {
    createdAt: Timestamp;
    updatedAt: Timestamp;
    submittedAt?: Timestamp;
    reviewStartedAt?: Timestamp;
    approvedAt?: Timestamp;
    fundedAt?: Timestamp;
    completedAt?: Timestamp;
    rejectedAt?: Timestamp;
  };
  
  // Metadata
  metadata: {
    comments: Comment[];
    internalNotes: string;
  };
}

interface Document {
  documentId: string;
  type: "pay_stub" | "bank_statement" | "tax_return" | "id_verification" |
         "proof_of_address" | "employment_letter" | "other";
  fileName: string;
  fileUrl: string;                       // Cloud Storage URL
  fileSize: number;
  uploadedAt: Timestamp;
  uploadedBy: string;
  status: "pending" | "verified" | "rejected";
  rejectionReason?: string;
}

interface LenderApproval {
  approverId: string;
  approvedAt: Timestamp;
  status: "approved" | "rejected";
  
  // Approval Terms
  approvedAmount: number;
  approvedRate: number;
  approvedTerm: number;
  monthlyPayment: number;
  
  // Comments
  comments: string;
  conditions?: string[];                // e.g., "Must provide recent bank statement"
}

interface Comment {
  commentId: string;
  userId: string;
  text: string;
  createdAt: Timestamp;
  isInternal: boolean;                   // Visible only to lenders/admins
}
```

**Indexes Required:**
- `loanApplications.applicantId` (Ascending)
- `loanApplications.status` (Ascending)
- `loanApplications.status, loanApplications.submittedAt` (Composite, Descending)
- `loanApplications.underwriting.riskScore` (Descending)
- `loanApplications.timeline.submittedAt` (Descending)

---

### 3. Loans Collection

**Path:** `loans/{loanId}`

**Purpose:** Store active and completed loan records (created after approval)

**Document Schema:**
```typescript
interface Loan {
  // Identifiers
  loanId: string;                        // UUID
  applicationId: string;                 // Reference to loanApplications
  applicantId: string;                   // Reference to users
  lenderId: string;                      // Reference to users
  
  // Loan Terms
  principal: number;
  interestRate: number;                  // Annual percentage rate
  term: number;                          // Total months
  monthlyPayment: number;
  dailyInterestRate: number;             // Calculated: interestRate / 365
  
  // Timeline
  dateIssued: Timestamp;
  dueDate: Timestamp;
  nextPaymentDate: Timestamp;
  expectedCompletionDate: Timestamp;
  
  // Status
  status: "active" | "delinquent" | "paid_off" | "defaulted";
  
  // Payment Tracking
  totalPayments: number;                 // Total expected payments
  paymentsCompleted: number;
  paymentsRemaining: number;
  lastPaymentDate?: Timestamp;
  
  // Financial Summary
  totalPaid: number;
  remainingBalance: number;
  totalInterestPaid: number;
  estimatedTotalInterest: number;
  
  // Delinquency
  daysOverdue: number;
  daysDelinquent: number;
  latePaymentCount: number;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 4. Payments Collection (Top-Level)

**Path:** `payments/{paymentId}`

**Purpose:** Payments are a top-level collection (not a subcollection under loans) to enable cross-loan queries such as "all payments for the lender" or "all overdue payments" without needing collection group queries.

```typescript
interface Payment {
  paymentId: string;
  loanId: string;                        // Reference to loans
  applicantId: string;                   // Reference to users (denormalized for querying)
  lenderId: string;                      // Reference to users (denormalized for querying)

  // Payment Details
  amount: number;
  principal: number;
  interest: number;

  // Dates
  dueDate: Timestamp;
  paidDate?: Timestamp;
  processedAt?: Timestamp;

  // Status
  status: "scheduled" | "pending" | "completed" | "failed" | "reversed";

  // Payment Method
  method: "bank_transfer" | "card" | "ach" | "check" | "manual";
  transactionId?: string;

  // Idempotency
  idempotencyKey: string;                // Client-generated UUID, prevents duplicate processing

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  failureReason?: string;
}
```

**Indexes Required:**
- `payments.loanId` (Ascending)
- `payments.applicantId, payments.status` (Composite)
- `payments.lenderId, payments.status` (Composite)
- `payments.dueDate` (Ascending)
- `payments.idempotencyKey` (Ascending, unique)

---

> **Note:** Feature flags are managed exclusively via Vercel's `@vercel/flags` system. There is no `featureFlags` Firestore collection.

---

### 5. Audit Logs Collection

**Path:** `auditLogs/{logId}`

**Purpose:** Track all user actions and system events for compliance and debugging

**Document Schema:**
```typescript
interface AuditLog {
  logId: string;
  
  // User Information
  userId: string;
  userRole: "applicant" | "lender" | "admin";
  
  // Action Details
  action: string;                        // e.g., "APPLICATION_SUBMITTED", "LOAN_APPROVED"
  actionCategory: "authentication" | "application" | "loan" | "payment" | "system";
  
  // Target Information
  targetId: string;                      // e.g., applicationId, loanId
  targetType: "application" | "loan" | "user" | "payment";
  
  // Changes (if applicable)
  changes?: {
    field: string;
    before: any;
    after: any;
  }[];
  
  // Request Information
  ipAddress: string;
  userAgent: string;
  
  // Status
  status: "success" | "failure";
  errorMessage?: string;
  
  // Timestamps
  timestamp: Timestamp;
}
```

---

### 6. Notifications Collection (Optional)

**Path:** `notifications/{notificationId}`

**Purpose:** Store user notifications and preferences

```typescript
interface Notification {
  notificationId: string;
  userId: string;
  
  type: "application_status" | "payment_reminder" | "announcement" | "alert";
  title: string;
  message: string;
  
  relatedId?: string;                    // applicationId, loanId, etc.
  actionUrl?: string;
  
  read: boolean;
  readAt?: Timestamp;
  
  createdAt: Timestamp;
}
```

---

## Data Relationships & Constraints

### Foreign Key Relationships

```
users (Applicant)
  ├── users/{id}/applicantProfile/profile
  ↓
loanApplications
  ↓
loans (after approval)
  ↓
payments (top-level, references loanId + applicantId + lenderId)

users (Lender)
  ├── users/{id}/lenderProfile/profile
  └── reads all submitted loanApplications (single-lender model)
```

### Business Rules

1. **Application Status Progression:**
   - draft → submitted → under_review → (approved → funded → completed) OR rejected

2. **Loan Creation:**
   - Only created when application status = approved
   - Uses Firestore transactions for atomicity (update application + create loan)
   - Idempotency key prevents duplicates on retry

3. **Payment Schedule:**
   - Generated when loan is funded
   - Fixed monthly schedule based on loan terms
   - Each payment record has an idempotency key

4. **Single-Lender Access Model:**
   - Applicants can only see their own applications and payments
   - The lender sees all submitted applications and all payments
   - Future: multi-lender support with assignment model

---

## Query Examples

### Get Applications by Status
```
db.collection('loanApplications')
  .where('status', '==', 'under_review')
  .orderBy('submittedAt', 'desc')
  .limit(20)
```

### Get User's Active Loans
```
db.collection('loans')
  .where('applicantId', '==', userId)
  .where('status', 'in', ['active', 'delinquent'])
  .orderBy('nextPaymentDate')
```

### Get All Payments for Lender
```
db.collection('payments')
  .where('lenderId', '==', lenderId)
  .where('status', '==', 'pending')
  .orderBy('dueDate', 'asc')
```

### Get Overdue Payments (cross-loan query, no collection group needed)
```
db.collection('payments')
  .where('status', '==', 'scheduled')
  .where('dueDate', '<', now)
  .orderBy('dueDate', 'asc')
```

---

## Document Size Estimates

| Collection | Estimate | Notes |
|-----------|----------|-------|
| Users (common) | 1 KB | Slim common fields |
| Applicant Profile | 2-4 KB | Includes encrypted PII |
| Lender Profile | 3-5 KB | Business info + metrics |
| Applications | 10-50 KB | With documents array |
| Loans | 5-10 KB | Core loan data |
| Payments | 1 KB | Each payment record (top-level) |
| Audit Logs | 1-2 KB | Lightweight tracking |

