import type { ReactNode } from 'react';
import Image from 'next/image';
import OnboardingStepTracker from './_components/OnboardingStepTracker';
import { Icons } from '@/components/ui';

interface Props {
  children: ReactNode;
}

export default function OnboardingLayout({ children }: Props) {
  return (
    <div className="min-h-screen flex flex-col sm:flex-row bg-[var(--surface-page)]">
      {/* ── Sidebar (desktop) — navy, institutional ──────────────────────── */}
      <aside className="hidden sm:flex flex-col w-72 lg:w-80 shrink-0 bg-surface-inverse text-white px-8 py-10">
        <div className="mb-12">
          <Image
            src="/brand/terepay-wordmark-white.png"
            alt="TerePay"
            width={720}
            height={216}
            priority
            className="h-7 w-auto"
          />
          <p className="mt-4 text-[11px] font-display font-semibold uppercase tracking-[0.08em] text-white/45">
            Account setup
          </p>
        </div>

        <OnboardingStepTracker />

        <div className="mt-auto pt-10">
          <div className="flex items-start gap-2.5 text-white/55">
            <Icons.ShieldCheck size={18} className="shrink-0 mt-0.5 text-[var(--gold-300)]" />
            <p className="text-xs leading-relaxed">
              Your information is encrypted and stored securely. We comply with the NZ Privacy Act 2020.
            </p>
          </div>
        </div>
      </aside>

      {/* ── Main column ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen sm:min-h-0">
        {/* Mobile top bar */}
        <header className="sm:hidden sticky top-0 z-20 bg-surface-inverse px-4 h-14 flex items-center shrink-0">
          <Image
            src="/brand/terepay-wordmark-white.png"
            alt="TerePay"
            width={720}
            height={216}
            priority
            className="h-5 w-auto"
          />
        </header>

        <div className="sm:hidden">
          <OnboardingStepTracker />
        </div>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
