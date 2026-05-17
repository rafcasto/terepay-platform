'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { TopBar } from '@/components/ui';
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
    <div className="min-h-screen bg-bg flex flex-col">
      <TopBar onMenuClick={() => setDrawerOpen(true)} />

      <main className="flex-1 overflow-auto screen-in">{children}</main>

      <UserDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={user}
      />
    </div>
  );
}
