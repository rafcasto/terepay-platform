'use client';

import { useState, useEffect, Suspense } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { terepayApplicationSchema, type TerepayApplicationInput } from '@/lib/validation/schemas';
import { useAuth } from '@/hooks/useAuth';
import Step1PersonalInfo from './_components/Step1PersonalInfo';
import Step2Employment from './_components/Step2Employment';
import Step3LivingExpenses from './_components/Step3LivingExpenses';
import Step4ExistingDebts from './_components/Step4ExistingDebts';
import Step5LoanRequest from './_components/Step5LoanRequest';
import Step6BankDetails from './_components/Step6BankDetails';
import Step7References from './_components/Step7References';
import Step8Declarations from './_components/Step8Declarations';

export default function ApplyPage() {
  return (
    <Suspense fallback={null}>
      <ApplyPageInner />
    </Suspense>
  );
}

const FORM_DEFAULT_VALUES = {
  personalInfo: {
    numberOfChildren: 0,
    numberOfDependents: 0,
  },
  employment: {
    income: {
      salaryBeforeTax: 0,
      salaryAfterTax: 0,
      winz: 0,
      otherIncome: 0,
    },
  },
  livingExpenses: {
    nonDiscretionary: {
      food: 0, utilities: 0, personalExpenses: 0, transport: 0,
      medical: 0, childcare: 0, accommodation: 0, healthInsurance: 0,
      carInsurance: 0, rates: 0, education: 0, childSupport: 0, remittances: 0,
    },
    discretionary: {
      restaurants: 0, entertainment: 0, travel: 0, subscriptions: 0,
      homeImprovement: 0, cashWithdrawals: 0, other: 0,
    },
    subscriptionDetails: {
      gym: { amount: 0, frequency: 'N/A' },
      netflix: { amount: 0, frequency: 'N/A' },
      spotify: { amount: 0, frequency: 'N/A' },
      sports: { amount: 0, frequency: 'N/A' },
      others: { amount: 0, frequency: 'N/A' },
    },
    bnpl: { afterpay: 0, klarna: 0, zip: 0 },
  },
  existingDebts: {
    mortgage: { totalOwed: 0, fortnightlyPayment: 0 },
    personalLoans: { totalOwed: 0, fortnightlyPayment: 0 },
    carLoans: { totalOwed: 0, fortnightlyPayment: 0 },
    creditCard: { totalOwed: 0, fortnightlyPayment: 0 },
    bankOverdrafts: { totalOwed: 0, fortnightlyPayment: 0 },
    otherLoans: [
      { description: '', totalOwed: 0, fortnightlyPayment: 0 },
      { description: '', totalOwed: 0, fortnightlyPayment: 0 },
      { description: '', totalOwed: 0, fortnightlyPayment: 0 },
    ],
  },
  loanRequest: {
    isPEP: false,
    remittance: { frequency: 'never' as const, averageAmount: 0, purposes: [] },
  },
  declarations: {
    infoAccurate: false,
    understandsVerification: false,
    authorisesContacts: false,
    understandsTerms: false,
    canAffordRepayments: false,
    receivedDisclosure: false,
    understandsConsequences: false,
    privacyPolicy: false,
    creditReporting: false,
  },
};

const STEPS = [
  { title: 'Personal Information', shortTitle: 'Personal', fields: ['personalInfo'] },
  { title: 'Employment & Income', shortTitle: 'Employment', fields: ['employment'] },
  { title: 'Living Expenses', shortTitle: 'Expenses', fields: ['livingExpenses'] },
  { title: 'Existing Debts', shortTitle: 'Debts', fields: ['existingDebts'] },
  { title: 'Loan Request', shortTitle: 'Loan', fields: ['loanRequest'] },
  { title: 'Bank Account', shortTitle: 'Bank', fields: ['bankDetails'] },
  { title: 'References', shortTitle: 'References', fields: ['references'] },
  { title: 'Declarations & Consent', shortTitle: 'Consent', fields: ['declarations'] },
] as const;

const STEP_COMPONENTS = [
  Step1PersonalInfo,
  Step2Employment,
  Step3LivingExpenses,
  Step4ExistingDebts,
  Step5LoanRequest,
  Step6BankDetails,
  Step7References,
  Step8Declarations,
];

function ApplyPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const [currentStep, setCurrentStep] = useState(
    () => Math.min(Math.max(Number(searchParams.get('step') ?? 0), 0), STEPS.length - 1)
  );
  const [draftLoading, setDraftLoading] = useState(true);

  // Keep URL in sync when step changes
  useEffect(() => {
    router.replace(`/applicant/apply?step=${currentStep}`, { scroll: false });
  }, [currentStep, router]);
  const [serverError, setServerError] = useState<string | null>(null);

  const methods = useForm<TerepayApplicationInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(terepayApplicationSchema) as any,
    mode: 'onTouched',
    defaultValues: FORM_DEFAULT_VALUES,
  });

  const { handleSubmit, trigger, reset, formState: { isSubmitting } } = methods;

  // Load an existing draft on mount so the user can resume where they left off
  useEffect(() => {
    async function loadDraft() {
      try {
        const res = await fetch('/api/applications');
        if (!res.ok) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await res.json() as { data: any[] };
        const draft = data?.find((a) => a.status === 'draft');
        if (!draft) return;
        const r2 = await fetch(`/api/applications/${draft.id}`);
        if (!r2.ok) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: d } = await r2.json() as { data: any };
        reset({
          ...FORM_DEFAULT_VALUES,
          ...(d.personalInfo   && { personalInfo:   d.personalInfo }),
          ...(d.employment     && { employment:     d.employment }),
          ...(d.livingExpenses && { livingExpenses: d.livingExpenses }),
          ...(d.existingDebts  && { existingDebts:  d.existingDebts }),
          ...(d.loanRequest    && { loanRequest:    d.loanRequest }),
          ...(d.bankDetails    && { bankDetails:    d.bankDetails }),
          ...(d.references     && { references:     d.references }),
          // declarations intentionally not pre-filled - user must re-confirm consent
        });
      } finally {
        setDraftLoading(false);
      }
    }
    loadDraft();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reset]);

  const isLastStep = currentStep === STEPS.length - 1;

  const handleNext = async () => {
    const fields = STEPS[currentStep].fields;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valid = await trigger(fields as any);
    if (valid) {
      setCurrentStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep === 0) {
      router.push('/applicant/applications');
      return;
    }
    setCurrentStep((s) => s - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSubmit = async (data: TerepayApplicationInput) => {
    setServerError(null);
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error?.message ?? 'Failed to submit application');
      }

      // Save Step 1 personal info back to the applicant profile (fire-and-forget)
      const pi = data.personalInfo;
      fetch('/api/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: pi.firstName,
          lastName: pi.lastName,
          phone: pi.phone,
          dateOfBirth: pi.dateOfBirth,
          address: pi.address,
          suburb: pi.suburb,
          city: pi.city,
          postCode: pi.postCode,
          country: 'New Zealand',
          housingStatus: pi.housingStatus,
          timeAtAddress: pi.timeAtAddress,
          visaStatus: pi.visaStatus,
          visaExpiryDate: pi.visaExpiryDate,
          householdType: pi.householdType,
          numberOfChildren: pi.numberOfChildren,
          numberOfDependents: pi.numberOfDependents,
        }),
      }).catch(() => {/* non-critical — application already submitted */});

      router.push('/applicant/applications');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const StepComponent = STEP_COMPONENTS[currentStep];

  // Show spinner while loading draft data
  if (draftLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-[#F5A523] border-t-transparent animate-spin" />
          <p className="text-sm text-gray-400">Loading your application...</p>
        </div>
      </div>
    );
  }

  // Block unverified users before rendering the form
  if (!loading && user && !user.emailVerified) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-amber-200 shadow-sm p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50">
            <svg className="h-7 w-7 text-[#F5A523]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Email verification required</h2>
          <p className="text-sm text-gray-500 mb-6">
            You must verify your email address before you can submit a loan application.
          </p>
          <Link
            href="/applicant/verify-email"
            className="inline-block w-full py-2.5 px-4 bg-[#F5A523] text-white text-sm font-medium rounded-lg hover:bg-[#E08B00] transition-colors"
          >
            Verify my email
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <FormProvider {...methods}>
        <div className="max-w-2xl mx-auto px-4 py-8 pb-32">
          {serverError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-700">{serverError}</p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
            <StepComponent />
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-30">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 sm:flex-none sm:w-28 py-2.5 px-4 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back
            </button>

            <div className="flex-1 hidden sm:block text-center text-xs text-gray-400">
              {currentStep + 1} / {STEPS.length}
            </div>

            {isLastStep ? (
              <button
                type="button"
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none sm:w-40 py-2.5 px-4 bg-[#F5A523] text-white text-sm font-semibold rounded-lg hover:bg-[#E08B00] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Submitting…' : 'Submit Application'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="flex-1 sm:flex-none sm:w-28 py-2.5 px-4 bg-[#F5A523] text-white text-sm font-semibold rounded-lg hover:bg-[#E08B00] transition-colors"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </FormProvider>
    </div>
  );
}
