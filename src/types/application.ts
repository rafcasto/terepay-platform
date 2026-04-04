import type { Timestamp } from 'firebase-admin/firestore';

// ---------------------------------------------------------------------------
// LMS Application Statuses (CCCFA-aligned workflow)
// ---------------------------------------------------------------------------
export type ApplicationStatus =
  | 'draft'
  | 'pending_review'
  | 'under_assessment'
  | 'waiting_for_docs'
  | 'credit_check'
  | 'approved'
  | 'disbursed'
  | 'active'
  | 'closed_repaid'
  | 'declined'
  | 'withdrawn'
  | 'expired';

// Legacy statuses retained for backward-compat during migration
export type LegacyApplicationStatus =
  | 'submitted'
  | 'under_review'
  | 'rejected'
  | 'funded'
  | 'completed';

export type AnyApplicationStatus = ApplicationStatus | LegacyApplicationStatus;

export type DocumentType =
  | 'passport'
  | 'drivers_licence'
  | 'visa'
  | 'payslip'
  | 'bank_statement'
  | 'other';

export type DocumentStatus = 'pending' | 'accepted' | 'rejected';

export interface ApplicationDocument {
  documentId: string;
  type: DocumentType;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadedAt: Timestamp;
  uploadedBy: string; // uid
  status: DocumentStatus;
  rejectionReason?: string;
  reviewedAt?: Timestamp;
  reviewedBy?: string; // lender uid
}

export interface InternalNote {
  noteId: string;
  lenderId: string;
  lenderName: string;
  text: string;
  createdAt: Timestamp;
}

export interface LenderDecision {
  decidedBy: string; // lender uid
  decidedAt: Timestamp;
  action: 'approved' | 'declined';
  rationale: string; // mandatory
  declineReasons?: string[];
  approvedAmount?: number;
  disbursementDetails?: {
    amount: number;
    date: string;
    reference: string;
  };
}

export interface RepaymentSchedule {
  installments: Array<{
    installmentNumber: number;
    dueDate: string;
    amount: number;
    status: 'scheduled' | 'paid' | 'overdue';
  }>;
  totalRepayment: number;
}

// ---------------------------------------------------------------------------
// Affordability Assessment (CCCFA-aligned)
// ---------------------------------------------------------------------------
export interface AffordabilityIncomeRow {
  category: string;
  centrixAmount: number;      // lender enters from Centrix
  verifiedAmount: number;     // lender enters from payslips
  adjustment: number;         // lender enters
  adjustmentReason?: string;
  finalAmount: number;        // auto: MIN(centrix, verified) + adjustment
}

export interface AffordabilityExpenseRow {
  category: string;
  centrixAmount: number;      // lender enters from bank analysis
  benchmarkAmount: number;    // auto from catalog × multiplier
  adjustment: number;         // lender enters with reason
  adjustmentReason?: string;
  finalAmount: number;        // auto: MAX(centrix, benchmark) + adjustment
  benchmarkOverrideAcknowledged?: boolean;
}

export interface AffordabilityAssessment {
  assessmentId: string;
  applicationId: string;
  version: number;
  lenderId: string;
  lenderName: string;
  assessedAt: Timestamp;
  status: 'in_progress' | 'complete';
  isSuperseded: boolean;

  // Checklist
  checklist: {
    centrixReportObtained: boolean;
    centrixReportNumber?: string;
    firstTransactionVerified: boolean;
    firstTransactionDate: string;
    daysOfTransactionData: number;       // auto-calculated
    payslipsReceived: boolean;
    creditReportObtained: boolean;
    employmentVerified: boolean;
    employmentVerificationMethod?: string;
    visaConfirmed: boolean;
    visaExpiryDate?: string;
  };

  // Data
  incomeRows: AffordabilityIncomeRow[];
  expenseRows: AffordabilityExpenseRow[];
  householdMultiplier: number;
  catalogVersionId: string;  // snapshot at time of assessment

  // Calculations (all auto)
  totalVerifiedIncome: number;
  totalExpenses: number;
  netDisposableIncome: number;
  loanFortnightlyPayment: number;
  finalAvailableSurplus: number;

  // Decision logic
  hardDeclineTriggers: string[];    // list any triggered
  redFlagsRaised: string[];
  redFlagsAcknowledged: Record<string, string>; // flag → lender acknowledgement
  surplusRating: 'affordable' | 'marginal' | 'high_risk' | 'not_affordable';
  recommendation: 'proceed' | 'decline';
}

// ---------------------------------------------------------------------------
// Benchmark Catalog
// ---------------------------------------------------------------------------
export interface BenchmarkEntry {
  benchmarkId: string;
  categoryName: string;
  householdType: string;
  fortnightlyAmount: number;
  rangeLow: number;
  rangeHigh: number;
  source: string;
  effectiveFrom: string;
  effectiveTo?: string;
  createdBy: string;
  lastUpdated: Timestamp;
  isActive: boolean;
  previousVersionId?: string;
}

export interface HouseholdMultiplier {
  multiplierId: string;
  householdType: string;
  multiplier: number;
  effectiveFrom: string;
  effectiveTo?: string;
  createdBy: string;
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Affordability Assessment Draft (persisted step-by-step)
// ---------------------------------------------------------------------------
export interface AffordabilityDraftData {
  currentStep: number;
  checklist: {
    centrixReportObtained: boolean;
    centrixReportNumber: string;
    firstTransactionVerified: boolean;
    firstTransactionDate: string;
    payslipsReceived: boolean;
    creditReportObtained: boolean;
    employmentVerified: boolean;
    employmentVerificationMethod: string;
    visaConfirmed: boolean;
    visaExpiryDate: string;
  };
  incomeRows: Array<{
    category: string;
    centrixAmount: number;
    verifiedAmount: number;
    adjustment: number;
    adjustmentReason: string;
    finalAmount: number;
  }>;
  expenseRows: Array<{
    category: string;
    centrixAmount: number;
    benchmarkAmount: number;
    adjustment: number;
    adjustmentReason: string;
    finalAmount: number;
  }>;
  recommendation: 'proceed' | 'decline';
  savedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Main LoanApplication type
// ---------------------------------------------------------------------------
export interface LoanApplication {
  applicationId: string;
  referenceNumber: string;           // e.g. TP-2026-00001
  applicantId: string;
  assignedLenderId?: string;
  status: ApplicationStatus;
  submittedAt?: Timestamp;

  // Loan product details (TerePay fixed-product)
  loanDetails: {
    requestedAmount: number;
    currency: string;
    loanPurpose: string;
    purposeDescription: string;
    // Filled on approval
    approvedAmount?: number;
    applicationFee?: number;
    fortnightlyPayment?: number;
    totalRepayment?: number;
    disbursementDate?: string;
  };

  // Legacy financial summary (computed from 8-section form)
  financialInformation: {
    monthlyIncome: number;
    incomeSource: string;
    employmentType: string;
    monthlyExpenses: number;
    currentDebts: number;
    existingLoans: number;
    debtToIncomeRatio: number;
    savingsBalance: number;
  };

  documents: ApplicationDocument[];
  documentRequest?: {
    requestedAt: Timestamp;
    requestedBy: string;
    requiredDocuments: string[];
    message?: string;
  };

  internalNotes: InternalNote[];
  decision?: LenderDecision;
  repaymentSchedule?: RepaymentSchedule;

  // Affordability assessment IDs (most recent first)
  affordabilityAssessmentIds: string[];
  affordabilityStatus: 'not_started' | 'in_progress' | 'complete';
  /** Persisted step-by-step draft while the lender is filling the assessment */
  affordabilityDraft?: AffordabilityDraftData;
  /** True when the applicant is flagged as an existing customer ($30 fee) */
  isExistingCustomer?: boolean;
  creditCheck?: {
    reportNumber: string;
    reportDate: string;
    requestedBy: string;
    requestedAt: Timestamp;
    result: 'pass' | 'fail' | 'pending';
    summary?: string;
  };

  timeline: {
    createdAt: Timestamp;
    updatedAt: Timestamp;
    submittedAt?: Timestamp;
    claimedAt?: Timestamp;
    assessmentStartedAt?: Timestamp;
    approvedAt?: Timestamp;
    disbursedAt?: Timestamp;
    closedAt?: Timestamp;
    declinedAt?: Timestamp;
  };

  // TerePay 8-section form data
  personalInfo?: TerePayPersonalInfo;
  employment?: TerePayEmployment;
  livingExpenses?: TerePayLivingExpenses;
  existingDebts?: TerePayExistingDebts;
  loanRequest?: TerePayLoanRequest;
  bankDetails?: TerePayBankDetails;
  references?: TerePayReferences;
  declarations?: TerePayDeclarations;
}

// Legacy type alias for backward compat
export interface LegacyLoanApplication extends Omit<LoanApplication, 'status'> {
  status: AnyApplicationStatus;
}

// ---------------------------------------------------------------------------
// TerePay sub-types (mirrors terepayApplicationSchema)
// ---------------------------------------------------------------------------

export interface TerePayPersonalInfo {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postCode: string;
  timeAtAddress: string;
  housingStatus: 'rent' | 'own' | 'flatmates' | 'other';
  visaStatus: 'work_visa' | 'resident_visa' | 'student_visa' | 'citizen' | 'other';
  visaExpiryDate?: string;
  householdType: 'single' | 'single_children' | 'couple' | 'couple_children';
  numberOfChildren: number;
  numberOfDependents: number;
}

export interface TerePayEmployment {
  employerName: string;
  employerAddress: string;
  occupation: string;
  hoursPerWeek: number;
  employmentStatus: 'permanent' | 'fixed_term' | 'casual' | 'part_time';
  timeAtEmployer: string;
  previousEmployer?: string;
  income: {
    salaryBeforeTax: number;
    salaryAfterTax: number;
    winz: number;
    otherIncome: number;
    otherIncomeDescription?: string;
  };
}

export interface TerePayLivingExpenses {
  nonDiscretionary: {
    food: number; utilities: number; personalExpenses: number; transport: number;
    medical: number; childcare: number; accommodation: number; healthInsurance: number;
    carInsurance: number; rates: number; education: number; childSupport: number;
    remittances: number;
  };
  discretionary: {
    restaurants: number; entertainment: number; travel: number; subscriptions: number;
    homeImprovement: number; cashWithdrawals: number; other: number;
  };
  subscriptionDetails: {
    gym: { amount: number; frequency: string };
    netflix: { amount: number; frequency: string };
    spotify: { amount: number; frequency: string };
    sports: { amount: number; frequency: string };
    others: { amount: number; frequency: string };
  };
  bnpl: { afterpay: number; klarna: number; zip: number };
}

export interface TerePayExistingDebts {
  mortgage: { totalOwed: number; fortnightlyPayment: number };
  personalLoans: { totalOwed: number; fortnightlyPayment: number };
  carLoans: { totalOwed: number; fortnightlyPayment: number };
  creditCard: { totalOwed: number; fortnightlyPayment: number };
  bankOverdrafts: { totalOwed: number; fortnightlyPayment: number };
  otherLoans: Array<{ description?: string; totalOwed: number; fortnightlyPayment: number }>;
  debtPurposeDescription?: string;
}

export interface TerePayLoanRequest {
  requestedAmount: number;
  purpose: string;
  purposeDescription: string;
  primaryIncomeSource: string;
  isPEP: boolean;
  pepDetails?: string;
  remittance: {
    frequency: 'weekly' | 'fortnightly' | 'monthly' | 'occasionally' | 'never';
    averageAmount: number;
    purposes: string[];
  };
}

export interface TerePayBankDetails {
  bankName: string;
  accountHolderName: string;
  accountNumber: string; // store encrypted in production
  paymentMethod: 'direct_debit' | 'bank_transfer';
}

export interface TerePayReferences {
  reference1?: { name?: string; email?: string; phone?: string };
  reference2?: { name?: string; email?: string; phone?: string };
}

export interface TerePayDeclarations {
  infoAccurate: boolean;
  understandsVerification: boolean;
  authorisesContacts: boolean;
  understandsTerms: boolean;
  canAffordRepayments: boolean;
  receivedDisclosure: boolean;
  understandsConsequences: boolean;
  privacyPolicy: boolean;
  creditReporting: boolean;
  submittedAt: string; // ISO timestamp
}
