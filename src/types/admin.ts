import type { Timestamp } from 'firebase-admin/firestore';
import type { UserRole } from '@/types/user';

// ---------------------------------------------------------------------------
// Site Settings
// ---------------------------------------------------------------------------

export interface MaintenanceMode {
  /** Public landing page (/) */
  public: boolean;
  /** Applicant portal (/applicant/*) */
  applicants: boolean;
  /** Lender portal (/lender/*) */
  lenders: boolean;
}

export interface SiteSettings {
  maintenanceMode: MaintenanceMode;
  maintenanceMessage: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  maintenanceMode: {
    public: false,
    applicants: false,
    lenders: false,
  },
  maintenanceMessage: 'TerePay is undergoing scheduled maintenance. We will be back shortly.',
};

// ---------------------------------------------------------------------------
// Admin Config (encrypted API keys / integration credentials)
// ---------------------------------------------------------------------------

export interface AdminConfig {
  /** Resend API key — 🔒 Encrypted */
  resendApiKey: string;
  /** Twilio Account SID — 🔒 Encrypted */
  twilioAccountSid: string;
  /** Twilio Auth Token — 🔒 Encrypted */
  twilioAuthToken: string;
  /** Twilio Verify Service SID — 🔒 Encrypted */
  twilioVerifyServiceSid: string;
  /** Google Drive KYC folder ID — 🔒 Encrypted */
  googleDriveKycFolderId: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

/** Safe view — values masked for UI display, never expose raw ciphertext or plaintext keys */
export interface AdminConfigMasked {
  resendApiKey: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioVerifyServiceSid: string;
  googleDriveKycFolderId: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export type AdminConfigKey = keyof Omit<AdminConfig, 'updatedAt' | 'updatedBy'>;

export const ADMIN_CONFIG_KEYS: { key: AdminConfigKey; label: string; envVar: string }[] = [
  { key: 'resendApiKey', label: 'Resend API Key', envVar: 'RESEND_API_KEY' },
  { key: 'twilioAccountSid', label: 'Twilio Account SID', envVar: 'TWILIO_ACCOUNT_SID' },
  { key: 'twilioAuthToken', label: 'Twilio Auth Token', envVar: 'TWILIO_AUTH_TOKEN' },
  { key: 'twilioVerifyServiceSid', label: 'Twilio Verify Service SID', envVar: 'TWILIO_VERIFY_SERVICE_SID' },
  { key: 'googleDriveKycFolderId', label: 'Google Drive KYC Folder ID', envVar: 'GOOGLE_DRIVE_KYC_FOLDER_ID' },
];

// ---------------------------------------------------------------------------
// Email Templates
// ---------------------------------------------------------------------------

export type EmailTemplateType =
  | 'email_verification'
  | 'onboarding_followup'
  | 'welcome_sequence'
  | 'loan_submitted'
  | 'loan_under_review'
  | 'loan_approved'
  | 'loan_declined'
  | 'loan_disbursed'
  | 'payment_reminder'
  | 'payment_received';

export type EmailTemplateCategory = 'account' | 'onboarding' | 'welcome' | 'loan_events' | 'payments';

export const EMAIL_TEMPLATE_TYPE_LABELS: Record<EmailTemplateType, string> = {
  email_verification: 'Email Verification',
  onboarding_followup: 'Onboarding Follow-up',
  welcome_sequence: 'Welcome Sequence',
  loan_submitted: 'Loan Submitted',
  loan_under_review: 'Loan Under Review',
  loan_approved: 'Loan Approved',
  loan_declined: 'Loan Declined',
  loan_disbursed: 'Loan Disbursed',
  payment_reminder: 'Payment Reminder',
  payment_received: 'Payment Received',
};

export const EMAIL_TEMPLATE_CATEGORY_LABELS: Record<EmailTemplateCategory, string> = {
  account: 'Account & Security',
  onboarding: 'Onboarding Sequence',
  welcome: 'Welcome Sequence',
  loan_events: 'Loan Events',
  payments: 'Payments',
};

export const EMAIL_TEMPLATE_TYPE_CATEGORY: Record<EmailTemplateType, EmailTemplateCategory> = {
  email_verification: 'account',
  onboarding_followup: 'onboarding',
  welcome_sequence: 'welcome',
  loan_submitted: 'loan_events',
  loan_under_review: 'loan_events',
  loan_approved: 'loan_events',
  loan_declined: 'loan_events',
  loan_disbursed: 'loan_events',
  payment_reminder: 'payments',
  payment_received: 'payments',
};

export interface EmailTemplate {
  id: string;
  name: string;
  type: EmailTemplateType;
  category: EmailTemplateCategory;
  subject: string;
  htmlBody: string;
  textBody: string;
  /** For sequences: order within the sequence (1-based) */
  sequenceOrder?: number;
  /** For sequences: days after trigger to send */
  delayDays?: number;
  /** Variables available for substitution, e.g. ["firstName", "loanAmount"] */
  availableVariables: string[];
  isActive: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy: string;
}

// ---------------------------------------------------------------------------
// Lender user (for admin user management)
// ---------------------------------------------------------------------------

export interface AdminLenderView {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  /** Primary role. */
  role: UserRole;
  /** Full set of roles held (always includes `role`). */
  roles: UserRole[];
  status: 'active' | 'suspended' | 'inactive';
  profileComplete: boolean;
  createdAt?: Timestamp;
  lastLoginAt?: Timestamp;
}

// ---------------------------------------------------------------------------
// Payment Refresh Schedule
// ---------------------------------------------------------------------------

/**
 * Controls the daily background sweep that re-checks every active-consent
 * loan's scheduled payments against Qippay. The Vercel cron fires hourly; the
 * handler only runs the sweep when the current Pacific/Auckland hour matches
 * `refreshHourNzt` (and it hasn't already run for that NZT date).
 */
export interface PaymentRefreshSettings {
  /** Master switch for the daily sweep. */
  enabled: boolean;
  /** Hour (0-23) in Pacific/Auckland time to run the sweep. 0 = midnight. */
  refreshHourNzt: number;
  /** NZT date (YYYY-MM-DD) the sweep last completed - used to dedupe. */
  lastRunDateNzt?: string;
  lastRunAt?: Timestamp;
  /** Number of applications reconciled on the last run. */
  lastRunCount?: number;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export const DEFAULT_PAYMENT_REFRESH_SETTINGS: PaymentRefreshSettings = {
  enabled: true,
  refreshHourNzt: 0, // midnight NZT
};
