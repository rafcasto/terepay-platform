'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import UserDrawer from './UserDrawer';

export default function ApplicantShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // During onboarding or loan application, render children only — those layouts provide their own chrome
  if (
    pathname?.startsWith('/applicant/onboarding') ||
    pathname?.startsWith('/applicant/apply')
  ) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Unified dark top navbar */}
      <header className="sticky top-0 z-20 bg-[#0D1B2A] px-4 sm:px-6 h-14 flex items-center justify-between shrink-0">
        <Link href="/applicant/dashboard" className="text-xl font-bold text-[#F5A523]">
          TerePay
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="text-white p-1.5 rounded-md hover:bg-white/10 transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <rect x="2" y="5" width="18" height="2" rx="1" fill="currentColor" />
            <rect x="2" y="10" width="18" height="2" rx="1" fill="currentColor" />
            <rect x="2" y="15" width="18" height="2" rx="1" fill="currentColor" />
          </svg>
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Slide-in user drawer */}
      <UserDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={user}
      />
    </div>
  );
}
