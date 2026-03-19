import type { ReactNode } from 'react';
import OnboardingStepTracker from './_components/OnboardingStepTracker';

interface Props {
  children: ReactNode;
}

/**
 * Layout for the KYC onboarding flow.
 * Renders the split-panel design (navy left / white right) on desktop,
 * and a full-width stacked layout with a top progress bar on mobile.
 * Intentionally does NOT include the applicant sidebar nav.
 */
export default function OnboardingLayout({ children }: Props) {
  return (
    <div className="min-h-screen flex flex-col sm:flex-row">
      {/* ── Left Brand Panel (desktop only) ─────────────────────────────── */}
      <aside className="hidden sm:flex flex-col w-72 lg:w-80 bg-[#0D1B2A] shrink-0 px-8 py-10">
        <div className="mb-10">
          <span className="text-2xl font-bold text-[#F5A523] tracking-tight">TerePay</span>
        </div>

        <OnboardingStepTracker />

        <p className="text-xs text-white/30 mt-10 leading-relaxed">
          Your information is encrypted and stored securely. We comply with NZ Privacy Act 2020.
        </p>
      </aside>

      {/* ── Main Content Panel ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen sm:min-h-0">
        {/* Mobile top bar */}
        <header className="sm:hidden sticky top-0 z-20 bg-[#0D1B2A] px-4 h-12 flex items-center shrink-0">
          <span className="text-lg font-bold text-[#F5A523]">TerePay</span>
        </header>

        {/* Mobile step progress */}
        <OnboardingStepTracker />

        <main className="flex-1 bg-white overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
