export const LOAN_PURPOSES = [
  { value: 'family_support', label: 'Family support' },
  { value: 'medical', label: 'Medical expenses' },
  { value: 'education', label: 'Education fees' },
  { value: 'mortgage_rent', label: 'Mortgage / Rent' },
  { value: 'business_support', label: 'Business support' },
  { value: 'savings_investment', label: 'Savings / Investment' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'remittance', label: 'Remittance' },
  { value: 'special_occasions', label: 'Special occasions' },
  { value: 'other', label: 'Other' },
] as const;

export type LoanPurposeValue = (typeof LOAN_PURPOSES)[number]['value'];

export const LOAN_PURPOSE_VALUES = LOAN_PURPOSES.map((p) => p.value) as unknown as [
  LoanPurposeValue,
  ...LoanPurposeValue[],
];

const LEGACY_PURPOSE_MAP: Record<string, LoanPurposeValue> = {
  debt_consolidation: 'other',
  car: 'other',
  household: 'other',
  travel: 'other',
  home_improvement: 'other',
  family: 'family_support',
};

export function normalizeLoanPurpose(value: string | undefined): LoanPurposeValue | undefined {
  if (!value) return undefined;
  if ((LOAN_PURPOSE_VALUES as readonly string[]).includes(value)) {
    return value as LoanPurposeValue;
  }
  return LEGACY_PURPOSE_MAP[value];
}

export function loanPurposeLabel(value: string | undefined | null): string {
  if (!value) return '—';
  const found = LOAN_PURPOSES.find((p) => p.value === value);
  if (found) return found.label;
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
