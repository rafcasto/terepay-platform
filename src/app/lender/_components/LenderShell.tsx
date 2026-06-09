'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import MobileBottomNav from '@/components/shared/MobileBottomNav';

const NAV_ITEMS = [
  { href: '/lender/dashboard', label: 'Dashboard' },
  { href: '/lender/applications', label: 'Applications' },
  { href: '/lender/customers', label: 'Customers' },
  { href: '/lender/portfolio', label: 'Portfolio' },
  { href: '/lender/settings', label: 'Settings' },
  { href: '/lender/profile', label: 'Profile' },
];

export default function LenderShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Affordability wizard has its own full-screen split-panel chrome — bypass lender nav
  if (pathname?.includes('/affordability')) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Mobile top header */}
      <header className="sm:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 h-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-[#F5A523]">TerePay</span>
          <span className="text-xs font-medium text-gray-400">Lender</span>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            Sign out
          </button>
        </form>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden sm:flex w-60 bg-white border-r border-gray-200 flex-col shrink-0">
          <div className="px-6 py-5 border-b border-gray-100">
            <span className="text-lg font-bold text-[#F5A523]">TerePay</span>
            <span className="ml-2 text-xs font-medium text-gray-400">Lender</span>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-[#FEF7E9] text-[#E08B00]'
                      : 'text-gray-700 hover:bg-[#FEF7E9] hover:text-[#E08B00]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="px-3 py-4 border-t border-gray-100">
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="w-full text-left px-3 py-2 text-sm font-medium text-gray-500 rounded-md hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                Sign Out
              </button>
            </form>
          </div>
        </aside>

        <main className="flex-1 overflow-auto pb-16 sm:pb-0">{children}</main>
      </div>

      <MobileBottomNav items={NAV_ITEMS} />
    </div>
  );
}
