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
}
