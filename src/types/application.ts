import type { Timestamp } from 'firebase-admin/firestore';

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'funded'
  | 'completed';

export type DocumentType =
  | 'pay_stub'
  | 'bank_statement'
  | 'tax_return'
  | 'id_verification'
  | 'proof_of_address'
  | 'employment_letter'
  | 'other';

export interface ApplicationDocument {
  documentId: string;
  type: DocumentType;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  uploadedAt: Timestamp;
  uploadedBy: string;
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
}

export interface LenderApproval {
  approverId: string;
  approvedAt: Timestamp;
  status: 'approved' | 'rejected';
  approvedAmount: number;
  approvedRate: number;
  approvedTerm: number;
  monthlyPayment: number;
  comments: string;
  conditions?: string[];
}

export interface Comment {
  commentId: string;
  userId: string;
  text: string;
  createdAt: Timestamp;
  isInternal: boolean;
}

export interface LoanApplication {
  applicationId: string;
  applicantId: string;
  status: ApplicationStatus;
  substatus?: string;
  submittedAt?: Timestamp;
  loanDetails: {
    requestedAmount: number;
    currency: string;
    loanPurpose: 'personal' | 'business' | 'auto' | 'home_improvement' | 'consolidation' | 'other';
    purposeDescription: string;
    requestedTerm?: number;
    approvedTerm?: number;
    approvedLoanAmount?: number;
    requestedRate?: number;
    approvedRate?: number;
    monthlyPayment?: number;
  };
  financialInformation: {
    monthlyIncome: number;
    incomeSource: string;
    employmentType: string;
    monthlyExpenses: number;
    currentDebts: number;
    existingLoans: number;
    debtToIncomeRatio: number;
    savingsBalance: number;
    assets: {
      homeValue?: number;
      vehicleValue?: number;
      investmentValue?: number;
    };
  };
  documents: ApplicationDocument[];
  underwriting: {
    riskScore?: number;
    recommendation?: 'approve' | 'decline' | 'manual_review';
    notes: string;
    underwriterIds: string[];
    lastAssessedAt?: Timestamp;
  };
  approval?: LenderApproval;
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
  metadata: {
    comments: Comment[];
    internalNotes: string;
  };
  // TerePay-specific sections (present when created via the 8-step wizard)
  personalInfo?: TerePayPersonalInfo;
  employment?: TerePayEmployment;
  livingExpenses?: TerePayLivingExpenses;
  existingDebts?: TerePayExistingDebts;
  bankDetails?: TerePayBankDetails;
  references?: TerePayReferences;
  declarations?: TerePayDeclarations;
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
