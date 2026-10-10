'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Icons, Pill } from '@/components/ui';
import { APPLICANT_NAV } from './applicant-nav';

type DrawerUser = {
  firstName: string;
  lastName: string;
  email: string;
} | null;

interface UserDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: DrawerUser;
}

export default function UserDrawer({ isOpen, onClose, user }: UserDrawerProps) {
  if (!isOpen) return null;

  const initials = user
    ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
    : '?';
  const fullName = user ? `${user.firstName} ${user.lastName}` : '';
  const email = user?.email ?? '';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div className="fixed top-0 right-0 z-50 h-full w-72 bg-white flex flex-col shadow-xl">
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-2">
          <Image
            src="/brand/terepay-wordmark.png"
            alt="TerePay"
            width={720}
            height={216}
            className="h-5 w-auto"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="p-1.5 rounded-md text-muted hover:bg-surface-2 transition-colors"
          >
            <Icons.X size={18} />
          </button>
        </div>

        {/* User info */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border-2">
          <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-white">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text truncate">{fullName}</p>
            <p className="text-xs text-muted truncate">{email}</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {APPLICANT_NAV.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text hover:bg-surface-2 transition-colors"
              >
                <item.Icon size={18} className="shrink-0 text-muted/70" />
                <div className="min-w-0">
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-muted/70 truncate">{item.description}</p>
                </div>
              </Link>
            ) : (
              <div
                key={item.label}
                aria-disabled="true"
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm opacity-55 cursor-default"
              >
                <item.Icon size={18} className="shrink-0 text-muted/70" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text">{item.label}</p>
                  <p className="text-xs text-muted/70 truncate">{item.description}</p>
                </div>
                <Pill tone="muted">Soon</Pill>
              </div>
            )
          )}
        </nav>

        {/* Sign out */}
        <div className="px-5 py-4 border-t border-border-2">
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-2 text-sm text-danger hover:text-danger transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M10.5 5L14 8l-3.5 3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sign out
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
