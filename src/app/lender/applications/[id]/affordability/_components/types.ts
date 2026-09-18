// ─── Shared types & helpers for the Affordability Assessment wizard ──────────

import { calcIncomeFinal, calcExpenseFinal } from '@/lib/loan/affordability-calc';

export interface IncomeRow {
  category: string;
  /** Fortnightly figure the applicant declared on their application (read-only reference). */
  declaredAmount?: number;
  centrixAmount: number;
  verifiedAmount: number;
  adjustment: number;
  adjustmentReason: string;
  finalAmount: number;
}

export interface ExpenseRow {
  category: string;
  /** Fortnightly figure the applicant declared on their application. */
  declaredAmount?: number;
  centrixAmount: number;
  benchmarkAmount: number;
  adjustment: number;
  adjustmentReason: string;
  finalAmount: number;
}

export interface Checklist {
  centrixReportObtained: boolean;
  centrixReportNumber: string;
  firstTransactionVerified: boolean;
  firstTransactionDate: string;
  payslipsReceived: boolean;
  creditReportObtained: boolean;
  employmentVerified: boolean;
  employmentVerificationMethod: string;
  visaConfirmed: boolean;
  visaExpiryDate: string;
}

// ─── Income categories (Excel order) ────────────────────────────────────────

export const INCOME_CATEGORIES = [
  'Salary/Wages',
  'Bonus',
  'Rental Income',
  'Government Benefits',
  'Other Income',
] as const;

// ─── Expense categories ──────────────────────────────────────────────────────

export const NON_DISCRETIONARY_CATEGORIES = [
  'Food & Groceries',
  'Utilities',
  'Personal/Clothing',
  'Transport',
  'Medical',
  'Childcare',
  'Accommodation/Rent',
  'Health Insurance',
  'Car Insurance',
  'Rates',
  'Education',
  'Child Support',
  'Remittances',
] as const;

export const DISCRETIONARY_CATEGORIES = [
  'Restaurants/Takeaways',
  'Entertainment',
  'Travel',
  'Subscriptions',
  'Home Improvement',
  'Cash Withdrawals',
  'Buy Now Pay Later',
  'Existing Debt Repayments',
  'Other',
] as const;

export const EXPENSE_CATEGORIES = [
  ...NON_DISCRETIONARY_CATEGORIES,
  ...DISCRETIONARY_CATEGORIES,
] as const;

/** Display names that differ from the internal category key */
export const EXPENSE_DISPLAY_NAMES: Record<string, string> = {
  'Utilities': 'Utilities (power, water, internet)',
  'Personal/Clothing': 'Personal expenses (clothing, footwear)',
  'Transport': 'Transport (fuel, WoF/rego, maintenance)',
  'Medical': 'Medical (GP, prescriptions)',
  'Childcare': 'Childcare / dependants',
  'Accommodation/Rent': 'Accommodation Costs (Rental Payment)',
};

export const HOUSEHOLD_MULTIPLIERS: Record<string, number> = {
  single: 1.0,
  single_children: 1.5,
  couple: 1.5,
  couple_children: 1.8,
};

// ─── Calculation helpers ─────────────────────────────────────────────────────
// The maths lives in src/lib/loan/affordability-calc.ts and is shared with the
// submit route, so the on-screen surplus and the persisted surplus can't drift.

/** Income final = MIN(centrix, verified) + adjustment. */
export function calcIncomeRow(row: IncomeRow): IncomeRow {
  return { ...row, finalAmount: calcIncomeFinal(row) };
}

/** Expense final = MAX(centrix || declared, benchmark) + adjustment. */
export function calcExpenseRow(row: ExpenseRow): ExpenseRow {
  return { ...row, finalAmount: calcExpenseFinal(row) };
}

// ─── Formatting ──────────────────────────────────────────────────────────────

export const fmt = (n: number) =>
  new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    minimumFractionDigits: 2,
  }).format(n);
