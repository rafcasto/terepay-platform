'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import MobileBottomNav from '@/components/shared/MobileBottomNav';

const NAV_ITEMS = [
  { href: '/applicant/dashboard', label: 'Dashboard' },
  { href: '/applicant/apply', label: 'Apply' },
  { href: '/applicant/applications', label: 'Applications' },
  { href: '/applicant/profile', label: 'Profile' },
];

export default function ApplicantShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // During onboarding, render children only — the onboarding layout provides its own chrome
  if (pathname?.startsWith('/applicant/onboarding')) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Mobile top header */}
      <header className="sm:hidden sticky top-0 z-20 bg-white border-b border-gray-200 px-4 h-12 flex items-center justify-between shrink-0">
        <Link href="/applicant/dashboard" className="text-lg font-bold text-[#F5A523]">
          TerePay
        </Link>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            Sign out
          </button>
        </form>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden sm:flex w-64 bg-white border-r border-gray-200 flex-col shrink-0">
          <div className="px-6 py-5 border-b border-gray-200">
            <Link href="/applicant/dashboard" className="text-xl font-bold text-[#F5A523]">
              TerePay
            </Link>
            <p className="text-xs text-gray-500 mt-0.5">Applicant Portal</p>
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-[#FEF7E9] hover:text-[#E08B00] transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="px-6 py-4 border-t border-gray-200">
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </aside>

        {/* Main content — extra bottom padding on mobile so bottom nav doesn't overlap */}
        <main className="flex-1 overflow-auto pb-16 sm:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav items={NAV_ITEMS} />
    </div>
  );
}
