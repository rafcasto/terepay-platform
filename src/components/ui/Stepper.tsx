import type { ReactNode } from 'react';
import { Check, X } from './Icons';

export type StepStatus = 'done' | 'active' | 'pending' | 'declined';

export interface Step {
  label: ReactNode;
  description?: ReactNode;
  status: StepStatus;
}

interface StepperProps {
  steps: Step[];
}

export function Stepper({ steps }: StepperProps) {
  return (
    <ol className="space-y-0">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const stepNum = i + 1;
        return (
          <li key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <Dot status={step.status} num={stepNum} />
              {!isLast && (
                <div
                  className={`mt-0.5 mb-0.5 w-0.5 flex-1 min-h-[20px] ${
                    step.status === 'done' ? 'bg-success/40' : 'bg-border'
                  }`}
                />
              )}
            </div>
            <div className={isLast ? 'pb-0' : 'pb-5'}>
              <p
                className={`text-sm font-semibold ${
                  step.status === 'done'
                    ? 'text-success'
                    : step.status === 'active'
                      ? 'text-accent-2'
                      : step.status === 'declined'
                        ? 'text-danger'
                        : 'text-muted'
                }`}
              >
                {step.label}
              </p>
              {step.description && (
                <p
                  className={`text-xs mt-1 leading-relaxed ${
                    step.status === 'done' || step.status === 'active'
                      ? 'text-muted'
                      : step.status === 'declined'
                        ? 'text-danger/70'
                        : 'text-muted/70'
                  }`}
                >
                  {step.description}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Dot({ status, num }: { status: StepStatus; num: number }) {
  if (status === 'done') {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success text-white shadow-soft-sm">
        <Check size={14} strokeWidth={2.5} />
      </div>
    );
  }
  if (status === 'active') {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-accent bg-accent-soft step-pulse">
        <span className="text-xs font-bold text-accent-2">{num}</span>
      </div>
    );
  }
  if (status === 'declined') {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-danger bg-danger-soft">
        <X size={14} strokeWidth={2.5} />
      </div>
    );
  }
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-border bg-surface">
      <span className="text-xs font-bold text-muted/60">{num}</span>
    </div>
  );
}
