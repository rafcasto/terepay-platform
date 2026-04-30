import { z } from 'zod';

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

export const approveApplicationSchema = z.object({
  approvedAmount: z.number().min(100),
  approvedRate: z.number().min(0).max(100),
  approvedTerm: z.number().min(1).max(60),
  comments: z.string().max(1000).optional(),
  conditions: z.array(z.string()).optional(),
});

export const rejectApplicationSchema = z.object({
  comments: z.string().min(10, 'Please provide a reason for rejection').max(1000),
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
  householdType: z.string().max(50).optional(),
  numberOfChildren: z.number().int().min(0).optional(),
  numberOfDependents: z.number().int().min(0).optional(),
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
export type ApproveApplicationInput = z.infer<typeof approveApplicationSchema>;
export type RejectApplicationInput = z.infer<typeof rejectApplicationSchema>;

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
    income: z.object({
      salaryBeforeTax: currencyField,
      salaryAfterTax: currencyField,
      winz: currencyField,
      otherIncome: currencyField,
      otherIncomeDescription: z.string().optional(),
    }),
  }),

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
      .min(100, 'Minimum loan amount is $100')
      .max(50000, 'Maximum loan amount is $50,000'),
    purpose: z.string().min(1, 'Please select a purpose'),
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
    paymentMethod: z.enum(['direct_debit', 'bank_transfer'], { message: 'Select a payment method' }),
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
  requiredDocuments: z.array(z.string().min(1)).min(1, 'Specify at least one document'),
  message: z.string().max(500).optional(),
});

export const reviewDocumentSchema = z.object({
  action: z.enum(['accept', 'reject']),
  rejectionReason: z.string().max(500).optional(),
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
  centrixAmount: z.number().min(0),
  verifiedAmount: z.number().min(0),
  adjustment: z.number(),
  adjustmentReason: z.string().optional(),
  finalAmount: z.number().min(0).optional(),
});

const expenseRowSchema = z.object({
  category: z.string(),
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
});

export const lenderDecisionSchema = z.object({
  action: z.enum(['approve', 'decline']),
  rationale: z.string().min(10, 'Rationale must be at least 10 characters'),
  declineReasons: z.array(z.string()).optional(),
  approvedAmount: z.number().min(200).max(2000).optional(),
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
export type AffordabilityAssessmentInput = z.infer<typeof affordabilityAssessmentSchema>;
export type LenderDecisionInput = z.infer<typeof lenderDecisionSchema>;
export type BenchmarkEntryInput = z.infer<typeof benchmarkEntrySchema>;
