'use client';

import { usePathname } from 'next/navigation';

const STEPS = [
  { label: 'Quick intro',         path: '/applicant/onboarding' },
  { label: 'Verify email',        path: '/applicant/onboarding/verify-email' },
  { label: 'Verify mobile',       path: '/applicant/onboarding/verify-mobile' },
  { label: 'Complete profile',    path: '/applicant/onboarding/profile' },
  { label: 'Verify government ID', path: '/applicant/onboarding/identity' },
];

export default function OnboardingStepTracker() {
  const pathname = usePathname();
  const activeIndex = STEPS.findIndex((s) => s.path === pathname);

  return (
    <>
      {/* Desktop step list */}
      <ol className="hidden sm:flex flex-col space-y-6">
        {STEPS.map((step, index) => {
          const isDone = index < activeIndex;
          const isActive = index === activeIndex;
          return (
            <li key={step.path} className="flex items-center gap-4">
              <span
                className={[
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                  isDone
                    ? 'border-[#F5A523]/60 bg-[#F5A523]/20 text-[#F5A523]'
                    : isActive
                    ? 'border-[#F5A523] bg-[#F5A523] text-[#0D1B2A]'
                    : 'border-white/20 text-white/40',
                ].join(' ')}
              >
                {isDone ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={[
                  'text-sm font-medium transition-colors',
                  isDone ? 'text-[#F5A523]/70' : isActive ? 'text-white' : 'text-white/40',
                ].join(' ')}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Mobile progress bar */}
      <div className="sm:hidden w-full px-4 pt-3 pb-2">
        <div className="flex gap-1.5">
          {STEPS.map((step, index) => (
            <div
              key={step.path}
              className={[
                'h-1.5 flex-1 rounded-full transition-colors',
                index <= activeIndex ? 'bg-[#F5A523]' : 'bg-gray-200',
              ].join(' ')}
              aria-label={step.label}
            />
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1.5">
          Step {activeIndex + 1} of {STEPS.length}
        </p>
      </div>
    </>
  );
}
