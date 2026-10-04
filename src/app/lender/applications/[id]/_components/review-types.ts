import type {
  CommunicationChannel,
  CommunicationDirection,
  CommunicationSource,
  DocumentStatus,
  ScheduledPayment,
} from '@/types/application';
import type { PillTone } from '@/components/lender/ConsolePill';
import type { ArrearsChargesSummary } from '@/lib/loan/arrears-charges';

export type ReportItem = { id: string; fileName: string; uploadedAt: string; uploadedBy: string };

/** Client-safe view of the lender-entered Centrix credit summary. */
export type CreditSummaryView = {
  /** YYYY-MM-DD, for pre-filling the edit form. */
  reportDate: string;
  reportDateLabel: string;
  score: number;
  defaults: number;
  enquiries: number;
  utilisation?: number;
  updatedBy: string;
  updatedAt: string;
};

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
  /** Label of the request item this upload was made against, if any. */
  requestedAs?: string;
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

/** Client-safe view of `evaluateEvidenceGate()`. */
export type EvidenceGateView = {
  ok: boolean;
  pendingCount: number;
  reasons: string[];
  /** Previous-loan evidence that satisfies this application (returning customer inside the 6-month window). */
  reused: { label: string; fileName: string; fromReference: string; loanDate: string; viewUrl: string }[];
  previousLoanLabel?: string;
  repeatWithinWindow: boolean;
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
  source: CommunicationSource;
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
    name: string;
    email: string;
    phone: string;
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
    /** Per-item fulfilment (empty for requests made before structured items existed). */
    items: {
      key: string;
      label: string;
      fulfilled: boolean;
      needsReupload: boolean;
      files: { id: string; fileName: string; status: DocumentStatus }[];
    }[];
    /** Catalogue keys still unfulfilled — used to pre-tick a re-request. */
    missingKeys: string[];
    message?: string;
    outstanding: boolean;
  };
  affordability: {
    statusLabel: string;
    complete: boolean;
    assessmentCount: number;
    /** Assigned lender, assessable status AND the evidence gate is open. */
    canAssess: boolean;
    pdfUrl: string;
    assessUrl: string;
    /** Evidence gate — documents must be reviewed before the credit assessment can start. */
    gate: EvidenceGateView;
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
  payments: {
    show: boolean;
    scheduled: ScheduledPayment[];
    /** Late fees, default fee and accrued interest charged by the arrears engine. */
    charges: ArrearsChargesSummary;
    /** Outstanding loan balance before arrears charges (NZD). */
    remainingBalance: number;
  };
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
    /** Lender-entered figures from the Centrix report; undefined until entered. */
    summary?: CreditSummaryView;
    /** Debt-to-income from the application's own figures, when available. */
    dti?: string;
  };
  history: ApplicantHistory;
  communications: CommunicationItem[];
};

export type TabKey = 'overview' | 'documents' | 'affordability' | 'kyc' | 'credit' | 'communication';
