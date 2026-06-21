import type { ReactNode } from 'react';
import OnboardingStepTracker from './_components/OnboardingStepTracker';

interface Props {
  children: ReactNode;
}

export default function OnboardingLayout({ children }: Props) {
  return (
    <div className="min-h-screen flex flex-col sm:flex-row bg-bg">
      <aside className="hidden sm:flex flex-col w-72 lg:w-80 bg-ink shrink-0 px-8 py-10 text-white">
        <div className="mb-10">
          <span className="text-2xl font-extrabold text-accent tracking-tight">TerePay</span>
          <p className="text-xs text-white/40 mt-1">Account setup</p>
        </div>

        <OnboardingStepTracker />

        <p className="text-xs text-white/30 mt-10 leading-relaxed">
          Your information is encrypted and stored securely. We comply with NZ Privacy Act 2020.
        </p>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen sm:min-h-0">
        <header className="sm:hidden sticky top-0 z-20 bg-ink px-4 h-12 flex items-center shrink-0">
          <span className="text-lg font-extrabold text-accent tracking-tight">TerePay</span>
        </header>

        <div className="sm:hidden">
          <OnboardingStepTracker />
        </div>

        <main className="flex-1 bg-bg overflow-auto">{children}</main>
      </div>
    </div>
  );
}
