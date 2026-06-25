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
      {/* ── Desktop: vertical connector rail ──────────────────────────── */}
      <ol className="hidden sm:flex flex-col">
        {STEPS.map((label, index) => {
          const isDone = index < activeIndex;
          const isActive = index === activeIndex;
          const isLast = index === STEPS.length - 1;
          return (
            <li key={label} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  className={[
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-[13px] font-semibold font-tabular transition-colors',
                    isDone
                      ? 'border-[var(--gold-300)] bg-[var(--gold-300)] text-[var(--ink-900)]'
                      : isActive
                        ? 'border-[var(--gold-300)] text-[var(--gold-300)] step-pulse'
                        : 'border-white/20 text-white/40',
                  ].join(' ')}
                >
                  {isDone ? <Icons.Check size={15} strokeWidth={2.5} /> : index + 1}
                </span>
                {!isLast && (
                  <span
                    className={[
                      'w-0.5 flex-1 min-h-[22px] my-1 rounded-full transition-colors',
                      index < activeIndex ? 'bg-[var(--gold-300)]/60' : 'bg-white/12',
                    ].join(' ')}
                  />
                )}
              </div>
              <span
                className={[
                  'pt-1 pb-5 text-sm font-medium transition-colors',
                  isActive ? 'text-white' : isDone ? 'text-white/70' : 'text-white/40',
                ].join(' ')}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* ── Mobile: segmented progress bar ────────────────────────────── */}
      <div className="sm:hidden w-full px-4 pt-3 pb-2.5 bg-surface-card border-b border-border-default">
        <div className="flex gap-1.5">
          {STEPS.map((label, index) => (
            <div
              key={label}
              className={[
                'h-1.5 flex-1 rounded-pill transition-colors',
                index <= activeIndex ? 'bg-brand' : 'bg-[var(--border-default)]',
              ].join(' ')}
              aria-label={label}
            />
          ))}
        </div>
        <p className="text-[11.5px] text-[var(--text-muted)] mt-1.5 font-medium">
          Step {activeIndex + 1} of {STEPS.length} ·{' '}
          <span className="text-ink-strong">{STEPS[activeIndex]}</span>
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
