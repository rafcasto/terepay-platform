'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AffordabilityStepTracker from './_components/AffordabilityStepTracker';
import Step1CustomerInfo from './_components/steps/Step1CustomerInfo';
import Step2DataChecklist from './_components/steps/Step2DataChecklist';
import Step3IncomeVerification from './_components/steps/Step3IncomeVerification';
import Step4ExpenseVerification from './_components/steps/Step4ExpenseVerification';
import Step5ResultsDecision from './_components/steps/Step5ResultsDecision';
import {
  type IncomeRow,
  type ExpenseRow,
  type Checklist,
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  HOUSEHOLD_MULTIPLIERS,
  calcIncomeRow,
  calcExpenseRow,
} from './_components/types';
import type { AffordabilityDraftData } from '@/types/application';

interface BenchmarkEntry {
  benchmarkId: string;
  categoryName: string;
  fortnightlyAmount: number;
}

// ─── Per-step validation ─────────────────────────────────────────────────────

function validateStep1(checklist: Checklist, daysOfData: number): string[] {
  const errors: string[] = [];
  if (!checklist.centrixReportObtained) errors.push('Centrix report must be obtained');
  if (!checklist.centrixReportNumber.trim()) errors.push('Centrix report number is required');
  if (!checklist.firstTransactionVerified) errors.push('First transaction date must be verified');
  if (!checklist.firstTransactionDate) errors.push('First transaction date is required');
  if (daysOfData > 0 && daysOfData < 90) errors.push('At least 90 days of transaction data required');
  if (!checklist.payslipsReceived) errors.push('Payslips must be received');
  if (!checklist.creditReportObtained) errors.push('Credit report must be obtained');
  if (!checklist.employmentVerified) errors.push('Employment must be verified');
  if (checklist.employmentVerified && !checklist.employmentVerificationMethod.trim())
    errors.push('Employment verification method is required');
  if (!checklist.visaConfirmed) errors.push('Visa status must be confirmed');
  if (checklist.visaConfirmed && !checklist.visaExpiryDate)
    errors.push('Visa expiry date is required when visa is confirmed');
  return errors;
}

function validateStep2(incomeRows: IncomeRow[]): string[] {
  const hasIncome = incomeRows.some((r) => r.centrixAmount > 0 || r.verifiedAmount > 0);
  if (!hasIncome) {
    return ['At least one income source must have a Centrix or Verified amount entered'];
  }
  return [];
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
  catalogVersionId,
  isReassessment,
  initialDraft,
}: Props) {
  const router = useRouter();
  const hMult = HOUSEHOLD_MULTIPLIERS[householdType] ?? 1.0;

  const [currentStep, setCurrentStep] = useState(initialDraft?.currentStep ?? 0);

  const [checklist, setChecklist] = useState<Checklist>(() =>
    initialDraft?.checklist
      ? (initialDraft.checklist as Checklist)
      : {
          centrixReportObtained: false,
          centrixReportNumber: '',
          firstTransactionVerified: false,
          firstTransactionDate: '',
          payslipsReceived: false,
          creditReportObtained: false,
          employmentVerified: false,
          employmentVerificationMethod: '',
          visaConfirmed: false,
          visaExpiryDate: visaExpiryDate ?? '',
        },
  );

  const [incomeRows, setIncomeRows] = useState<IncomeRow[]>(() => {
    if (initialDraft?.incomeRows?.length) {
      return initialDraft.incomeRows as IncomeRow[];
    }
    return INCOME_CATEGORIES.map((cat) => ({
      category: cat,
      centrixAmount: 0,
      verifiedAmount: preFillIncome[cat] ?? 0,
      adjustment: 0,
      adjustmentReason: '',
      finalAmount: preFillIncome[cat] ?? 0,
    }));
  });

  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>(() => {
    if (initialDraft?.expenseRows?.length) {
      return initialDraft.expenseRows as ExpenseRow[];
    }
    return EXPENSE_CATEGORIES.map((cat) => ({
      category: cat,
      centrixAmount: 0,
      benchmarkAmount: 0,
      adjustment: preFillExpenses[cat] ?? 0,
      adjustmentReason: '',
      finalAmount: preFillExpenses[cat] ?? 0,
    }));
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
  const loanPayment = (assessedAmount * 1.047) / 4;
  const surplus = netDisposable - loanPayment;

  const daysOfData = checklist.firstTransactionDate
    ? Math.floor(
        (Date.now() - new Date(checklist.firstTransactionDate).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : 0;

  const hardDeclines: string[] = [];
  if (daysOfData > 0 && daysOfData < 90)
    hardDeclines.push('< 90 days of transaction data');
  if (surplus <= 0)
    hardDeclines.push('Surplus ≤ $0 — not affordable');
  if (checklist.visaExpiryDate) {
    const loanEnd = new Date();
    loanEnd.setDate(loanEnd.getDate() + 56 + 90);
    if (new Date(checklist.visaExpiryDate) < loanEnd)
      hardDeclines.push('Visa expires before loan completion + 3-month buffer');
  }

  const submit = async () => {
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
          recommendation: hardDeclines.length > 0 ? 'decline' : recommendation,
          assessedAmount,
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
    if (currentStep === 1) errors = validateStep1(checklist, daysOfData);
    else if (currentStep === 2) errors = validateStep2(incomeRows);

    if (errors.length > 0) {
      setStepErrors(errors);
      return;
    }
    setStepErrors([]);

    const nextStep = Math.min(currentStep + 1, 4);
    setCurrentStep(nextStep);

    // Persist draft after each successful advance (fire-and-forget)
    fetch(`/api/applications/${applicationId}/affordability`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentStep: nextStep,
        checklist,
        incomeRows,
        expenseRows,
        recommendation,
        assessedAmount,
      }),
    }).catch(() => undefined);
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
          <span className="text-xs text-white/50">{currentStep + 1}/5</span>
        </header>

        {/* Mobile step progress */}
        <div className="bg-[var(--ink-950)] pb-2 sm:hidden">
          <AffordabilityStepTracker currentStep={currentStep} />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto bg-[var(--surface-page)]">
          <div className="mx-auto max-w-5xl px-4 py-8 pb-24 sm:px-8 sm:pb-12">
            {currentStep === 0 && (
              <Step1CustomerInfo
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
            {currentStep === 1 && (
              <Step2DataChecklist
                checklist={checklist}
                onChange={setChecklist}
                daysOfData={daysOfData}
                onNext={next}
                onBack={back}
                validationErrors={stepErrors}
              />
            )}
            {currentStep === 2 && (
              <Step3IncomeVerification
                incomeRows={incomeRows}
                onUpdate={updateIncomeRow}
                totalIncome={totalIncome}
                onNext={next}
                onBack={back}
                validationErrors={stepErrors}
              />
            )}
            {currentStep === 3 && (
              <Step4ExpenseVerification
                expenseRows={expenseRows}
                onUpdate={updateExpenseRow}
                totalExpenses={totalExpenses}
                onNext={next}
                onBack={back}
              />
            )}
            {currentStep === 4 && (
              <Step5ResultsDecision
                requestedAmount={loanAmount}
                assessedAmount={assessedAmount}
                onAssessedAmountChange={setAssessedAmount}
                totalIncome={totalIncome}
                totalExpenses={totalExpenses}
                netDisposable={netDisposable}
                loanPayment={loanPayment}
                surplus={surplus}
                hardDeclines={hardDeclines}
                recommendation={recommendation}
                onRecommendationChange={setRecommendation}
                onSubmit={submit}
                loading={loading}
                error={error}
                onBack={back}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
