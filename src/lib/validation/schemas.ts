import { z } from 'zod';

// ---------------------------------------------------------------------------
// Auth schemas
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  // role is hardcoded to 'applicant' server-side; not accepted from client
});

export const sessionSchema = z.object({
  idToken: z.string().min(1, 'ID token is required'),
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

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type SessionInput = z.infer<typeof sessionSchema>;
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
export type ApproveApplicationInput = z.infer<typeof approveApplicationSchema>;
export type RejectApplicationInput = z.infer<typeof rejectApplicationSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
