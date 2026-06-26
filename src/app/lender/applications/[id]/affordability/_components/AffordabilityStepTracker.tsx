'use client';

const STEPS = [
  'Customer Information',
  'Data Collection Checklist',
  'Income Verification',
  'Expense Verification',
  'Results & Decision',
];

export default function AffordabilityStepTracker({ currentStep }: { currentStep: number }) {
  return (
    <>
      {/* Desktop vertical step list */}
      <ol className="hidden flex-col space-y-5 sm:flex">
        {STEPS.map((label, index) => {
          const isDone = index < currentStep;
          const isActive = index === currentStep;
          return (
            <li key={label} className="flex items-center gap-4">
              <span
                className={[
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors',
                  isDone
                    ? 'border-[var(--orange-500)]/60 bg-[var(--orange-500)]/20 text-[var(--orange-400)]'
                    : isActive
                      ? 'border-[var(--orange-500)] bg-[var(--orange-500)] text-[var(--ink-900)]'
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
                  isDone ? 'text-white/70' : isActive ? 'text-white' : 'text-white/40',
                ].join(' ')}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Mobile horizontal progress bar */}
      <div className="w-full px-4 pb-2 pt-3 sm:hidden">
        <div className="flex gap-1.5">
          {STEPS.map((label, index) => (
            <div
              key={label}
              className={[
                'h-1.5 flex-1 rounded-full transition-colors',
                index <= currentStep ? 'bg-[var(--orange-500)]' : 'bg-white/20',
              ].join(' ')}
              aria-label={label}
            />
          ))}
        </div>
        <p className="mt-1.5 text-xs text-white/50">
          Step {currentStep + 1} of {STEPS.length}
        </p>
      </div>
    </>
  );
}
