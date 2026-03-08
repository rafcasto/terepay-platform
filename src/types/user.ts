import type { Timestamp } from 'firebase-admin/firestore';

export type UserRole = 'applicant' | 'lender';
export type UserStatus = 'active' | 'suspended' | 'inactive';

export interface User {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  profileComplete: boolean;
  status: UserStatus;
  profilePhotoUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;
  phoneVerified: boolean;
  emailVerified: boolean;
}

export interface ApplicantProfile {
  dateOfBirth: string;        // 🔒 Encrypted (YYYY-MM-DD)
  ssn?: string;               // 🔒 Encrypted (last 4 digits)
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
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
