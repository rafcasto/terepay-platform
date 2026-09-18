import type {
  CommunicationChannel,
  CommunicationDirection,
  DocumentStatus,
  ScheduledPayment,
} from '@/types/application';
import type { PillTone } from '@/components/lender/ConsolePill';

export type ReportItem = { id: string; fileName: string; uploadedAt: string; uploadedBy: string };

/** A document the lender can accept / reject. Used for both application uploads and onboarding KYC evidence. */
export type ReviewableDocument = {
  id: string;
  title: string;
  subtitle: string;
  uploadedAt: string;
  status: DocumentStatus;
  viewUrl: string;
  /** PATCH endpoint that accepts `{ action: 'accept' | 'reject', rejectionReason? }`. */
  reviewUrl: string;
  rejectionReason?: string;
  reviewedAt?: string;
  kind: 'identity' | 'income' | 'other';
};

/** A piece of evidence from a previous application / the customer profile that may not need re-collecting. */
export type ReuseItem = {
  key: string;
  label: string;
  fileName: string;
  fromLabel: string;
  date: string;
  ageLabel: string;
  /** null = no expiry policy (e.g. identity verification); true/false = inside / outside the reuse window. */
  reusable: boolean | null;
  windowMonths?: number;
  expiresLabel?: string;
  viewUrl: string;
};

export type PreviousApplication = {
  id: string;
  reference: string;
  statusLabel: string;
  statusTone: PillTone;
  amount: string;
  date: string;
  href: string;
};

export type ApplicantHistory = {
  previousCount: number;
  previous: PreviousApplication[];
  lastLoanLabel?: string;
  reuse: ReuseItem[];
};

export type CommunicationItem = {
  id: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  summary: string;
  outcome?: string;
  occurredAt: string;
  loggedBy: string;
};

export type ReviewData = {
  applicationId: string;
  status: string;
  statusLabel: string;
  statusTone: PillTone;
  isAssigned: boolean;
  isExistingCustomer: boolean;
  /** Lender may accept / reject documents (assigned, no final decision yet). */
  canReviewDocs: boolean;
  /** Lender may send a "request more documents" ask (assigned + status allows). */
  canRequestDocs: boolean;
  header: {
    reference: string;
    name: string;
    initials: string;
    email: string;
    phone: string;
    requested: string;
    purpose: string;
    submittedLabel: string;
  };
  snapshot: {
    dob: string;
    address: string;
    visa: string;
    employer: string;
    monthlyIncome: string;
    monthlyExpenses: string;
    monthlySurplus: string;
    surplusTone: 'pos' | 'neg' | 'none';
  };
  documents: ReviewableDocument[];
  docsVerified: number;
  docsPending: number;
  docsTotal: number;
  documentRequest?: {
    requestedAt: string;
    requiredDocuments: string[];
    message?: string;
    outstanding: boolean;
  };
  affordability: {
    statusLabel: string;
    complete: boolean;
    assessmentCount: number;
    canAssess: boolean;
    pdfUrl: string;
    assessUrl: string;
  };
  estimatedFee: string;
  feeIsEstimated: boolean;
  employment: { label: string; value: string }[];
  expenses: { label: string; value: string }[];
  debts: { label: string; owed: string; fortnightly: string }[];
  notes: { id: string; author: string; date: string; text: string }[];
  timeline: { label: string; date: string }[];
  decision?: {
    approved: boolean;
    approvedAmount?: string;
    decidedAt: string;
    rationale: string;
    declineReasons?: string[];
  };
  applicantRejection?: { rejectedAt: string; reason: string };
  payments: { show: boolean; scheduled: ScheduledPayment[] };
  disburse?: {
    approvedAmount: number;
    applicationFee: number;
    bankDetails?: {
      bankName: string;
      accountHolderName: string;
      accountNumber: string;
      paymentMethod?: 'direct_debit' | 'bank_transfer';
    };
    consentStatus?: string;
    consentActivatedAt?: string;
  };
  decisionInput: { requestedAmount: number; assessedAmount?: number };
  kyc: {
    borrowerStatusLabel: string;
    borrowerStatusTone: PillTone;
    borrowerDocuments: ReviewableDocument[];
    reports: ReportItem[];
  };
  credit: {
    reports: ReportItem[];
    affordabilityReports: ReportItem[];
    score: number;
    band: string;
    min: number;
    max: number;
    defaults: number;
    enquiries: number;
    utilisation: string;
    dti: string;
  };
  history: ApplicantHistory;
  communications: CommunicationItem[];
};

export type TabKey = 'overview' | 'documents' | 'affordability' | 'kyc' | 'credit' | 'communication';
