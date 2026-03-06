# Data Structure - Detailed Reference

## Firestore Collections Schema

### 1. Users Collection

**Path:** `users/{userId}`

**Purpose:** Store user profile and authentication data

**Document Schema:**
```typescript
interface User {
  // Common fields
  uid: string;                          // Firebase Auth UID
  email: string;
  firstName: string;
  lastName: string;
  role: "applicant" | "lender";         // User type
  profileComplete: boolean;              // Profile completion status
  status: "active" | "suspended" | "inactive";
  profilePhotoUrl?: string;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;
  
  // Additional metadata
  phoneVerified: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
}
```

**Applicant Sub-fields:**
```typescript
interface ApplicantProfile extends User {
  // Personal Information
  dateOfBirth: string;                   // YYYY-MM-DD
  ssn?: string;                          // Last 4 digits only (encrypted)
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
  annualIncome: number;
  
  // Credit Information
  creditScore?: number;
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
    preferredLoanTerms: number[];        // Months
    maxDesiredRate: number;               // Percentage
    notificationPreferences: string[];
  };
}
```

**Lender Sub-fields:**
```typescript
interface LenderProfile extends User {
  // Business Information
  businessName: string;
  businessEntity: "sole_proprietor" | "llc" | "corporation" | "partnership";
  einOrTaxId: string;                    // Partially masked
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
    averageROI: number;                  // %
    defaultRate: number;                 // %
    earlyPayoffRate: number;             // %
    averageLoanDuration: number;         // months
  };
  
  // Banking Details (Encrypted)
  bankingInfo?: {
    bankName: string;
    accountType: "checking" | "savings" | "money_market";
    routingNumber: string;               // Partially masked
    accountNumber: string;               // Last 4 only
    verified: boolean;
  };
  
  // Preferences
  lendingPreferences: {
    minCreditScore: number;
    maxDebtToIncome: number;
    preferredLoanTypes: string[];
    geographicFocus?: string[];
    autoApprovalThreshold?: number;     // Loan amount
  };
}
```

**Indexes Required:**
- `users.role` (Ascending)
- `users.status` (Ascending)
- `users.createdAt` (Descending)
- `applicant users.creditScore` (Descending)
- `lender users.metrics.activeLoans` (Descending)

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
  lenderId?: string;                     // Assigned lender (null if unassigned)
  
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
  
  // Approval Workflow
  approvals: LenderApproval[];
  
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
    viewedBy: Array<{
      userId: string;
      viewedAt: Timestamp;
    }>;
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

**Sub-collection: Payments**

**Path:** `loans/{loanId}/payments/{paymentId}`

```typescript
interface Payment {
  paymentId: string;
  loanId: string;
  
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
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  failureReason?: string;
}
```

---

### 4. Feature Flags Collection

**Path:** `featureFlags/{flagId}`

**Purpose:** Store feature flag configurations for deployment control

**Document Schema:**
```typescript
interface FeatureFlag {
  // Identity
  flagId: string;
  name: string;                          // kebab-case: "new_dashboard", "advanced_search"
  description: string;
  
  // Basic Control
  enabled: boolean;                      // Master switch
  rolloutPercentage: number;             // 0-100
  
  // Targeting
  targetRoles: ("applicant" | "lender")[]; // Empty = all roles
  targetUsers: string[];                 // Empty = all users (respecting rollout%)
  targetEnvironments: ("dev" | "staging" | "production")[];
  
  // Scheduling
  startDate?: Timestamp;
  endDate?: Timestamp;
  
  // Rules Engine
  rules: FlagRule[];
  
  // Metadata
  metadata: {
    createdBy: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    updatedBy: string;
    version: number;
    changelog: Array<{
      version: number;
      change: string;
      timestamp: Timestamp;
      changedBy: string;
    }>;
  };
}

interface FlagRule {
  ruleId: string;
  description: string;
  
  // Conditions (AND logic between conditions, OR within arrays)
  conditions: Array<{
    field: string;                       // e.g., "user.creditScore", "loan.amount"
    operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";
    value: any;
  }>;
  
  // Action
  enabled: boolean;                      // Override for this rule
  priority: number;                      // Higher = evaluated first
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Example Flags:**
```typescript
// Flag 1: New Dashboard Feature
{
  flagId: "new_dashboard_v2",
  name: "new_dashboard_v2",
  description: "Redesigned applicant dashboard with improved UX",
  enabled: true,
  rolloutPercentage: 25,
  targetRoles: ["applicant"],
  targetEnvironments: ["production"],
  rules: [
    {
      ruleId: "high_value_users",
      description: "Always enable for users with >$50k annual income",
      conditions: [
        { field: "user.applicant.annualIncome", operator: "gte", value: 50000 }
      ],
      enabled: true,
      priority: 1
    }
  ],
  metadata: {
    createdBy: "admin_001",
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    updatedBy: "admin_001",
    version: 1
  }
}

// Flag 2: Advanced Search for Lenders
{
  flagId: "advanced_search_lender",
  name: "advanced_search_lender",
  description: "Advanced filtering and search for lenders",
  enabled: true,
  rolloutPercentage: 50,
  targetRoles: ["lender"],
  targetEnvironments: ["production"],
  rules: [],
  metadata: { ... }
}
```

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
  targetType: "application" | "loan" | "user" | "payment" | "flag";
  
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
  ↓
loanApplications
  ↓
loans (after approval)
  ↓
payments

users (Lender) ← assigns to → loanApplications
```

### Business Rules

1. **Application Status Progression:**
   - draft → submitted → under_review → (approved → funded → completed) OR rejected

2. **Loan Creation:**
   - Only created when application status = approved
   - Automatic creation or manual trigger (configurable)

3. **Payment Schedule:**
   - Generated when loan is funded
   - Fixed monthly schedule based on loan terms

4. **Applicant & Lender Isolation:**
   - Applicants can only see their own applications
   - Lenders can only see assigned applications
   - Admin sees everything

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

### Get Feature Flags for User
```
db.collection('featureFlags')
  .where('enabled', '==', true)
  .where('targetRoles', 'array-contains', userRole)
```

---

## Document Size Estimates

| Collection | Estimate | Notes |
|-----------|----------|-------|
| Users | 2-5 KB | Average with profile data |
| Applications | 10-50 KB | With documents array |
| Loans | 5-10 KB | Core loan data |
| Payments | 1 KB | Each payment record |
| Feature Flags | 2-5 KB | With complex rules |
| Audit Logs | 1-2 KB | Lightweight tracking |

