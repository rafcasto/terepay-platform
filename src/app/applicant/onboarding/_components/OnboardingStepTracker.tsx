'use client';

import { usePathname } from 'next/navigation';
import { Icons } from '@/components/ui';
import { useSiteContent } from '@/lib/content/SiteContentContext';

const STEP_PATHS = [
  { key: 'step1Label', path: '/applicant/onboarding' },
  { key: 'step2Label', path: '/applicant/onboarding/verify-email' },
  { key: 'step3Label', path: '/applicant/onboarding/verify-mobile' },
  { key: 'step4Label', path: '/applicant/onboarding/profile' },
  { key: 'step5Label', path: '/applicant/onboarding/identity' },
] as const;

export default function OnboardingStepTracker() {
  const pathname = usePathname();
  const c = useSiteContent('onboarding.layout');
  const steps = STEP_PATHS.map((s) => ({ label: c[s.key], path: s.path }));
  const activeIndex = steps.findIndex((s) => s.path === pathname);
  const safeActive = activeIndex < 0 ? 0 : activeIndex;

  return (
    <>
      {/* ── Desktop: vertical connector rail ──────────────────────────── */}
      <ol className="hidden sm:flex flex-col">
        {steps.map((step, index) => {
          const isDone = index < safeActive;
          const isActive = index === safeActive;
          const isLast = index === steps.length - 1;
          return (
            <li key={step.path} className="flex gap-4">
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
                      'w-0.5 flex-1 min-h-[28px] my-1 rounded-full transition-colors',
                      index < safeActive ? 'bg-[var(--gold-300)]/60' : 'bg-white/12',
                    ].join(' ')}
                  />
                )}
              </div>
              <span
                className={[
                  'pt-1 pb-6 text-sm font-medium transition-colors',
                  isActive ? 'text-white' : isDone ? 'text-white/70' : 'text-white/40',
                ].join(' ')}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* ── Mobile: segmented progress bar ────────────────────────────── */}
      <div className="sm:hidden w-full px-4 pt-3 pb-2.5 bg-surface-card border-b border-border-default">
        <div className="flex gap-1.5">
          {steps.map((step, index) => (
            <div
              key={step.path}
              className={[
                'h-1.5 flex-1 rounded-pill transition-colors',
                index <= safeActive ? 'bg-brand' : 'bg-[var(--border-default)]',
              ].join(' ')}
              aria-label={step.label}
            />
          ))}
        </div>
        <p className="text-[11.5px] text-[var(--text-muted)] mt-1.5 font-medium">
          Step {safeActive + 1} of {steps.length} ·{' '}
          <span className="text-ink-strong">{steps[safeActive]?.label}</span>
        </p>
      </div>
    </>
  );
}
