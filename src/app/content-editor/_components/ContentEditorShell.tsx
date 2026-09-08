'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import RoleSwitcher from '@/components/shared/RoleSwitcher';
import { CONTENT_NAV, type ContentNavItem } from '@/lib/content/pages';

const BASE = '/content-editor';

const hrefFor = (slug: string) => `${BASE}/${slug}`;

function isActivePath(pathname: string | null, slug: string) {
  return pathname === hrefFor(slug);
}

function NavLeaf({
  slug,
  label,
  pathname,
  nested = false,
}: {
  slug: string;
  label: string;
  pathname: string | null;
  nested?: boolean;
}) {
  const active = isActivePath(pathname, slug);
  return (
    <Link
      href={hrefFor(slug)}
      className={[
        'flex items-center rounded-lg text-sm font-medium transition-colors',
        nested ? 'py-1.5 pl-9 pr-3 text-[13px]' : 'px-3 py-2',
        active ? 'bg-[#F59A1E]/15 text-[#F59A1E]' : 'text-slate-300 hover:bg-white/8 hover:text-white',
      ].join(' ')}
    >
      {label}
    </Link>
  );
}

function NavParent({ item, pathname }: { item: ContentNavItem; pathname: string | null }) {
  const children = item.children ?? [];
  const hasActiveChild = children.some((c) => isActivePath(pathname, c.slug));
  const [open, setOpen] = useState(hasActiveChild);
  const expanded = open || hasActiveChild;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={expanded}
        className={[
          'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          hasActiveChild ? 'text-white' : 'text-slate-300 hover:bg-white/8 hover:text-white',
        ].join(' ')}
      >
        <span>{item.label}</span>
        <svg
          className={`h-4 w-4 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {expanded && (
        <div className="mt-0.5 space-y-0.5 border-l border-white/10 ml-4">
          {children.map((c) => (
            <NavLeaf key={c.slug} slug={c.slug} label={c.label} pathname={pathname} nested />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarNav({ pathname }: { pathname: string | null }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
      <NavLeaf slug="dashboard" label="Overview" pathname={pathname} />
      {CONTENT_NAV.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) =>
              item.children ? (
                <NavParent key={item.label} item={item} pathname={pathname} />
              ) : (
                <NavLeaf key={item.slug} slug={item.slug!} label={item.label} pathname={pathname} />
              ),
            )}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function ContentEditorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F6F8FB] flex flex-col">
      {/* Mobile top header */}
      <header className="sm:hidden sticky top-0 z-20 bg-[#0F1D2E] px-4 h-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
            className="text-slate-300 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <span className="text-sm font-bold text-[#F59A1E]">TerePay</span>
          <span className="text-xs font-medium text-slate-400">Content</span>
        </div>
        <div className="flex items-center gap-2">
          <RoleSwitcher variant="dark" />
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-xs text-slate-400 hover:text-white transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {mobileOpen && (
        <div className="sm:hidden bg-[#0F1D2E] border-b border-white/10" onClick={() => setMobileOpen(false)}>
          <SidebarNav pathname={pathname} />
        </div>
      )}

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden sm:flex w-64 bg-[#0F1D2E] flex-col shrink-0">
          <div className="px-6 py-5 border-b border-white/10">
            <Image
              src="/brand/terepay-logo-white.png"
              alt="TerePay"
              width={120}
              height={30}
              className="h-7 w-auto"
            />
            <span className="mt-1 block text-xs font-semibold text-[#F59A1E] tracking-wide uppercase">
              Content Editor
            </span>
          </div>

          <SidebarNav pathname={pathname} />

          <div className="px-3 pb-4 space-y-0.5 border-t border-white/10 pt-3">
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-red-500/15 hover:text-red-400 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
                Sign Out
              </button>
            </form>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Desktop top bar with portal switcher */}
          <header className="hidden sm:flex h-[60px] shrink-0 items-center justify-between border-b border-[var(--border-default)] bg-white px-6">
            <span className="font-display text-[17px] font-semibold text-[#16263B]">Content management</span>
            <RoleSwitcher />
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
