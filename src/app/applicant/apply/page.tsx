'use client';

import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { terepayApplicationSchema, type TerepayApplicationInput } from '@/lib/validation/schemas';

import FormProgress from './_components/FormProgress';
import Step1PersonalInfo from './_components/Step1PersonalInfo';
import Step2Employment from './_components/Step2Employment';
import Step3LivingExpenses from './_components/Step3LivingExpenses';
import Step4ExistingDebts from './_components/Step4ExistingDebts';
import Step5LoanRequest from './_components/Step5LoanRequest';
import Step6BankDetails from './_components/Step6BankDetails';
import Step7References from './_components/Step7References';
import Step8Declarations from './_components/Step8Declarations';

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

export default function ApplyPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);

  const methods = useForm<TerepayApplicationInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(terepayApplicationSchema) as any,
    mode: 'onTouched',
    defaultValues: {
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
        remittance: { frequency: 'never', averageAmount: 0, purposes: [] },
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
    },
  });

  const { handleSubmit, trigger, formState: { isSubmitting } } = methods;

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
    setCurrentStep((s) => Math.max(0, s - 1));
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

      router.push('/applicant/applications');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const StepComponent = STEP_COMPONENTS[currentStep];

  return (
    <div className="min-h-screen bg-gray-50">
      <FormProgress steps={STEPS as unknown as { title: string; shortTitle: string }[]} currentStep={currentStep} />

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
              disabled={currentStep === 0}
              className="flex-1 sm:flex-none sm:w-28 py-2.5 px-4 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                className="flex-1 sm:flex-none sm:w-40 py-2.5 px-4 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Submitting…' : 'Submit Application'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="flex-1 sm:flex-none sm:w-28 py-2.5 px-4 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
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
