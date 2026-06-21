'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import MobileBottomNav from '@/components/shared/MobileBottomNav';
import ConsoleIcon, { type ConsoleIconName } from '@/components/lender/ConsoleIcon';

type NavItem = { href: string; label: string; icon: ConsoleIconName };

const NAV_ITEMS: NavItem[] = [
  { href: '/lender/dashboard', label: 'Dashboard', icon: 'gauge' },
  { href: '/lender/applications', label: 'Applications', icon: 'inbox' },
  { href: '/lender/customers', label: 'Customers', icon: 'users' },
  { href: '/lender/portfolio', label: 'Portfolio', icon: 'wallet' },
  { href: '/lender/settings', label: 'Settings', icon: 'sliders' },
  { href: '/lender/profile', label: 'Profile', icon: 'user' },
];

// Breadcrumb title + subtitle per route.
const CRUMBS: { match: (p: string) => boolean; t: string; sub: string }[] = [
  { match: (p) => /^\/lender\/applications\/[^/]+\/affordability/.test(p), t: 'Affordability assessment', sub: 'Responsible-lending review' },
  { match: (p) => /^\/lender\/applications\/[^/]+$/.test(p), t: 'Loan review', sub: 'KYC · credit · affordability · decision' },
  { match: (p) => p.startsWith('/lender/applications/new'), t: 'New application', sub: 'Create a loan application' },
  { match: (p) => p.startsWith('/lender/applications'), t: 'Applications', sub: 'Loan application worklist' },
  { match: (p) => p.startsWith('/lender/dashboard'), t: 'Dashboard', sub: 'Pipeline health & activity' },
  { match: (p) => p.startsWith('/lender/customers'), t: 'Customers', sub: 'Manage customer accounts' },
  { match: (p) => p.startsWith('/lender/portfolio'), t: 'Portfolio', sub: 'Active loans' },
  { match: (p) => p.startsWith('/lender/benchmarks'), t: 'Benchmarks', sub: 'Expense benchmark catalog' },
  { match: (p) => p.startsWith('/lender/settings'), t: 'Settings', sub: 'Account & integrations' },
  { match: (p) => p.startsWith('/lender/profile'), t: 'Profile', sub: 'Your lender account' },
];

function crumbFor(pathname: string) {
  return CRUMBS.find((c) => c.match(pathname)) ?? { t: 'TerePay', sub: '' };
}

export default function LenderShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const [collapsed, setCollapsed] = useState(false);

  // Affordability wizard has its own full-screen split-panel chrome — bypass lender nav.
  if (pathname.includes('/affordability')) {
    return <>{children}</>;
  }

  const crumb = crumbFor(pathname);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--surface-page)]">
      {/* Mobile top header */}
      <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.07)] bg-[var(--ink-950)] px-4 sm:hidden">
        <div className="flex items-center gap-2">
          <span className="font-display text-lg font-bold text-white">
            Tere<span className="text-[var(--orange-500)]">Pay</span>
          </span>
          <span className="text-xs font-medium text-[#7f91a6]">Lender</span>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" className="text-sm text-[#aab8c8] transition-colors hover:text-white">
            Sign out
          </button>
        </form>
      </header>

      <div className="flex flex-1">
        {/* Desktop console sidebar */}
        <aside
          className={`hidden shrink-0 flex-col bg-[var(--ink-950)] text-[#cdd7e3] transition-[width] duration-200 sm:flex ${
            collapsed ? 'w-[74px]' : 'w-[248px]'
          }`}
        >
          {/* Brand */}
          <div className="flex h-[60px] shrink-0 items-center gap-3 border-b border-[rgba(255,255,255,0.07)] px-[18px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/terepay-mark-white.png"
              alt=""
              width={30}
              height={30}
              className="h-[30px] w-[30px] shrink-0 object-contain"
            />
            {!collapsed && (
              <span className="whitespace-nowrap font-display text-[19px] font-bold tracking-[-0.01em] text-white">
                Tere<span className="text-[var(--orange-500)]">Pay</span>
              </span>
            )}
          </div>

          {/* Role label */}
          {!collapsed && (
            <div className="px-[18px] pb-2 pt-4 text-[11px] font-bold uppercase tracking-[0.11em] text-[#5f7187]">
              Lender console
            </div>
          )}

          {/* Nav */}
          <nav className="flex flex-1 flex-col gap-[3px] overflow-y-auto px-3 py-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`flex h-[42px] w-full items-center gap-3 whitespace-nowrap rounded-[10px] px-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--orange-500)] font-semibold text-[var(--ink-950)]'
                      : 'text-[#aab8c8] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#eaf0f7]'
                  }`}
                >
                  <ConsoleIcon
                    name={item.icon}
                    size={19}
                    className={`shrink-0 ${isActive ? 'text-[var(--ink-900)]' : 'text-[#7f91a6]'}`}
                  />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="shrink-0 border-t border-[rgba(255,255,255,0.07)] p-3">
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                title="Sign out"
                className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-[#aab8c8] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-[#eaf0f7] ${
                  collapsed ? 'justify-center' : ''
                }`}
              >
                <ConsoleIcon name="logout" size={18} className="shrink-0 text-[#7f91a6]" />
                {!collapsed && <span>Sign out</span>}
              </button>
            </form>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Desktop top bar */}
          <header className="z-20 hidden h-[60px] shrink-0 items-center gap-4 border-b border-[var(--border-default)] bg-white px-[22px] sm:flex">
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label="Toggle sidebar"
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border border-[var(--border-default)] bg-white text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-body)]"
            >
              <ConsoleIcon name={collapsed ? 'chevRight' : 'chevLeft'} size={18} />
            </button>

            <div className="flex min-w-0 items-center gap-2">
              <span className="whitespace-nowrap font-display text-[17px] font-semibold text-[var(--text-strong)]">
                {crumb.t}
              </span>
              {crumb.sub && (
                <>
                  <span className="text-[var(--slate-300)]">·</span>
                  <span className="truncate text-[13.5px] text-[var(--text-muted)]">{crumb.sub}</span>
                </>
              )}
            </div>

            <label className="ml-2 flex h-[38px] max-w-[380px] flex-1 items-center gap-2.5 rounded-[10px] border border-transparent bg-[var(--surface-sunken)] px-3 text-[var(--text-muted)] focus-within:border-[var(--orange-400)] focus-within:bg-white">
              <ConsoleIcon name="search" size={18} />
              <input
                placeholder="Search applications, borrowers…"
                aria-label="Search"
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[var(--text-body)] outline-none"
              />
            </label>

            <div className="flex-1" />

            <button
              type="button"
              aria-label="Notifications"
              className="relative flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] border border-[var(--border-default)] bg-white text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-body)]"
            >
              <ConsoleIcon name="bell" size={18} />
              <span className="absolute right-[9px] top-2 h-[7px] w-[7px] rounded-full border-[1.5px] border-white bg-[var(--orange-500)]" />
            </button>
          </header>

          <main className="flex-1 overflow-auto pb-16 sm:pb-0">{children}</main>
        </div>
      </div>

      <MobileBottomNav items={NAV_ITEMS} />
    </div>
  );
}
