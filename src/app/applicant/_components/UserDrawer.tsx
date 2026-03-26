'use client';

import Link from 'next/link';

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
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="text-lg font-bold text-[#F5A523]">TerePay</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M2 2l14 14M16 2L2 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* User info */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
          <div className="h-10 w-10 rounded-full bg-[#F5A523] flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-white">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{fullName}</p>
            <p className="text-xs text-gray-500 truncate">{email}</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-3 space-y-1">
          <Link
            href="/applicant/profile"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="shrink-0 text-gray-400">
              <circle cx="9" cy="6" r="3.25" stroke="currentColor" strokeWidth="1.5" />
              <path d="M2.5 15.5c0-3.314 2.91-6 6.5-6s6.5 2.686 6.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <div>
              <p className="font-medium">Profile</p>
              <p className="text-xs text-gray-400">Edit your personal details</p>
            </div>
          </Link>

          <button
            type="button"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="shrink-0 text-gray-400">
              <path d="M2 3.5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5" />
              <path d="M1 6.5l7.447 4.724a1 1 0 0 0 1.106 0L17 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <div>
              <p className="font-medium">Contact Support</p>
              <p className="text-xs text-gray-400">Chat with our team</p>
            </div>
          </button>
        </nav>

        {/* Sign out */}
        <div className="px-5 py-4 border-t border-gray-100">
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 transition-colors"
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
