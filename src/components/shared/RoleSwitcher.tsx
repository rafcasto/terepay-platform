'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types/user';

const PORTALS: { role: UserRole; label: string; dashboard: string }[] = [
  { role: 'lender', label: 'Lender', dashboard: '/lender/dashboard' },
  { role: 'content_editor', label: 'Content Editor', dashboard: '/content-editor/dashboard' },
  { role: 'admin', label: 'Admin', dashboard: '/admin/dashboard' },
  { role: 'applicant', label: 'Borrower', dashboard: '/applicant/dashboard' },
];

function currentPortalRole(pathname: string): UserRole | null {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/lender')) return 'lender';
  if (pathname.startsWith('/content-editor')) return 'content_editor';
  if (pathname.startsWith('/applicant')) return 'applicant';
  return null;
}

/**
 * Portal switcher for users who hold more than one portal role. Renders nothing
 * for single-portal users. Designed to sit in the top-right of a portal shell.
 */
export default function RoleSwitcher({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const { user } = useAuth();
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const roles = user?.roles ?? [];
  const available = PORTALS.filter((p) => roles.includes(p.role));

  // Only useful when the user can reach more than one portal.
  if (available.length < 2) return null;

  const activeRole = currentPortalRole(pathname);
  const active = available.find((p) => p.role === activeRole) ?? available[0];

  const isDark = variant === 'dark';

  const go = (dashboard: string) => {
    setOpen(false);
    router.push(dashboard);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-[10px] border px-3 py-2 text-sm font-medium transition-colors ${
          isDark
            ? 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
            : 'border-[var(--border-default)] bg-white text-[var(--text-body)] hover:bg-[var(--surface-sunken)]'
        }`}
      >
        <svg className="h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
        <span className="whitespace-nowrap">{active.label}</span>
        <svg className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--border-default)] bg-white shadow-lg"
        >
          <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Switch portal
          </p>
          {available.map((p) => {
            const isActive = p.role === active.role;
            return (
              <button
                key={p.role}
                type="button"
                role="menuitem"
                onClick={() => go(p.dashboard)}
                className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-[#F5A523]/10 font-semibold text-[#B45600]'
                    : 'text-[var(--text-body)] hover:bg-slate-50'
                }`}
              >
                {p.label}
                {isActive && (
                  <svg className="h-4 w-4 text-[#B45600]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
