'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Icons } from '@/components/ui';

const STEPS = [
  'Personal information',
  'Employment & income',
  'Living expenses',
  'Existing debts',
  'Loan request',
  'Bank account',
  'References',
  'Declarations',
];

function LoanStepTrackerInner() {
  const searchParams = useSearchParams();
  const activeIndex = Math.min(Math.max(Number(searchParams.get('step') ?? 0), 0), STEPS.length - 1);

  return (
    <>
      {/* Desktop step list — vertical stepper on dark sidebar */}
      <ol className="hidden sm:flex flex-col gap-5">
        {STEPS.map((label, index) => {
          const isDone = index < activeIndex;
          const isActive = index === activeIndex;
          return (
            <li key={label} className="flex items-center gap-4">
              <span
                className={[
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors',
                  isDone
                    ? 'border-accent/60 bg-accent/20 text-accent'
                    : isActive
                      ? 'border-accent bg-accent text-ink step-pulse'
                      : 'border-white/20 text-white/40',
                ].join(' ')}
              >
                {isDone ? <Icons.Check size={14} strokeWidth={2.5} /> : index + 1}
              </span>
              <span
                className={[
                  'text-sm font-medium transition-colors',
                  isDone ? 'text-accent/70' : isActive ? 'text-white' : 'text-white/40',
                ].join(' ')}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Mobile progress bar */}
      <div className="sm:hidden w-full px-4 pt-3 pb-2 bg-surface border-b border-border">
        <div className="flex gap-1.5">
          {STEPS.map((label, index) => (
            <div
              key={label}
              className={[
                'h-1.5 flex-1 rounded-full transition-colors',
                index <= activeIndex ? 'bg-accent' : 'bg-border',
              ].join(' ')}
              aria-label={label}
            />
          ))}
        </div>
        <p className="text-[11.5px] text-muted mt-1.5">
          Step {activeIndex + 1} of {STEPS.length} · {STEPS[activeIndex]}
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
