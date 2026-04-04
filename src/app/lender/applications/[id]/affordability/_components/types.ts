// ─── Shared types & helpers for the Affordability Assessment wizard ──────────

export interface IncomeRow {
  category: string;
  centrixAmount: number;
  verifiedAmount: number;
  adjustment: number;
  adjustmentReason: string;
  finalAmount: number;
}

export interface ExpenseRow {
  category: string;
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

// ─── Calculation helpers (must match Excel logic) ────────────────────────────

/**
 * Income final = MIN(centrix, verified) + adjustment
 * If only one source has data, use that source + adjustment.
 */
export function calcIncomeRow(row: IncomeRow): IncomeRow {
  const c = row.centrixAmount;
  const v = row.verifiedAmount;
  let base = 0;
  if (c > 0 && v > 0) base = Math.min(c, v);
  else if (c > 0) base = c;
  else if (v > 0) base = v;
  return { ...row, finalAmount: Math.max(0, base + row.adjustment) };
}

/**
 * Expense final = MAX(centrix, benchmark) + adjustment
 * Excel formula: the adjustment is ADDED on top, not included in the MAX.
 */
export function calcExpenseRow(row: ExpenseRow): ExpenseRow {
  const base = Math.max(row.centrixAmount, row.benchmarkAmount);
  return { ...row, finalAmount: Math.max(0, base + row.adjustment) };
}

// ─── Formatting ──────────────────────────────────────────────────────────────

export const fmt = (n: number) =>
  new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    minimumFractionDigits: 2,
  }).format(n);
