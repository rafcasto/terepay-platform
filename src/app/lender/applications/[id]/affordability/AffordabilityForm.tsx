'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AffordabilityStepTracker from './_components/AffordabilityStepTracker';
import StepCustomerInfo from './_components/steps/StepCustomerInfo';
import StepIncomeVerification from './_components/steps/StepIncomeVerification';
import StepExpenseVerification from './_components/steps/StepExpenseVerification';
import StepResultsDecision from './_components/steps/StepResultsDecision';
import StepDataChecklist from './_components/steps/StepDataChecklist';
import AiAssessmentPanel from './_components/steps/AiAssessmentPanel';
import {
  type IncomeRow,
  type ExpenseRow,
  type Checklist,
  EMPTY_CHECKLIST,
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  HOUSEHOLD_MULTIPLIERS,
  MIN_DAYS_OF_DATA,
  STEP,
  STEP_LABELS,
  WIZARD_LAYOUT_VERSION,
  calcIncomeRow,
  calcExpenseRow,
} from './_components/types';
import type { AffordabilityDraftData } from '@/types/application';
import type { CreditAssessmentJob } from '@/types/credit-assessment';
import { affordabilityLoanPayment } from '@/lib/loan/affordability-calc';
import { buildSchedule, DEFAULT_INSTALMENTS } from '@/lib/loan/repayment';

interface BenchmarkEntry {
  benchmarkId: string;
  categoryName: string;
  fortnightlyAmount: number;
}

const LAST_STEP = STEP_LABELS.length - 1;

// ─── Per-step validation ─────────────────────────────────────────────────────

/** Income step: at least one figure, and the statement coverage date the 90-day rule and the AI assessment need. */
function validateIncome(incomeRows: IncomeRow[], checklist: Checklist): string[] {
  const errors: string[] = [];
  if (!incomeRows.some((r) => r.centrixAmount > 0 || r.verifiedAmount > 0)) {
    errors.push('At least one income source must have a Centrix or Verified amount entered');
  }
  if (!checklist.firstTransactionDate) {
    errors.push('Enter the first transaction date on the bank statements (bank statement coverage)');
  }
  return errors;
}

/** Final checklist: every item ticked and its supporting detail supplied. */
function validateChecklist(checklist: Checklist, isCitizen: boolean): string[] {
  const errors: string[] = [];
  if (!checklist.centrixReportObtained) errors.push('Centrix report must be obtained');
  if (!checklist.centrixReportNumber.trim()) errors.push('Centrix report number is required');
  if (!checklist.firstTransactionVerified) errors.push('First transaction date must be verified');
  if (!checklist.firstTransactionDate) errors.push('First transaction date is required');
  if (!checklist.payslipsReceived) errors.push('Payslips must be received');
  if (!checklist.creditReportObtained) errors.push('Centrix affordability report must be obtained');
  if (!checklist.employmentVerified) errors.push('Employment must be verified');
  if (checklist.employmentVerified && !checklist.employmentVerificationMethod.trim())
    errors.push('Employment verification method is required');
  if (isCitizen) {
    if (!checklist.passportConfirmed) errors.push('Passport must be sighted for an NZ citizen');
    if (checklist.passportConfirmed && !checklist.passportExpiryDate)
      errors.push('Passport expiry date is required');
  } else {
    if (!checklist.visaConfirmed) errors.push('Visa status must be confirmed');
    if (checklist.visaConfirmed && !checklist.visaExpiryDate)
      errors.push('Visa expiry date is required when visa is confirmed');
  }
  return errors;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  applicationId: string;
  customerName: string;
  referenceNumber: string;
  loanAmount: number;
  loanTerm: number;
  householdType: string;
  assessmentDate: string;
  lenderName: string;
  preFillIncome: Partial<Record<string, number>>;
  preFillExpenses: Partial<Record<string, number>>;
  visaExpiryDate?: string;
  /** NZ citizen — the checklist asks for the passport instead of a visa, and the visa hard-decline does not apply. */
  isCitizen: boolean;
  catalogVersionId: string;
  isReassessment: boolean;
  initialDraft?: AffordabilityDraftData | null;
}

export default function AffordabilityForm({
  applicationId,
  customerName,
  referenceNumber,
  loanAmount,
  loanTerm,
  householdType,
  assessmentDate,
  lenderName,
  preFillIncome,
  preFillExpenses,
  visaExpiryDate,
  isCitizen,
  catalogVersionId,
  isReassessment,
  initialDraft,
}: Props) {
  const router = useRouter();
  const hMult = HOUSEHOLD_MULTIPLIERS[householdType] ?? 1.0;

  // A draft saved under an older step order resumes from the start (its data is kept).
  const [currentStep, setCurrentStep] = useState(() => {
    if (!initialDraft || initialDraft.layoutVersion !== WIZARD_LAYOUT_VERSION) return 0;
    return Math.min(Math.max(initialDraft.currentStep ?? 0, 0), LAST_STEP);
  });
  const [nowMs] = useState(() => Date.now());

  const [checklist, setChecklist] = useState<Checklist>(() => ({
    ...EMPTY_CHECKLIST,
    visaExpiryDate: isCitizen ? '' : (visaExpiryDate ?? ''),
    ...(initialDraft?.checklist ?? {}),
  }));

  // Rows are seeded from what the applicant declared on their application
  // (fortnightly, no conversion). Drafts saved before the declared column
  // existed get it back-filled so the reference figure is always visible.
  const [incomeRows, setIncomeRows] = useState<IncomeRow[]>(() => {
    if (initialDraft?.incomeRows?.length) {
      return (initialDraft.incomeRows as IncomeRow[]).map((row) =>
        calcIncomeRow({ ...row, declaredAmount: row.declaredAmount ?? preFillIncome[row.category] ?? 0 }),
      );
    }
    return INCOME_CATEGORIES.map((cat) =>
      calcIncomeRow({
        category: cat,
        declaredAmount: preFillIncome[cat] ?? 0,
        centrixAmount: 0,
        // Seed "verified" with the declared figure; the lender confirms or
        // replaces it against payslips on the income step.
        verifiedAmount: preFillIncome[cat] ?? 0,
        adjustment: 0,
        adjustmentReason: '',
        finalAmount: 0,
      }),
    );
  });

  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>(() => {
    if (initialDraft?.expenseRows?.length) {
      return (initialDraft.expenseRows as ExpenseRow[]).map((row) => {
        const declared = preFillExpenses[row.category] ?? 0;
        if (row.declaredAmount !== undefined) return calcExpenseRow(row);
        // Legacy draft: the declared figure used to be seeded into Adjustment,
        // where it was added on top of the benchmark. Move it back to the
        // declared column unless the lender has since edited/annotated it.
        const legacySeed =
          row.centrixAmount === 0 && row.adjustment === declared && declared > 0 && !row.adjustmentReason;
        return calcExpenseRow({
          ...row,
          declaredAmount: declared,
          adjustment: legacySeed ? 0 : row.adjustment,
        });
      });
    }
    return EXPENSE_CATEGORIES.map((cat) =>
      calcExpenseRow({
        category: cat,
        // Declared feeds the MAX(observed, benchmark) base until the lender
        // enters a Centrix figure — it is never added on top as an adjustment.
        declaredAmount: preFillExpenses[cat] ?? 0,
        centrixAmount: 0,
        benchmarkAmount: 0,
        adjustment: 0,
        adjustmentReason: '',
        finalAmount: 0,
      }),
    );
  });

  const [recommendation, setRecommendation] = useState<'proceed' | 'decline'>(
    initialDraft?.recommendation ?? 'proceed',
  );
  const [assessedAmount, setAssessedAmount] = useState<number>(
    initialDraft?.assessedAmount ?? loanAmount,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepErrors, setStepErrors] = useState<string[]>([]);
  // Latest AI credit assessment the Results & Decision panel knows about.
  const [creditAssessment, setCreditAssessment] = useState<CreditAssessmentJob | null>(null);

  useEffect(() => {
    fetch('/api/benchmarks')
      .then((r) => r.json())
      .then((data) => {
        if (!data.benchmarks) return;
        setExpenseRows((rows) =>
          rows.map((row) => {
            const bmEntry = (data.benchmarks as BenchmarkEntry[]).find(
              (b) => b.categoryName.toLowerCase() === row.category.toLowerCase(),
            );
            const benchmarkAmount = bmEntry ? bmEntry.fortnightlyAmount * hMult : 0;
            return calcExpenseRow({ ...row, benchmarkAmount });
          }),
        );
      })
      .catch(() => undefined);
  }, [hMult]);

  const updateIncomeRow = useCallback(
    (index: number, field: keyof IncomeRow, value: number | string) => {
      setIncomeRows((rows) => {
        const updated = [...rows];
        updated[index] = calcIncomeRow({ ...updated[index], [field]: value });
        return updated;
      });
    },
    [],
  );

  const updateExpenseRow = useCallback(
    (index: number, field: keyof ExpenseRow, value: number | string) => {
      setExpenseRows((rows) => {
        const updated = [...rows];
        updated[index] = calcExpenseRow({ ...updated[index], [field]: value });
        return updated;
      });
    },
    [],
  );

  const totalIncome = incomeRows.reduce((s, r) => s + r.finalAmount, 0);
  const totalExpenses = expenseRows.reduce((s, r) => s + r.finalAmount, 0);
  const netDisposable = totalIncome - totalExpenses;
  // Same pricing as the applicant's quote and the persisted assessment:
  // reducing-balance annuity at the configured annual rate, 4 fortnightly instalments.
  const loanPayment = affordabilityLoanPayment(assessedAmount);
  const loanQuote = buildSchedule({ principal: Math.max(assessedAmount, 0), startDate: new Date() });
  const surplus = netDisposable - loanPayment;

  const daysOfData = checklist.firstTransactionDate
    ? Math.floor(
        (nowMs - new Date(checklist.firstTransactionDate).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : 0;

  const hardDeclines: string[] = [];
  if (daysOfData > 0 && daysOfData < MIN_DAYS_OF_DATA)
    hardDeclines.push(`< ${MIN_DAYS_OF_DATA} days of transaction data`);
  if (surplus <= 0)
    hardDeclines.push('Surplus ≤ $0 — not affordable');
  // Citizens have no visa to expire.
  if (!isCitizen && checklist.visaExpiryDate) {
    const loanEnd = new Date();
    loanEnd.setDate(loanEnd.getDate() + 56 + 90);
    if (new Date(checklist.visaExpiryDate) < loanEnd)
      hardDeclines.push('Visa expires before loan completion + 3-month buffer');
  }
  const effectiveRecommendation: 'proceed' | 'decline' = hardDeclines.length > 0 ? 'decline' : recommendation;

  const saveDraft = (step: number) => {
    // Fire-and-forget — the wizard never blocks on the draft write.
    fetch(`/api/applications/${applicationId}/affordability`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        layoutVersion: WIZARD_LAYOUT_VERSION,
        currentStep: step,
        checklist,
        incomeRows,
        expenseRows,
        recommendation,
        assessedAmount,
      }),
    }).catch(() => undefined);
  };

  const submit = async () => {
    const errors = validateChecklist(checklist, isCitizen);
    if (errors.length > 0) {
      setStepErrors(errors);
      return;
    }
    setStepErrors([]);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/affordability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklist: { ...checklist, daysOfTransactionData: daysOfData },
          incomeRows,
          expenseRows,
          householdMultiplier: hMult,
          catalogVersionId,
          redFlagsAcknowledged: {},
          recommendation: effectiveRecommendation,
          assessedAmount,
          // Attach the AI assessment only when it finished (and for this amount).
          creditAssessmentId:
            creditAssessment?.status === 'done' && creditAssessment.payload?.application.loan_amount === assessedAmount
              ? creditAssessment.id
              : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          (data as { error?: { message?: string }; message?: string })?.error?.message ??
          (data as { message?: string })?.message ??
          'Failed to submit assessment';
        throw new Error(msg);
      }
      router.push(`/lender/applications/${applicationId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setLoading(false);
    }
  };

  const next = () => {
    // Validate the current step before advancing
    let errors: string[] = [];
    if (currentStep === STEP.income) errors = validateIncome(incomeRows, checklist);

    if (errors.length > 0) {
      setStepErrors(errors);
      return;
    }
    setStepErrors([]);

    const nextStep = Math.min(currentStep + 1, LAST_STEP);
    setCurrentStep(nextStep);
    saveDraft(nextStep);
  };

  const back = () => {
    setStepErrors([]);
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  return (
    <div className="flex min-h-screen flex-col sm:flex-row">
      {/* Left brand / step panel */}
      <aside className="hidden w-72 shrink-0 flex-col bg-[var(--ink-950)] px-8 py-10 sm:flex lg:w-80">
        <div className="mb-10">
          <span className="font-display text-2xl font-bold tracking-[-0.01em] text-white">
            Tere<span className="text-[var(--orange-500)]">Pay</span>
          </span>
          <p className="mt-1 text-xs text-white/40">Affordability assessment</p>
        </div>

        <AffordabilityStepTracker currentStep={currentStep} />

        <div className="mt-auto flex flex-col gap-4 pt-10">
          <Link
            href={`/lender/applications/${applicationId}`}
            className="flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white/80"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back to application
          </Link>
          <p className="text-xs leading-relaxed text-white/30">
            Assessment data is stored securely. Compliant with NZ CCCFA 2003.
          </p>
        </div>
      </aside>

      {/* Right content panel */}
      <div className="flex min-h-screen flex-1 flex-col sm:min-h-0">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between bg-[var(--ink-950)] px-4 sm:hidden">
          <Link
            href={`/lender/applications/${applicationId}`}
            className="flex items-center gap-1.5 text-white/70 transition-colors hover:text-white"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            <span className="text-sm">Back</span>
          </Link>
          <span className="text-sm font-semibold text-white">Affordability assessment</span>
          <span className="text-xs text-white/50">{currentStep + 1}/{STEP_LABELS.length}</span>
        </header>

        {/* Mobile step progress */}
        <div className="bg-[var(--ink-950)] pb-2 sm:hidden">
          <AffordabilityStepTracker currentStep={currentStep} />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto bg-[var(--surface-page)]">
          <div className="mx-auto max-w-5xl px-4 py-8 pb-24 sm:px-8 sm:pb-12">
            {currentStep === STEP.customer && (
              <StepCustomerInfo
                customerName={customerName}
                referenceNumber={referenceNumber}
                loanAmount={loanAmount}
                loanTerm={loanTerm}
                assessmentDate={assessmentDate}
                lenderName={lenderName}
                isReassessment={isReassessment}
                onNext={next}
              />
            )}
            {currentStep === STEP.income && (
              <StepIncomeVerification
                incomeRows={incomeRows}
                onUpdate={updateIncomeRow}
                totalIncome={totalIncome}
                firstTransactionDate={checklist.firstTransactionDate}
                onFirstTransactionDateChange={(v) => setChecklist((c) => ({ ...c, firstTransactionDate: v }))}
                daysOfData={daysOfData}
                onNext={next}
                onBack={back}
                validationErrors={stepErrors}
              />
            )}
            {currentStep === STEP.expense && (
              <StepExpenseVerification
                expenseRows={expenseRows}
                onUpdate={updateExpenseRow}
                totalExpenses={totalExpenses}
                onNext={next}
                onBack={back}
              />
            )}
            {currentStep === STEP.results && (
              <StepResultsDecision
                requestedAmount={loanAmount}
                assessedAmount={assessedAmount}
                onAssessedAmountChange={setAssessedAmount}
                totalIncome={totalIncome}
                totalExpenses={totalExpenses}
                netDisposable={netDisposable}
                loanPayment={loanPayment}
                annualRate={loanQuote.annualRate}
                instalments={DEFAULT_INSTALMENTS}
                totalRepayable={loanQuote.totalRepayable}
                surplus={surplus}
                hardDeclines={hardDeclines}
                recommendation={recommendation}
                onRecommendationChange={setRecommendation}
                onNext={next}
                onBack={back}
                aiPanel={
                  <AiAssessmentPanel
                    applicationId={applicationId}
                    assessedAmount={assessedAmount}
                    incomeRows={incomeRows}
                    expenseRows={expenseRows}
                    checklist={checklist}
                    householdMultiplier={hMult}
                    daysOfData={daysOfData}
                    onChange={setCreditAssessment}
                  />
                }
              />
            )}
            {currentStep === STEP.checklist && (
              <StepDataChecklist
                checklist={checklist}
                onChange={setChecklist}
                daysOfData={daysOfData}
                isCitizen={isCitizen}
                hardDeclines={hardDeclines}
                effectiveRecommendation={effectiveRecommendation}
                onSubmit={submit}
                loading={loading}
                error={error}
                onBack={back}
                validationErrors={stepErrors}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
