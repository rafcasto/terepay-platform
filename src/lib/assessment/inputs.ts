import { AppError } from '@/lib/utils/api-error';
import { calcExpenseFinal, calcIncomeFinal, affordabilityLoanPayment } from '@/lib/loan/affordability-calc';
import { buildSchedule } from '@/lib/loan/repayment';
import type { LoanApplication } from '@/types/application';
import type { AffordabilityIncomeRowInput, AffordabilityExpenseRowInput } from '@/lib/loan/affordability-calc';
import {
  CREDIT_ASSESSMENT_PAYLOAD_VERSION,
  type CreditAssessmentApplicationInput,
  type CreditAssessmentPayload,
} from '@/types/credit-assessment';
import { deriveBehaviourFlags } from './behaviour';
import { resolveAssessmentDocuments } from './documents';

/** What the wizard has on screen when the lender presses "Run AI assessment". */
export interface AssessmentWizardInput {
  assessedAmount?: number;
  incomeRows: AffordabilityIncomeRowInput[];
  expenseRows: AffordabilityExpenseRowInput[];
  householdMultiplier: number;
  checklist: { firstTransactionDate?: string; daysOfTransactionData?: number };
}

export const MIN_LOAN = 200;
export const MAX_LOAN = 2000;

const round2 = (n: number) => Math.round(n * 100) / 100;
/** The wizard works in fortnights; the agent reasons in calendar months. */
export const fortnightlyToMonthly = (n: number) => round2((n * 26) / 12);

function toIso(v: unknown): string | undefined {
  const t = v as { toDate?: () => Date; _seconds?: number } | undefined;
  if (!t) return undefined;
  if (typeof t.toDate === 'function') return t.toDate().toISOString();
  if (typeof t._seconds === 'number') return new Date(t._seconds * 1000).toISOString();
  return undefined;
}

/**
 * Assemble every input the agent needs. Each missing or unusable input is
 * collected and reported together as one `MISSING_INPUTS` (422) error — the
 * agent is never asked to guess.
 */
export async function buildCreditAssessmentPayload(
  app: LoanApplication,
  wizard: AssessmentWizardInput,
): Promise<CreditAssessmentPayload> {
  const missing: string[] = [];

  // --- Applicant ---------------------------------------------------------
  const applicantName = `${app.personalInfo?.firstName ?? ''} ${app.personalInfo?.lastName ?? ''}`.trim();
  if (!applicantName) missing.push('Applicant name (personal information section)');

  const householdType = app.personalInfo?.householdType;
  if (!householdType) missing.push('Household type (personal information section)');

  // --- Loan --------------------------------------------------------------
  const requestedAmount = app.loanDetails?.requestedAmount ?? app.loanRequest?.requestedAmount;
  const assessedAmount = wizard.assessedAmount ?? requestedAmount;
  if (!Number.isFinite(assessedAmount) || assessedAmount === undefined) {
    missing.push('Loan amount under assessment');
  } else if (assessedAmount < MIN_LOAN || assessedAmount > MAX_LOAN) {
    missing.push(`Loan amount under assessment must be between $${MIN_LOAN} and $${MAX_LOAN}`);
  }
  if (!Number.isFinite(requestedAmount)) missing.push('Requested loan amount');

  const purpose = (app.loanRequest?.purpose ?? app.loanDetails?.loanPurpose ?? '').toString().trim();
  if (!purpose) missing.push('Loan purpose');

  const schedule = buildSchedule({ principal: Math.max(assessedAmount ?? 0, 1), startDate: new Date() });
  const interestRatePct = round2(schedule.annualRate * 100);
  if (!(interestRatePct > 0)) missing.push('Interest rate (collections configuration)');

  // --- Verified figures from the wizard ----------------------------------
  if (wizard.incomeRows.length === 0) missing.push('Verified income (Step 3)');
  if (wizard.expenseRows.length === 0) missing.push('Verified expenses (Step 4)');
  const fortnightlyIncome = round2(wizard.incomeRows.reduce((s, r) => s + calcIncomeFinal(r), 0));
  const fortnightlyExpenses = round2(wizard.expenseRows.reduce((s, r) => s + calcExpenseFinal(r), 0));
  if (wizard.incomeRows.length > 0 && !(fortnightlyIncome > 0)) {
    missing.push('Verified income greater than $0 (Step 3 — enter Centrix or verified amounts)');
  }

  // --- Existing debt (application form section) --------------------------
  const debts = app.existingDebts;
  let existingDebt: number | undefined;
  if (debts) {
    existingDebt = round2(
      (debts.mortgage?.totalOwed ?? 0) +
        (debts.personalLoans?.totalOwed ?? 0) +
        (debts.carLoans?.totalOwed ?? 0) +
        (debts.creditCard?.totalOwed ?? 0) +
        (debts.bankOverdrafts?.totalOwed ?? 0) +
        (debts.otherLoans ?? []).reduce((s, l) => s + (l.totalOwed ?? 0), 0),
    );
  } else if (typeof app.financialInformation?.currentDebts === 'number') {
    existingDebt = round2(app.financialInformation.currentDebts);
  } else {
    missing.push('Existing debts section of the application');
  }

  // --- Dates -------------------------------------------------------------
  const applicationDate = toIso(app.submittedAt) ?? toIso(app.timeline?.submittedAt) ?? toIso(app.timeline?.createdAt);
  if (!applicationDate) missing.push('Application submission date');

  const firstTransactionDate = wizard.checklist.firstTransactionDate?.trim() ?? '';
  if (!firstTransactionDate) missing.push('First transaction date (Step 2 checklist)');
  const daysOfData =
    wizard.checklist.daysOfTransactionData ??
    (firstTransactionDate
      ? Math.max(0, Math.floor((Date.now() - new Date(firstTransactionDate).getTime()) / 86_400_000))
      : 0);

  // --- Documents + TerePay loan history (independent lookups) -------------
  const [docs, behaviour] = await Promise.all([
    resolveAssessmentDocuments(app.applicationId, app.documents),
    deriveBehaviourFlags(app.applicantId, app.applicationId, assessedAmount ?? 0),
  ]);
  missing.push(...docs.missing);

  if (missing.length > 0) {
    throw new AppError(
      'MISSING_INPUTS',
      422,
      `The AI assessment needs every input before it can run. Missing: ${missing.join('; ')}`,
      { missing, skippedDocuments: docs.skipped },
    );
  }

  const loanPayment = round2(affordabilityLoanPayment(assessedAmount!));
  const application: CreditAssessmentApplicationInput = {
    id: app.applicationId,
    reference: app.referenceNumber ?? app.applicationId,
    applicant_name: applicantName,
    loan_amount: assessedAmount!,
    interest_rate: interestRatePct,
    income: fortnightlyToMonthly(fortnightlyIncome),
    expenses: fortnightlyToMonthly(fortnightlyExpenses),
    existing_debt: existingDebt!,
    loan_purpose: purpose,
    application_date: applicationDate!,
    household_type: householdType!,
    loan_history_count: behaviour.historyCount,
    ...behaviour.flags,
  };

  return {
    version: CREDIT_ASSESSMENT_PAYLOAD_VERSION,
    application,
    affordability: {
      assessed_amount: assessedAmount!,
      requested_amount: requestedAmount!,
      fortnightly_income: fortnightlyIncome,
      fortnightly_expenses: fortnightlyExpenses,
      fortnightly_loan_payment: loanPayment,
      fortnightly_surplus: round2(fortnightlyIncome - fortnightlyExpenses - loanPayment),
      household_multiplier: wizard.householdMultiplier,
      first_transaction_date: firstTransactionDate,
      days_of_transaction_data: daysOfData,
    },
    documents: docs.documents,
    folderId: docs.folderId,
    rootFolderId: docs.rootFolderId,
  };
}
