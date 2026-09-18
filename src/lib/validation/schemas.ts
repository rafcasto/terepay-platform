import { z } from 'zod';
import { LOAN_PURPOSE_VALUES } from '@/lib/constants/loan-purposes';

// ---------------------------------------------------------------------------
// Auth schemas
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const signupSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  // role is hardcoded to 'applicant' server-side; not accepted from client
  phone: z.string().min(7, 'Phone number is required').max(30).optional(),
  // Firebase ID token from signInWithEmailLink — proves email ownership
  idToken: z.string().min(1, 'Firebase ID token is required'),
  recaptchaToken: z.string().min(1).optional(),
});

export const sendOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  recaptchaToken: z.string().min(1).optional(),
});

export const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d{6}$/, 'Code must be numeric'),
});

export const sessionSchema = z.object({
  idToken: z.string().min(1, 'ID token is required'),
  recaptchaToken: z.string().min(1).optional(),
});

// ---------------------------------------------------------------------------
// Application schemas
// ---------------------------------------------------------------------------

export const createApplicationSchema = z.object({
  loanDetails: z.object({
    requestedAmount: z.number().min(100).max(50000),
    loanPurpose: z.enum(['personal', 'business', 'auto', 'home_improvement', 'consolidation', 'other']),
    purposeDescription: z.string().min(10, 'Please describe the loan purpose').max(500),
    requestedTerm: z.number().min(3).max(60).optional(),
    requestedRate: z.number().min(0).max(100).optional(),
  }),
  financialInformation: z.object({
    monthlyIncome: z.number().min(0),
    incomeSource: z.string().min(1),
    employmentType: z.string().min(1),
    monthlyExpenses: z.number().min(0),
    currentDebts: z.number().min(0),
    existingLoans: z.number().min(0).int(),
    savingsBalance: z.number().min(0),
    assets: z.object({
      homeValue: z.number().min(0).optional(),
      vehicleValue: z.number().min(0).optional(),
      investmentValue: z.number().min(0).optional(),
    }).optional(),
  }),
});

export const updateApplicationSchema = z.object({
  status: z
    .enum(['draft', 'submitted', 'under_review', 'approved', 'rejected', 'funded', 'completed'])
    .optional(),
  loanDetails: createApplicationSchema.shape.loanDetails.partial().optional(),
  financialInformation: createApplicationSchema.shape.financialInformation.partial().optional(),
});

// ---------------------------------------------------------------------------
// User profile schemas
// ---------------------------------------------------------------------------

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  profilePhotoUrl: z.string().url().optional(),
  phoneNumber: z.string().max(30).optional(),
  address: z.object({
    street: z.string().max(200).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    zipCode: z.string().max(20).optional(),
    country: z.string().max(100).optional(),
  }).optional(),
});

/**
 * Unified schema for PATCH /api/users/profile.
 * Handles both the profile-settings page (legacy fields) and the
 * loan-application Step 1 profile save (flat address fields).
 */
export const patchProfileSchema = z.object({
  // User document fields
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  profilePhotoUrl: z.string().url().optional(),
  // Applicant profile fields — flat address from loan form
  phone: z.string().max(30).optional(),
  phoneNumber: z.string().max(30).optional(), // kept for profile settings page
  dateOfBirth: z.string().optional(),
  address: z.union([z.string().max(200), z.object({
    street: z.string().max(200).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    zipCode: z.string().max(20).optional(),
    country: z.string().max(100).optional(),
  })]).optional(),
  suburb: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  postCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  housingStatus: z.string().max(50).optional(),
  timeAtAddress: z.string().max(50).optional(),
  visaStatus: z.string().max(50).optional(),
  visaExpiryDate: z.string().optional(),
  anniversaryDate: z.string().optional(),
  householdType: z.string().max(50).optional(),
  numberOfChildren: z.number().int().min(0).optional(),
  numberOfDependents: z.number().int().min(0).optional(),
  // Employment fields (mirrored from the loan application, editable on the profile page)
  occupation: z.string().max(120).optional(),
  employerName: z.string().max(120).optional(),
  employmentStatus: z.string().max(50).optional(),
});

export type PatchProfileInput = z.infer<typeof patchProfileSchema>;

export const updateEmailSchema = z.object({
  newEmail: z.string().email('Invalid email address'),
});

export type UpdateEmailInput = z.infer<typeof updateEmailSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type SessionInput = z.infer<typeof sessionSchema>;
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;

// ---------------------------------------------------------------------------
// KYC schemas
// ---------------------------------------------------------------------------

export const sendSmsOtpSchema = z.object({
  phone: z
    .string()
    .min(7, 'Phone number is required')
    .max(15)
    .regex(/^[0-9\s\-()]+$/, 'Invalid phone number'),
});

export const verifySmsOtpSchema = z.object({
  phone: z.string().min(7).max(15),
  code: z.string().length(6, 'Code must be 6 digits').regex(/^\d{6}$/, 'Code must be numeric'),
});

export const kycProfileSchema = z.object({
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  immigrationStatus: z.enum(['student', 'work_visa', 'resident', 'permanent_resident', 'citizen'], {
    message: 'Immigration status is required',
  }),
  visaExpiryDate: z.string().optional(),
  housingStatus: z.enum(['rent', 'own', 'flatmates'], {
    message: 'Housing status is required',
  }),
  timeAtAddress: z.enum(['lt_6mo', '6_12mo', '1_2yr', '2_5yr', 'gt_5yr'], {
    message: 'Please select how long you have lived at this address',
  }),
  address: z.string().min(1, 'Address is required').max(200),
  suburb: z.string().max(100).optional(),
  city: z.string().min(1, 'City is required').max(100),
  postCode: z.string().min(1, 'Post code is required').max(20),
  country: z.string().max(100).optional(),
});

export const kycDocumentSchema = z.object({
  documents: z.array(z.object({
    docType: z.string().min(1),
    driveFileId: z.string().min(1),
    fileName: z.string().min(1),
    mimeType: z.string().min(1),
  })).min(1, 'At least one document is required'),
});

export type SendSmsOtpInput = z.infer<typeof sendSmsOtpSchema>;
export type VerifySmsOtpInput = z.infer<typeof verifySmsOtpSchema>;
export type KycProfileInput = z.infer<typeof kycProfileSchema>;
export type KycDocumentInput = z.infer<typeof kycDocumentSchema>;

// ---------------------------------------------------------------------------
// TerePay 8-section loan application schema (NZD, 8-week term)
// ---------------------------------------------------------------------------

const currencyField = z.number({ message: 'Enter a valid amount' }).min(0).default(0);

export const terepayApplicationSchema = z.object({
  // ── Section 1: Personal Information ────────────────────────────────────
  personalInfo: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    dateOfBirth: z.string().min(1, 'Date of birth is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(1, 'Mobile phone is required'),
    address: z.string().min(1, 'Address is required'),
    suburb: z.string().optional(),
    city: z.string().min(1, 'City is required'),
    postCode: z.string().min(1, 'Post code is required'),
    timeAtAddress: z.string().min(1, 'Required'),
    housingStatus: z.enum(['rent', 'own', 'flatmates', 'other'], { message: 'Select a housing status' }),
    visaStatus: z.enum(['work_visa', 'resident_visa', 'student_visa', 'citizen', 'other'], { message: 'Select a visa status' }),
    visaExpiryDate: z.string().optional(),
    householdType: z.enum(['single', 'single_children', 'couple', 'couple_children'], { message: 'Select a household type' }),
    numberOfChildren: z.number({ message: 'Enter a number' }).min(0).int().default(0),
    numberOfDependents: z.number({ message: 'Enter a number' }).min(0).int().default(0),
  }),

  // ── Section 2: Employment & Income ─────────────────────────────────────
  employment: z.object({
    employerName: z.string().min(1, 'Employer name is required'),
    employerAddress: z.string().min(1, 'Employer address is required'),
    occupation: z.string().min(1, 'Occupation is required'),
    hoursPerWeek: z.number({ message: 'Enter hours per week' }).min(1).max(168),
    employmentStatus: z.enum(['permanent', 'fixed_term', 'casual', 'part_time'], { message: 'Select an employment status' }),
    timeAtEmployer: z.string().min(1, 'Required'),
    previousEmployer: z.string().optional(),
    previousEmployerPeriod: z.string().optional(),
    income: z.object({
      salaryBeforeTax: currencyField,
      salaryAfterTax: currencyField,
      winz: currencyField,
      otherIncome: currencyField,
      otherIncomeDescription: z.string().optional(),
    }),
  })
    .refine(
      (val) => val.timeAtEmployer !== 'Less than 6 months' || !!val.previousEmployer?.trim(),
      { path: ['previousEmployer'], message: 'Add your previous employer' },
    )
    .refine(
      (val) => val.timeAtEmployer !== 'Less than 6 months' || !!val.previousEmployerPeriod?.trim(),
      { path: ['previousEmployerPeriod'], message: 'Select how long you were there' },
    ),

  // ── Section 3: Living Expenses ──────────────────────────────────────────
  livingExpenses: z.object({
    nonDiscretionary: z.object({
      food: currencyField,
      utilities: currencyField,
      personalExpenses: currencyField,
      transport: currencyField,
      medical: currencyField,
      childcare: currencyField,
      accommodation: currencyField,
      healthInsurance: currencyField,
      carInsurance: currencyField,
      rates: currencyField,
      education: currencyField,
      childSupport: currencyField,
      remittances: currencyField,
    }),
    discretionary: z.object({
      restaurants: currencyField,
      entertainment: currencyField,
      travel: currencyField,
      subscriptions: currencyField,
      homeImprovement: currencyField,
      cashWithdrawals: currencyField,
      other: currencyField,
    }),
    subscriptionDetails: z.object({
      gym: z.object({ amount: currencyField, frequency: z.string().default('N/A') }),
      netflix: z.object({ amount: currencyField, frequency: z.string().default('N/A') }),
      spotify: z.object({ amount: currencyField, frequency: z.string().default('N/A') }),
      sports: z.object({ amount: currencyField, frequency: z.string().default('N/A') }),
      others: z.object({ amount: currencyField, frequency: z.string().default('N/A') }),
    }),
    bnpl: z.object({
      afterpay: currencyField,
      klarna: currencyField,
      zip: currencyField,
    }),
  }),

  // ── Section 4: Existing Debts & Financial Commitments ──────────────────
  existingDebts: z.object({
    mortgage: z.object({ totalOwed: currencyField, fortnightlyPayment: currencyField }),
    personalLoans: z.object({ totalOwed: currencyField, fortnightlyPayment: currencyField }),
    carLoans: z.object({ totalOwed: currencyField, fortnightlyPayment: currencyField }),
    creditCard: z.object({ totalOwed: currencyField, fortnightlyPayment: currencyField }),
    bankOverdrafts: z.object({ totalOwed: currencyField, fortnightlyPayment: currencyField }),
    otherLoans: z.array(
      z.object({
        description: z.string().optional(),
        totalOwed: currencyField,
        fortnightlyPayment: currencyField,
      }),
    ).default([
      { totalOwed: 0, fortnightlyPayment: 0 },
      { totalOwed: 0, fortnightlyPayment: 0 },
      { totalOwed: 0, fortnightlyPayment: 0 },
    ]),
    debtPurposeDescription: z.string().optional(),
  }),

  // ── Section 5: Loan Request ─────────────────────────────────────────────
  loanRequest: z.object({
    requestedAmount: z
      .number({ message: 'Enter an amount' })
      .min(200, 'Minimum loan amount is $200')
      .max(2000, 'Maximum loan amount is $2,000'),
    purpose: z.enum(LOAN_PURPOSE_VALUES, { message: 'Please select a purpose' }),
    purposeDescription: z.string().min(10, 'Please provide at least 10 characters').max(1000),
    primaryIncomeSource: z.string().min(1, 'Required'),
    isPEP: z.boolean().default(false),
    pepDetails: z.string().optional(),
    remittance: z.object({
      frequency: z.enum(['weekly', 'fortnightly', 'monthly', 'occasionally', 'never']),
      averageAmount: currencyField,
      purposes: z.array(z.string()).default([]),
    }),
  }),

  // ── Section 6: Bank Account & Repayment ────────────────────────────────
  bankDetails: z.object({
    bankName: z.string().min(1, 'Bank name is required'),
    accountHolderName: z.string().min(1, 'Account holder name is required'),
    accountNumber: z.string().min(1, 'Account number is required'),
    paymentMethod: z.enum(['direct_debit', 'bank_transfer']).optional(),
  }),

  // ── Section 7: References (optional) ───────────────────────────────────
  references: z.object({
    reference1: z
      .object({
        name: z.string().optional(),
        email: z.union([z.string().email('Invalid email'), z.literal('')]).optional(),
        phone: z.string().optional(),
      })
      .optional(),
    reference2: z
      .object({
        name: z.string().optional(),
        email: z.union([z.string().email('Invalid email'), z.literal('')]).optional(),
        phone: z.string().optional(),
      })
      .optional(),
  }),

  // ── Section 8: Declarations & Consent ──────────────────────────────────
  declarations: z.object({
    infoAccurate: z.boolean().refine((v) => v === true, { message: 'Required' }),
    understandsVerification: z.boolean().refine((v) => v === true, { message: 'Required' }),
    authorisesContacts: z.boolean().refine((v) => v === true, { message: 'Required' }),
    understandsTerms: z.boolean().refine((v) => v === true, { message: 'Required' }),
    canAffordRepayments: z.boolean().refine((v) => v === true, { message: 'Required' }),
    receivedDisclosure: z.boolean().refine((v) => v === true, { message: 'Required' }),
    understandsConsequences: z.boolean().refine((v) => v === true, { message: 'Required' }),
    privacyPolicy: z.boolean().refine((v) => v === true, { message: 'Required' }),
    creditReporting: z.boolean().refine((v) => v === true, { message: 'Required' }),
  }),
});

export type TerepayApplicationInput = z.infer<typeof terepayApplicationSchema>;

// Schema for incremental draft step saves — all sections optional, no full validation required
export const draftApplicationSchema = z.object({
  personalInfo: terepayApplicationSchema.shape.personalInfo.optional(),
  employment: terepayApplicationSchema.shape.employment.optional(),
  livingExpenses: terepayApplicationSchema.shape.livingExpenses.optional(),
  existingDebts: terepayApplicationSchema.shape.existingDebts.optional(),
  loanRequest: terepayApplicationSchema.shape.loanRequest.optional(),
  bankDetails: terepayApplicationSchema.shape.bankDetails.optional(),
  references: terepayApplicationSchema.shape.references.optional(),
  lastCompletedStep: z.number().int().min(0).max(7).optional(),
});
export type DraftApplicationInput = z.infer<typeof draftApplicationSchema>;

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ---------------------------------------------------------------------------
// LMS-specific schemas
// ---------------------------------------------------------------------------

export const claimApplicationSchema = z.object({
  // No body needed — lender identity comes from session
});

export const addNoteSchema = z.object({
  text: z.string().min(1, 'Note cannot be empty').max(2000),
});

export const requestDocumentsSchema = z.object({
  /** Catalogue keys, or `{ key: 'other', label }` for a custom ask. */
  items: z
    .array(
      z.object({
        key: z.string().min(1).max(60),
        label: z.string().min(1).max(120).optional(),
      }),
    )
    .min(1, 'Select at least one document')
    .max(12),
  message: z.string().max(500).optional(),
});

export const reviewDocumentSchema = z.object({
  action: z.enum(['accept', 'reject']),
  rejectionReason: z.string().max(500).optional(),
});

export const reviewKycDocumentSchema = z.object({
  action: z.enum(['accept', 'reject']),
  rejectionReason: z.string().max(500).optional(),
});

export const logCommunicationSchema = z.object({
  channel: z.enum(['call', 'message', 'email']),
  direction: z.enum(['inbound', 'outbound']),
  summary: z.string().min(3, 'Add a short summary').max(1000),
  outcome: z.string().max(500).optional(),
  /** ISO datetime of when the contact happened. Defaults to now on the server. */
  occurredAt: z.string().datetime({ offset: true }).optional(),
});

export const affordabilityChecklistSchema = z.object({
  centrixReportObtained: z.boolean(),
  centrixReportNumber: z.string().optional(),
  firstTransactionVerified: z.boolean(),
  firstTransactionDate: z.string().min(1, 'First transaction date is required'),
  payslipsReceived: z.boolean(),
  creditReportObtained: z.boolean(),
  employmentVerified: z.boolean(),
  employmentVerificationMethod: z.string().optional(),
  visaConfirmed: z.boolean(),
  visaExpiryDate: z.string().optional(),
  daysOfTransactionData: z.number().int().min(0).optional(),
});

const incomeRowSchema = z.object({
  category: z.string(),
  declaredAmount: z.number().min(0).optional(),
  centrixAmount: z.number().min(0),
  verifiedAmount: z.number().min(0),
  adjustment: z.number(),
  adjustmentReason: z.string().optional(),
  finalAmount: z.number().min(0).optional(),
});

const expenseRowSchema = z.object({
  category: z.string(),
  declaredAmount: z.number().min(0).optional(),
  centrixAmount: z.number().min(0),
  benchmarkAmount: z.number().min(0),
  adjustment: z.number(),
  adjustmentReason: z.string().optional(),
  finalAmount: z.number().min(0).optional(),
  benchmarkOverrideAcknowledged: z.boolean().optional(),
});

export const affordabilityAssessmentSchema = z.object({
  checklist: affordabilityChecklistSchema,
  incomeRows: z.array(incomeRowSchema).check(z.minLength(1)),
  expenseRows: z.array(expenseRowSchema).check(z.minLength(1)),
  householdMultiplier: z.number().min(1),
  catalogVersionId: z.string(),
  redFlagsAcknowledged: z.record(z.string(), z.string()).optional().default({}),
  recommendation: z.enum(['proceed', 'decline']),
  assessedAmount: z.number().min(200).max(2000).optional(),
  /** Completed AI credit assessment job to attach to this assessment (see creditAssessmentRequestSchema). */
  creditAssessmentId: z.string().regex(/^[0-9]{14}-[0-9a-f]{8}$/, 'Invalid assessment id').optional(),
});

/**
 * Inputs the wizard sends when the lender runs the AI credit assessment from
 * the Results & Decision step. Deliberately loose — the server assembles the
 * full agent payload and reports every missing input in one MISSING_INPUTS
 * error rather than a field-by-field Zod failure.
 */
export const creditAssessmentRequestSchema = z.object({
  assessedAmount: z.number().optional(),
  incomeRows: z.array(incomeRowSchema),
  expenseRows: z.array(expenseRowSchema),
  householdMultiplier: z.number().min(1),
  checklist: z.object({
    firstTransactionDate: z.string().optional(),
    daysOfTransactionData: z.number().int().min(0).optional(),
  }),
});

export const lenderDecisionSchema = z.object({
  action: z.enum(['approve', 'decline']),
  rationale: z.string().min(10, 'Rationale must be at least 10 characters'),
  declineReasons: z.array(z.string()).optional(),
  approvedAmount: z.number().min(200).max(2000).optional(),
});

export const disburseSchema = z.object({
  disbursedAmount: z.number().positive().optional(),
});

export const benchmarkEntrySchema = z.object({
  categoryName: z.string().min(1, 'Category name is required'),
  householdType: z.string().min(1, 'Household type is required'),
  fortnightlyAmount: z.number().min(0),
  rangeLow: z.number().min(0),
  rangeHigh: z.number().min(0),
  source: z.string().min(1, 'Source is required'),
  effectiveFrom: z.string().min(1, 'Effective from date is required'),
  effectiveTo: z.string().optional(),
  changeReason: z.string().optional(),
});

export type ClaimApplicationInput = z.infer<typeof claimApplicationSchema>;
export type AddNoteInput = z.infer<typeof addNoteSchema>;
export type RequestDocumentsInput = z.infer<typeof requestDocumentsSchema>;
export type ReviewDocumentInput = z.infer<typeof reviewDocumentSchema>;
export type ReviewKycDocumentInput = z.infer<typeof reviewKycDocumentSchema>;
export type LogCommunicationInput = z.infer<typeof logCommunicationSchema>;
export type AffordabilityAssessmentInput = z.infer<typeof affordabilityAssessmentSchema>;
export type CreditAssessmentRequestInput = z.infer<typeof creditAssessmentRequestSchema>;
export type LenderDecisionInput = z.infer<typeof lenderDecisionSchema>;
export type BenchmarkEntryInput = z.infer<typeof benchmarkEntrySchema>;

// ---------------------------------------------------------------------------
// Admin schemas
// ---------------------------------------------------------------------------

export const adminCreateLenderSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  // Staff roles to grant. Defaults to lender for backward compatibility.
  roles: z.array(z.enum(['lender', 'content_editor'])).min(1).max(2).default(['lender']),
});

export const adminUpdateLenderSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  status: z.enum(['active', 'suspended', 'inactive']).optional(),
  roles: z.array(z.enum(['lender', 'content_editor'])).min(1).max(2).optional(),
  /** Per-user grant for the Model Training console (lenders only; admins always have it). */
  trainingAccess: z.boolean().optional(),
});

export const adminUpdateUserRolesSchema = z.object({
  // Assignable staff roles. Admin can grant any combination of these.
  roles: z
    .array(z.enum(['lender', 'content_editor']))
    .min(1, 'A staff user must keep at least one role')
    .max(2),
});

export const adminSiteSettingsSchema = z.object({
  maintenanceMode: z.object({
    public: z.boolean(),
    applicants: z.boolean(),
    lenders: z.boolean(),
  }).optional(),
  maintenanceMessage: z.string().max(500).optional(),
});

export const adminConfigSchema = z.object({
  resendApiKey: z.string().optional(),
  twilioAccountSid: z.string().optional(),
  twilioAuthToken: z.string().optional(),
  twilioVerifyServiceSid: z.string().optional(),
  googleDriveKycFolderId: z.string().optional(),
});

export const adminReassignApplicationsSchema = z.object({
  applicationIds: z.array(z.string().min(1)).min(1, 'Select at least one application'),
  targetLenderId: z.string().min(1, 'Target lender is required'),
});

export const adminEmailTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100),
  type: z.enum([
    'email_verification',
    'onboarding_followup',
    'welcome_sequence',
    'loan_submitted',
    'loan_under_review',
    'loan_approved',
    'loan_declined',
    'loan_disbursed',
    'payment_reminder',
    'payment_received',
  ]),
  subject: z.string().min(1, 'Subject is required').max(200),
  htmlBody: z.string().min(1, 'HTML body is required'),
  textBody: z.string().min(1, 'Text body is required'),
  sequenceOrder: z.number().int().min(1).optional(),
  delayDays: z.number().int().min(0).optional(),
  availableVariables: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export const adminEmailTemplatePatchSchema = adminEmailTemplateSchema.partial();

export type AdminCreateLenderInput = z.infer<typeof adminCreateLenderSchema>;
export type AdminUpdateLenderInput = z.infer<typeof adminUpdateLenderSchema>;
export type AdminUpdateUserRolesInput = z.infer<typeof adminUpdateUserRolesSchema>;
export type AdminSiteSettingsInput = z.infer<typeof adminSiteSettingsSchema>;
export type AdminConfigInput = z.infer<typeof adminConfigSchema>;
export type AdminReassignApplicationsInput = z.infer<typeof adminReassignApplicationsSchema>;
export type AdminEmailTemplateInput = z.infer<typeof adminEmailTemplateSchema>;
export type AdminEmailTemplatePatchInput = z.infer<typeof adminEmailTemplatePatchSchema>;

export const adminPaymentRefreshSchema = z.object({
  enabled: z.boolean().optional(),
  refreshHourNzt: z.number().int().min(0).max(23).optional(),
});

export type AdminPaymentRefreshInput = z.infer<typeof adminPaymentRefreshSchema>;

// ---------------------------------------------------------------------------
// Admin — model training jobs (queued to the Pi worker via Upstash Redis)
// ---------------------------------------------------------------------------

const driveIdSchema = z.string().regex(/^[A-Za-z0-9_-]{10,}$/, 'Invalid Google Drive ID');

export const adminTrainingJobSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('import_batch'), driveId: driveIdSchema, replace: z.boolean().default(true) }),
  z.object({ type: z.literal('import_outcomes'), driveId: driveIdSchema }),
  z.object({ type: z.literal('backtest') }),
  z.object({ type: z.literal('build_dataset') }),
  z.object({
    type: z.literal('finetune'),
    outName: z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/, 'Lowercase letters, digits and dashes').optional(),
  }),
  z.object({
    type: z.literal('exam'),
    model: z.string().min(1).max(80),
    n: z.number().int().min(1).max(200).default(12),
  }),
  z.object({
    type: z.literal('regenerate_synthetic'),
    n: z.number().int().min(10).max(2000).default(200),
    seed: z.number().int().min(0).max(1_000_000).default(11),
  }),
]);

export type AdminTrainingJobInput = z.infer<typeof adminTrainingJobSchema>;

// ---------------------------------------------------------------------------
// Training console — cases uploaded from the site + worker request/reply
// ---------------------------------------------------------------------------

const trainingIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/, 'Lowercase letters, digits and dashes');
const trainingCaseIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/, 'Invalid case id');
const money = z.number().min(0).max(10_000_000).nullable().optional();
const triBool = z.boolean().nullable().optional();

export const trainingCaseApplicationSchema = z.object({
  applicationId: trainingIdSchema,
  application: z.object({
    applicant_name: z.string().max(80).optional(),
    application_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).optional(),
    loan_amount: money,
    interest_rate: z.number().min(0).max(100).nullable().optional(),
    income: money,
    expenses: money,
    existing_debt: money,
    loan_purpose: z.string().max(200).optional(),
    decision_made: z.enum(['', 'approved', 'conditional', 'declined']).optional(),
    decision_by: z.string().max(40).optional(),
    outcome: z.enum(['unknown', 'repaid', 'repaid_late', 'arrears', 'default', 'written_off', 'current', 'declined']).optional(),
    max_days_late: z.number().int().min(0).max(5000).nullable().optional(),
    outcome_notes: z.string().max(1000).optional(),
    behaviour_paid_previous_loan_early: triBool,
    behaviour_paid_on_time_consistently: triBool,
    behaviour_communicates_proactively: triBool,
    behaviour_missed_payments_before: triBool,
    behaviour_existing_defaults: triBool,
    behaviour_write_off_history: triBool,
    behaviour_requests_bigger_loan_too_fast: triBool,
    behaviour_provides_multiple_excuses: triBool,
    behaviour_avoids_communication: triBool,
  }),
});
export type TrainingCaseApplicationInput = z.infer<typeof trainingCaseApplicationSchema>;

const trainingLabelSchema = z.object({
  judgements: z.record(z.string().regex(/^[a-z_]{3,60}$/), z.boolean()).default({}),
  behaviour: z.array(z.string().max(60)).max(20).default([]),
  analyst_note: z.string().max(2000).default(''),
  confidence: z.number().min(0).max(100).default(70),
  data_gaps: z.array(z.string().max(200)).max(20).default([]),
  officer: z.string().max(80).default(''),
});

export const trainingRpcSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('ping') }),
  z.object({ op: z.literal('cases.list') }),
  z.object({ op: z.literal('cases.get'), id: trainingCaseIdSchema }),
  z.object({ op: z.literal('cases.label'), id: trainingCaseIdSchema, label: trainingLabelSchema }),
  z.object({ op: z.literal('cases.reanalyse'), id: trainingCaseIdSchema, application: trainingCaseApplicationSchema.shape.application }),
  z.object({ op: z.literal('cases.delete'), id: trainingCaseIdSchema }),
  z.object({ op: z.literal('backtest.get') }),
  z.object({ op: z.literal('gold.list'), profile: z.string().max(60).optional(), status: z.enum(['unreviewed', 'approved', 'edited', 'rejected']).optional() }),
  z.object({ op: z.literal('gold.get'), id: trainingCaseIdSchema }),
  z.object({
    op: z.literal('gold.review'),
    id: trainingCaseIdSchema,
    review: z.object({
      status: z.enum(['approved', 'edited', 'rejected']),
      judgements: z.record(z.string().regex(/^[a-z_]{3,60}$/), z.boolean()).optional(),
      behaviour: z.array(z.string().max(60)).max(20).optional(),
      analyst_note: z.string().max(2000).optional(),
      officer: z.string().max(80).optional(),
    }),
  }),
  z.object({ op: z.literal('dataset.get') }),
  z.object({ op: z.literal('exams.list') }),
  z.object({ op: z.literal('exams.get'), file: z.string().regex(/^exam-[A-Za-z0-9._-]+\.json$/) }),
  z.object({ op: z.literal('settings.get') }),
  z.object({
    op: z.literal('settings.set'),
    settings: z.object({
      gpu_mode: z.enum(['ssh', 'local']).optional(),
      ssh_host: z.string().max(200).optional(),
      ssh_user: z.string().max(64).optional(),
      ssh_key: z.string().max(300).optional(),
      remote_dir: z.string().max(200).optional(),
      base_model: z.string().max(200).optional(),
      ollama_name: z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/).optional(),
      epochs: z.number().int().min(1).max(10).optional(),
    }),
  }),
  z.object({ op: z.literal('prompts.list') }),
]);
export type TrainingRpcInput = z.infer<typeof trainingRpcSchema>;

export const adminSetPayTestSchema = z.object({
  enabled: z.boolean().optional(),
  intervalMinutes: z.number().int().min(1).max(1440).optional(),
});

export type AdminSetPayTestInput = z.infer<typeof adminSetPayTestSchema>;
