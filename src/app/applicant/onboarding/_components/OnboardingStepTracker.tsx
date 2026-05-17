'use client';

import { usePathname } from 'next/navigation';
import { Icons } from '@/components/ui';

const STEPS = [
  { label: 'Quick intro',          path: '/applicant/onboarding' },
  { label: 'Verify email',         path: '/applicant/onboarding/verify-email' },
  { label: 'Verify mobile',        path: '/applicant/onboarding/verify-mobile' },
  { label: 'Complete profile',     path: '/applicant/onboarding/profile' },
  { label: 'Verify government ID', path: '/applicant/onboarding/identity' },
];

export default function OnboardingStepTracker() {
  const pathname = usePathname();
  const activeIndex = STEPS.findIndex((s) => s.path === pathname);

  return (
    <>
      <ol className="hidden sm:flex flex-col gap-6">
        {STEPS.map((step, index) => {
          const isDone = index < activeIndex;
          const isActive = index === activeIndex;
          return (
            <li key={step.path} className="flex items-center gap-4">
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
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="sm:hidden w-full px-4 pt-3 pb-2 bg-surface border-b border-border">
        <div className="flex gap-1.5">
          {STEPS.map((step, index) => (
            <div
              key={step.path}
              className={[
                'h-1.5 flex-1 rounded-full transition-colors',
                index <= activeIndex ? 'bg-accent' : 'bg-border',
              ].join(' ')}
              aria-label={step.label}
            />
          ))}
        </div>
        <p className="text-[11.5px] text-muted mt-1.5">
          Step {Math.max(activeIndex + 1, 1)} of {STEPS.length}
        </p>
      </div>
    </>
  );
}
