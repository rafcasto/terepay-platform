'use client';

import { useState, useEffect, Suspense } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { terepayApplicationSchema, type TerepayApplicationInput } from '@/lib/validation/schemas';
import { useAuth } from '@/hooks/useAuth';
import { normalizeLoanPurpose } from '@/lib/constants/loan-purposes';
import { Button, ButtonLink, Card, Icons } from '@/components/ui';
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
  const [draftId, setDraftId] = useState<string | null>(null);

  // Keep URL in sync when step changes
  useEffect(() => {
    router.replace(`/applicant/apply?step=${currentStep}`, { scroll: false });
  }, [currentStep, router]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

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
        if (!draft) {
          // Create a draft immediately so it appears in Firestore from the first visit
          const createRes = await fetch('/api/applications', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
          if (createRes.ok) {
            const json = await createRes.json() as { data: { id: string } };
            setDraftId(json.data.id);
          }
          // Always start at step 0 for new applications — overrides any ?step=N URL param
          setCurrentStep(0);
          return;
        }
        const r2 = await fetch(`/api/applications/${draft.id}`);
        if (!r2.ok) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: d } = await r2.json() as { data: any };
        setDraftId(draft.id);
        if (typeof d.lastCompletedStep === 'number') {
          setCurrentStep(Math.min(d.lastCompletedStep + 1, STEPS.length - 1));
        }
        // Map any legacy purpose values (e.g. debt_consolidation, car) to the
        // current enum so the dropdown doesn't end up with an invalid selection.
        const migratedLoanRequest = d.loanRequest
          ? {
              ...d.loanRequest,
              ...(d.loanRequest.purpose && {
                purpose: normalizeLoanPurpose(d.loanRequest.purpose) ?? '',
              }),
            }
          : undefined;
        reset({
          ...FORM_DEFAULT_VALUES,
          ...(d.personalInfo   && { personalInfo:   d.personalInfo }),
          ...(d.employment     && { employment:     d.employment }),
          ...(d.livingExpenses && { livingExpenses: d.livingExpenses }),
          ...(d.existingDebts  && { existingDebts:  d.existingDebts }),
          ...(migratedLoanRequest && { loanRequest:  migratedLoanRequest }),
          ...(d.bankDetails    && { bankDetails:    d.bankDetails }),
          ...(d.references     && { references:     d.references }),
          // declarations intentionally not pre-filled - user must re-confirm consent
        });
      } finally {
        setDraftLoading(false);
      }
    }
    loadDraft();
  }, [reset]);

  const isLastStep = currentStep === STEPS.length - 1;

  // Best-effort background save of a single form section to Firestore.
  // Creates the draft document on first call; subsequent calls update it.
  // Failures are swallowed — the full submit on step 8 acts as the safety net.
  const saveDraftStep = async (step: number) => {
    const sectionKey = STEPS[step].fields[0] as keyof TerepayApplicationInput;
    const sectionData = methods.getValues(sectionKey);
    const res = await fetch('/api/applications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [sectionKey]: sectionData, lastCompletedStep: step }),
    });
    if (res.ok) {
      const json = await res.json() as { data: { id: string } };
      setDraftId((prev) => prev ?? json.data.id);
    }
  };

  const handleNext = async () => {
    const fields = STEPS[currentStep].fields;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const valid = await trigger(fields as any);
    if (valid) {
      // Best-effort background save — does not block navigation
      saveDraftStep(currentStep)
        .then(() => {
          setJustSaved(true);
          window.setTimeout(() => setJustSaved(false), 2500);
        })
        .catch(() => {});
      setCurrentStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Bring the first validation error into view (errors render as <p> in the card)
      requestAnimationFrame(() => {
        document
          .querySelector('p.text-danger-text')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  };

  const handleBack = () => {
    if (currentStep === 0) {
      router.push('/applicant/dashboard');
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
        const code = (body.error?.code ?? '') as string;
        let errorMessage: string;
        if (code === 'FORBIDDEN' || code === 'ACTIVE_LOAN_EXISTS') {
          errorMessage = body.error.message;
        } else if (code === 'RATE_LIMITED') {
          errorMessage = 'Too many requests. Please wait a moment and try again.';
        } else if (code === 'VALIDATION_ERROR') {
          const details = body.error?.details as Record<string, string[]> | undefined;
          const FIELD_TO_STEP: Record<string, string> = {
            personalInfo: 'Personal Information',
            employment: 'Employment & Income',
            livingExpenses: 'Living Expenses',
            existingDebts: 'Existing Debts',
            loanRequest: 'Loan Request',
            bankDetails: 'Bank Account',
            references: 'References',
            declarations: 'Declarations & Consent',
          };
          if (details && Object.keys(details).length > 0) {
            const sections = [...new Set(
              Object.keys(details).map((k) => FIELD_TO_STEP[k.split('.')[0]] ?? k.split('.')[0])
            )];
            errorMessage = `Please review the following sections before submitting: ${sections.join(', ')}.`;
          } else {
            errorMessage = body.error?.message ?? 'Some fields are invalid. Please review your application.';
          }
        } else {
          errorMessage = 'Something went wrong on our end. Please try again or contact support.';
        }
        throw new Error(errorMessage);
      }

      // Immediately transition from draft → pending_review so it appears in the lender dashboard
      const applicationId = (body.data as { applicationId: string }).applicationId ?? draftId;
      if (!applicationId) {
        throw new Error('Application ID missing after save. Please try again.');
      }
      const submitRes = await fetch(`/api/applications/${applicationId}/submit`, { method: 'POST' });
      if (!submitRes.ok) {
        const submitBody = await submitRes.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(submitBody.error?.message ?? 'Your application was saved but could not be submitted. Please try again.');
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

      router.push(`/applicant/applications/${applicationId}?submitted=true`);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const StepComponent = STEP_COMPONENTS[currentStep];

  if (draftLoading) {
    return (
      <div className="min-h-screen bg-[var(--surface-page)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--orange-700)] border-t-transparent animate-spin" />
          <p className="text-sm text-[var(--text-muted)]">Loading your application...</p>
        </div>
      </div>
    );
  }

  if (!loading && user && !user.emailVerified) {
    return (
      <div className="min-h-screen bg-[var(--surface-page)] flex items-center justify-center px-4">
        <Card className="max-w-md w-full text-center border-[var(--orange-500)]/40">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft">
            <Icons.AlertTriangle size={28} className="text-brand-text" />
          </div>
          <h2 className="text-lg font-bold mb-2">Email verification required</h2>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            You must verify your email address before you can submit a loan application.
          </p>
          <ButtonLink href="/applicant/verify-email" fullWidth>
            Verify my email
          </ButtonLink>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface-page)]">
      <FormProvider {...methods}>
        <div className="max-w-[880px] mx-auto px-4 py-8 pb-12 screen-in">
          {serverError && (
            <Card className="mb-6 border-[var(--danger-500)]/40 bg-danger-soft-ds">
              <p className="text-sm text-danger-text font-medium">{serverError}</p>
            </Card>
          )}

          <Card className="p-6 sm:p-8">
            <StepComponent />
          </Card>

          {/* Action bar — sticks to the bottom of the viewport on mobile so the
              primary action is always reachable on long steps. */}
          <div className="mt-6 sticky bottom-0 z-10 -mx-4 px-4 py-3 border-t border-border-default bg-[var(--surface-page)]/95 backdrop-blur sm:static sm:mx-0 sm:px-0 sm:py-0 sm:border-0 sm:bg-transparent sm:backdrop-blur-none">
            <div className="flex flex-col gap-2">
              {isLastStep ? (
                <Button type="button" onClick={handleSubmit(onSubmit)} disabled={isSubmitting} size="lg" fullWidth>
                  {isSubmitting ? 'Submitting…' : 'Submit application'}
                </Button>
              ) : (
                <Button type="button" onClick={handleNext} size="lg" fullWidth>
                  Continue
                </Button>
              )}

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-ink-strong transition-colors flex items-center gap-1.5"
                >
                  <Icons.ArrowLeft size={16} />
                  {currentStep === 0 ? 'Back to dashboard' : 'Back'}
                </button>

                <span
                  aria-live="polite"
                  className={`flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] transition-opacity duration-200 ${justSaved ? 'opacity-100' : 'opacity-0'}`}
                >
                  <Icons.Check size={14} className="text-[var(--success-700)]" />
                  Draft saved
                </span>
              </div>

              <p className="text-center sm:text-left text-[11.5px] text-[var(--text-muted)]">
                Your progress is saved automatically — you can leave and come back anytime.
              </p>
            </div>
          </div>
        </div>
      </FormProvider>
    </div>
  );
}
