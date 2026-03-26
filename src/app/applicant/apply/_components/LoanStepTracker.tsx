'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const STEPS = [
  'Personal Information',
  'Employment & Income',
  'Living Expenses',
  'Existing Debts',
  'Loan Request',
  'Bank Account',
  'References',
  'Declarations & Consent',
];

function LoanStepTrackerInner() {
  const searchParams = useSearchParams();
  const activeIndex = Math.min(
    Math.max(Number(searchParams.get('step') ?? 0), 0),
    STEPS.length - 1
  );

  return (
    <>
      {/* Desktop step list */}
      <ol className="hidden sm:flex flex-col space-y-5">
        {STEPS.map((label, index) => {
          const isDone = index < activeIndex;
          const isActive = index === activeIndex;
          return (
            <li key={label} className="flex items-center gap-4">
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
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Mobile progress bar */}
      <div className="sm:hidden w-full px-4 pt-3 pb-2">
        <div className="flex gap-1.5">
          {STEPS.map((label, index) => (
            <div
              key={label}
              className={[
                'h-1.5 flex-1 rounded-full transition-colors',
                index <= activeIndex ? 'bg-[#F5A523]' : 'bg-gray-200',
              ].join(' ')}
              aria-label={label}
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

export default function LoanStepTracker() {
  return (
    <Suspense fallback={null}>
      <LoanStepTrackerInner />
    </Suspense>
  );
}
