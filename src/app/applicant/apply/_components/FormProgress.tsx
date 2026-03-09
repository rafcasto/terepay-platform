interface Step {
  title: string;
  shortTitle: string;
}

interface FormProgressProps {
  steps: Step[];
  currentStep: number;
}

export default function FormProgress({ steps, currentStep }: FormProgressProps) {
  return (
    <div className="w-full bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
      {/* Mobile: compact number + title */}
      <div className="flex items-center justify-between px-4 py-3 sm:hidden">
        <span className="text-xs font-medium text-gray-500">
          Step {currentStep + 1} of {steps.length}
        </span>
        <span className="text-sm font-semibold text-indigo-600">
          {steps[currentStep].title}
        </span>
        <span className="text-xs text-gray-400">
          {Math.round(((currentStep + 1) / steps.length) * 100)}%
        </span>
      </div>
      {/* Mobile progress bar */}
      <div className="h-1 bg-gray-100 sm:hidden">
        <div
          className="h-1 bg-indigo-600 transition-all duration-300"
          style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
        />
      </div>

      {/* Desktop: numbered step list */}
      <div className="hidden sm:flex items-center justify-center gap-0 px-6 py-4 overflow-x-auto">
        {steps.map((step, i) => {
          const isCompleted = i < currentStep;
          const isActive = i === currentStep;
          return (
            <div key={step.shortTitle} className="flex items-center">
              <div className="flex flex-col items-center gap-1 min-w-[60px]">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isCompleted
                      ? 'bg-indigo-600 text-white'
                      : isActive
                      ? 'bg-indigo-600 text-white ring-2 ring-indigo-200 ring-offset-1'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium text-center leading-tight ${
                    isActive ? 'text-indigo-600' : isCompleted ? 'text-gray-600' : 'text-gray-400'
                  }`}
                >
                  {step.shortTitle}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`h-0.5 w-6 mx-1 mb-4 transition-colors ${
                    isCompleted ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
