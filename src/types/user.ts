import type { Timestamp } from 'firebase-admin/firestore';

export type UserRole = 'applicant' | 'lender' | 'admin';
export type UserStatus = 'active' | 'suspended' | 'inactive';
export type KycStatus = 'not_started' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
export type ImmigrationStatus = 'student' | 'work_visa' | 'resident' | 'permanent_resident' | 'citizen';
export type HousingStatus = 'rent' | 'own' | 'flatmates';
export type TimeAtAddress = 'lt_6mo' | '6_12mo' | '1_2yr' | '2_5yr' | 'gt_5yr';

export interface IdentityDocument {
  docType: string;
  driveFileId: string;
  fileName: string;
  mimeType: string;
  uploadedAt: Timestamp;
}

export interface User {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  profileComplete: boolean;
  kycStatus: KycStatus;
  status: UserStatus;
  profilePhotoUrl?: string;
  phoneNumber?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;
  phoneVerified: boolean;
  emailVerified: boolean;
  /** Friendly TerePay customer ID (e.g. TERE001) — set when claiming an offline profile */
  customerId?: string;
  /** Whether this customer has had at least one loan approved. Controls application fee tier. */
  isExistingCustomer?: boolean;
}

export type OfflineCustomerStatus = 'unlinked' | 'linked';

export interface OfflineCustomer {
  /** Document ID and friendly key, e.g. "TERE001" */
  customerId: string;
  firstName: string;
  lastName: string;
  /** Required — used for 3-way ownership verification */
  email: string;
  /** Required — YYYY-MM-DD, used for 3-way ownership verification */
  dateOfBirth: string;
  phone?: string;
  notes?: string;
  createdByLenderId: string;
  createdAt: Timestamp;
  status: OfflineCustomerStatus;
  linkedUid?: string;
  linkedAt?: Timestamp;
  /** Whether this offline customer has had at least one loan approved. Controls application fee tier. */
  isExistingCustomer?: boolean;
  updatedAt?: Timestamp;
}

export interface ApplicantProfile {
  dateOfBirth: string;        // 🔒 Encrypted (YYYY-MM-DD)
  ssn?: string;               // 🔒 Encrypted (last 4 digits)
  phone: string;
  address: string;
  suburb?: string;
  city: string;
  postCode?: string;
  state: string;
  zipCode: string;
  country: string;
  housingStatus?: HousingStatus;
  timeAtAddress?: TimeAtAddress;
  immigrationStatus?: ImmigrationStatus;
  kycDocuments?: IdentityDocument[];
  profileLastUpdatedAt?: Timestamp;
  employmentStatus: 'employed' | 'self-employed' | 'unemployed' | 'retired';
  employerName?: string;
  jobTitle?: string;
  yearsAtCurrentJob?: number;
  annualIncome: string;       // 🔒 Encrypted (number as string)
  creditScore?: string;       // 🔒 Encrypted (number as string)
  creditHistory: {
    accounts: number;
    inquiries: number;
    latePayments: number;
    totalDebt: number;
  };
  identityVerified: boolean;
  incomeVerified: boolean;
  loanPreferences: {
    preferredLoanTerms: number[];
    maxDesiredRate: number;
    notificationPreferences: string[];
  };
}

export interface LenderProfile {
  businessName: string;
  businessEntity: 'sole_proprietor' | 'llc' | 'corporation' | 'partnership';
  einOrTaxId: string;         // 🔒 Encrypted
  businessType: 'traditional_lender' | 'crowdfunding' | 'peer_to_peer' | 'other';
  yearsInBusiness: number;
  annualFundingCapacity: number;
  currentlyAvailable: number;
  verification: {
    isVerified: boolean;
    verificationLevel: 'basic' | 'standard' | 'premium';
    verifiedAt?: Timestamp;
    documentUrls: string[];
    approvedBy?: string;
    approvalDate?: Timestamp;
  };
  metrics: {
    activeLoans: number;
    totalFundsDispersed: number;
    totalLoansCompleted: number;
    averageROI: number;
    defaultRate: number;
    earlyPayoffRate: number;
    averageLoanDuration: number;
  };
  bankingInfo?: {
    bankName: string;
    accountType: 'checking' | 'savings' | 'money_market';
    routingNumber: string;    // 🔒 Encrypted
    accountNumber: string;    // 🔒 Encrypted (last 4)
    verified: boolean;
  };
  lendingPreferences: {
    minCreditScore: number;
    maxDebtToIncome: number;
    preferredLoanTypes: string[];
    geographicFocus?: string[];
    autoApprovalThreshold?: number;
  };
}
