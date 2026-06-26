'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { TopBar } from '@/components/ui';
import UserDrawer from './UserDrawer';
import ApplicantSidebar from './ApplicantSidebar';
import BottomTabBar from './BottomTabBar';

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
    <div className="min-h-screen bg-bg flex">
      {/* Desktop: persistent sidebar nav */}
      <ApplicantSidebar user={user} />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile: top bar + hamburger drawer */}
        <div className="lg:hidden">
          <TopBar onMenuClick={() => setDrawerOpen(true)} />
        </div>

        <main className="flex-1 screen-in">{children}</main>
      </div>

      <UserDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={user}
      />

      {/* Mobile: fixed bottom tab bar */}
      <BottomTabBar />
    </div>
  );
}
