'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Icons } from '@/components/ui';
import { useSiteContent } from '@/lib/content/SiteContentContext';

const STEP_KEYS = [
  'step1Label',
  'step2Label',
  'step3Label',
  'step4Label',
  'step5Label',
  'step6Label',
  'step7Label',
  'step8Label',
] as const;

/** Position of the References step in the application flow (see apply/page.tsx). */
const REFERENCES_INDEX = 6;

interface Props {
  /** Repeat customers are not asked for references, so the step is left out. */
  hideReferences?: boolean;
}

function LoanStepTrackerInner({ hideReferences = false }: Props) {
  const searchParams = useSearchParams();
  const c = useSiteContent('apply.layout');
  const requested = Math.min(Math.max(Number(searchParams.get('step') ?? 0), 0), STEP_KEYS.length - 1);
  const visible = STEP_KEYS.map((key, flowIndex) => ({ key, flowIndex })).filter(
    ({ flowIndex }) => !(hideReferences && flowIndex === REFERENCES_INDEX),
  );
  const steps = visible.map(({ key }) => c[key]);
  // The URL carries the flow index; map it onto the steps actually shown.
  const activeIndex = Math.max(
    0,
    visible.findIndex(({ flowIndex }) => flowIndex >= requested),
  );

  return (
    <>
      {/* ── Desktop: vertical connector rail ──────────────────────────── */}
      <ol className="hidden sm:flex flex-col">
        {steps.map((label, index) => {
          const isDone = index < activeIndex;
          const isActive = index === activeIndex;
          const isLast = index === steps.length - 1;
          return (
            <li key={visible[index].key} className="flex gap-4">
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
          {steps.map((label, index) => (
            <div
              key={visible[index].key}
              className={[
                'h-1.5 flex-1 rounded-pill transition-colors',
                index <= activeIndex ? 'bg-brand' : 'bg-[var(--border-default)]',
              ].join(' ')}
              aria-label={label}
            />
          ))}
        </div>
        <p className="text-[11.5px] text-[var(--text-muted)] mt-1.5 font-medium">
          Step {activeIndex + 1} of {steps.length} ·{' '}
          <span className="text-ink-strong">{steps[activeIndex]}</span>
        </p>
      </div>
    </>
  );
}

export default function LoanStepTracker(props: Props) {
  return (
    <Suspense fallback={null}>
      <LoanStepTrackerInner {...props} />
    </Suspense>
  );
}
