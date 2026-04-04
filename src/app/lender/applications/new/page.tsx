'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { terepayApplicationSchema, type TerepayApplicationInput } from '@/lib/validation/schemas';
import Step1PersonalInfo from '@/app/applicant/apply/_components/Step1PersonalInfo';
import Step2Employment from '@/app/applicant/apply/_components/Step2Employment';
import Step3LivingExpenses from '@/app/applicant/apply/_components/Step3LivingExpenses';
import Step4ExistingDebts from '@/app/applicant/apply/_components/Step4ExistingDebts';
import Step5LoanRequest from '@/app/applicant/apply/_components/Step5LoanRequest';
import Step6BankDetails from '@/app/applicant/apply/_components/Step6BankDetails';
import Step7References from '@/app/applicant/apply/_components/Step7References';
import Step8Declarations from '@/app/applicant/apply/_components/Step8Declarations';

// ── Types ────────────────────────────────────────────────────────────────────

type CustomerType = 'online' | 'offline';
interface CustomerResult {
  type: CustomerType;
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  customerId?: string;
  status?: string;
}

interface SelectedCustomer {
  type: CustomerType;
  id: string;
  displayName: string;
  email?: string;
  customerId?: string;
}

// ── Form defaults (same as applicant apply page) ─────────────────────────────
// Intentionally no explicit type — mirrors the apply page pattern so TS infers
// the partial shape without requiring every required field.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FORM_DEFAULT_VALUES: any = {
  personalInfo: { numberOfChildren: 0, numberOfDependents: 0 },
  employment: {
    income: { salaryBeforeTax: 0, salaryAfterTax: 0, winz: 0, otherIncome: 0 },
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
  Step1PersonalInfo, Step2Employment, Step3LivingExpenses, Step4ExistingDebts,
  Step5LoanRequest, Step6BankDetails, Step7References, Step8Declarations,
];

// ── Main export (Suspense wrapper) ───────────────────────────────────────────

export default function LenderNewApplicationPage() {
  return (
    <Suspense fallback={null}>
      <LenderNewApplicationInner />
    </Suspense>
  );
}

// ── Inner component ──────────────────────────────────────────────────────────

function LenderNewApplicationInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledOfflineId = searchParams.get('offlineCustomerId');

  // ── State ────────────────────────────────────────────────────────────────
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);

  // Prefill customer if navigating from the customers page
  const [prefillResolved, setPrefillResolved] = useState(false);

  useEffect(() => {
    if (!prefilledOfflineId || prefillResolved) return;
    (async () => {
      try {
        const res = await fetch(`/api/customers?q=${encodeURIComponent(prefilledOfflineId)}&type=offline`);
        const data = await res.json();
        const customer = (data.data as CustomerResult[])?.find((c) => c.id === prefilledOfflineId);
        if (customer) {
          setSelectedCustomer({
            type: 'offline',
            id: customer.id,
            displayName: `${customer.firstName} ${customer.lastName}`,
            email: customer.email,
            customerId: customer.customerId,
          });
        }
      } finally {
        setPrefillResolved(true);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledOfflineId]);

  // ── Form ─────────────────────────────────────────────────────────────────
  const methods = useForm<TerepayApplicationInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(terepayApplicationSchema) as any,
    mode: 'onTouched',
    defaultValues: FORM_DEFAULT_VALUES,
  });

  const { handleSubmit, trigger, formState: { isSubmitting } } = methods;

  const isLastStep = currentStep === STEPS.length - 1;

  const handleNext = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fields: any[] = [...STEPS[currentStep].fields];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valid = await trigger(fields as unknown as any);
    if (valid) {
      setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setCurrentStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSubmit = async (data: TerepayApplicationInput) => {
    if (!selectedCustomer) return;
    setServerError(null);
    try {
      const payload: Record<string, unknown> = {
        ...(selectedCustomer.type === 'online'
          ? { applicantId: selectedCustomer.id }
          : { offlineCustomerId: selectedCustomer.id }),
        personalInfo: data.personalInfo,
        employment: data.employment,
        livingExpenses: data.livingExpenses,
        existingDebts: data.existingDebts,
        loanRequest: data.loanRequest,
        bankDetails: data.bankDetails,
        references: data.references,
        declarations: data.declarations,
      };

      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        setServerError(json.error?.message ?? 'Failed to submit application. Please try again.');
        return;
      }

      router.push(`/lender/applications/${json.data.applicationId}`);
    } catch {
      setServerError('Network error. Please check your connection.');
    }
  };

  // ── Customer not yet selected ────────────────────────────────────────────
  if (!selectedCustomer) {
    return (
      <div className="flex items-start justify-center min-h-full py-8 px-4">
        <div className="w-full max-w-lg">
          <button
            type="button"
            onClick={() => router.push('/lender/applications')}
            className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Applications
          </button>
          <h2 className="text-2xl font-bold text-[#0D1B2A] mb-1">New Application</h2>
          <p className="text-gray-500 text-sm mb-6">Search for an existing customer to create a loan application on their behalf.</p>
          <CustomerSearch onSelect={setSelectedCustomer} />
        </div>
      </div>
    );
  }

  // ── Application form ─────────────────────────────────────────────────────
  const StepComponent = STEP_COMPONENTS[currentStep];

  return (
    <div className="flex items-start justify-center min-h-full py-8 px-4">
      <div className="w-full max-w-2xl">
        {/* Customer banner */}
        <div className="mb-6 bg-[#FEF7E9] border border-[#F5A523]/40 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-full bg-[#F5A523]/20 flex items-center justify-center shrink-0">
              <svg className="h-4 w-4 text-[#E08B00]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{selectedCustomer.displayName}</p>
              <p className="text-xs text-gray-500 truncate">
                {selectedCustomer.customerId ? `${selectedCustomer.customerId} · ` : ''}
                {selectedCustomer.email ?? ''}
                {' '}
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                  selectedCustomer.type === 'online'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {selectedCustomer.type === 'online' ? 'Online' : 'Offline'}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setSelectedCustomer(null); setCurrentStep(0); }}
            className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
          >
            Change
          </button>
        </div>

        {/* Step progress */}
        <div className="mb-6 overflow-x-auto -mx-1 px-1">
          <div className="flex gap-1 min-w-max">
            {STEPS.map((s, i) => (
              <div
                key={s.shortTitle}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  i === currentStep
                    ? 'bg-[#F5A523] text-white'
                    : i < currentStep
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {i < currentStep && (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {s.shortTitle}
              </div>
            ))}
          </div>
        </div>

        {/* Step title */}
        <div className="mb-5">
          <h2 className="text-xl font-bold text-[#0D1B2A]">
            Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].title}
          </h2>
        </div>

        {/* Form */}
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <StepComponent />
            </div>

            {serverError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {serverError}
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 0}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Back
              </button>

              {isLastStep ? (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-[#F5A523] text-white text-sm font-semibold rounded-lg hover:bg-[#E08B00] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Submitting…' : 'Submit Application'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2 bg-[#F5A523] text-white text-sm font-semibold rounded-lg hover:bg-[#E08B00] transition-colors"
                >
                  Next
                </button>
              )}
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}

// ── Customer Search component ─────────────────────────────────────────────────

function CustomerSearch({ onSelect }: { onSelect: (c: SelectedCustomer) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.data ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  return (
    <div>
      <div className="relative mb-4">
        <input
          type="search"
          placeholder="Search by name, email, or Customer ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5A523] focus:border-[#F5A523] focus:outline-none"
          autoFocus
        />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1116.65 2a7.5 7.5 0 010 14.65z" />
        </svg>
        {loading && (
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#F5A523] animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
      </div>

      {results.length === 0 && !loading && (
        <div className="text-center py-10 text-gray-400 text-sm">
          {query ? 'No customers found.' : 'Start typing to search…'}
          <div className="mt-3">
            <a
              href="/lender/customers/new"
              className="text-[#F5A523] hover:text-[#E08B00] font-medium text-xs"
            >
              + Create new offline customer
            </a>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white overflow-hidden">
          {results.map((c) => (
            <li key={`${c.type}-${c.id}`}>
              <button
                type="button"
                onClick={() =>
                  onSelect({
                    type: c.type,
                    id: c.id,
                    displayName: `${c.firstName} ${c.lastName}`,
                    email: c.email,
                    customerId: c.customerId,
                  })
                }
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#FEF7E9] transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {c.firstName} {c.lastName}
                    {c.customerId && (
                      <span className="ml-2 font-mono text-xs text-[#E08B00]">{c.customerId}</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{c.email}</p>
                </div>
                <span
                  className={`ml-3 shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    c.type === 'online'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {c.type === 'online' ? 'Online' : 'Offline'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
