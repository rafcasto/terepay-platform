'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Pill } from '@/components/ui';
import { APPLICANT_NAV } from './applicant-nav';

type SidebarUser = {
  firstName: string;
  lastName: string;
  email: string;
} | null;

export default function ApplicantSidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname() ?? '';

  const initials = user
    ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
    : '?';
  const fullName = user ? `${user.firstName} ${user.lastName}` : '';
  const email = user?.email ?? '';

  return (
    <aside className="hidden lg:flex sticky top-0 h-screen w-[260px] shrink-0 flex-col bg-surface-inverse text-white px-4 py-6">
      <Link href="/applicant/dashboard" aria-label="TerePay" className="flex items-center px-2 mb-2">
        <Image
          src="/brand/terepay-wordmark-white.png"
          alt="TerePay"
          width={720}
          height={216}
          priority
          className="h-6 w-auto"
        />
      </Link>

      <nav className="mt-6 flex flex-col gap-1">
        {APPLICANT_NAV.map((item) => {
          const isActive = item.match ? pathname.startsWith(item.match) : false;
          if (item.href) {
            return (
              <Link
                key={item.label}
                href={item.href}
                className={[
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[color-mix(in_srgb,var(--orange-500)_16%,transparent)] text-white'
                    : 'text-white/65 hover:bg-white/[0.06] hover:text-white',
                ].join(' ')}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.Icon size={19} className={isActive ? 'text-[var(--gold-300)]' : 'text-white/55'} />
                {item.label}
              </Link>
            );
          }
          return (
            <div
              key={item.label}
              aria-disabled="true"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/35 cursor-default"
            >
              <item.Icon size={19} className="text-white/30" />
              <span className="flex-1">{item.label}</span>
              <Pill tone="muted" onInk>
                Soon
              </Pill>
            </div>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-[13px] font-bold text-white/90">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white/90 truncate">{fullName}</p>
            <p className="text-[12px] text-white/45 truncate">{email}</p>
          </div>
        </div>
        <form action="/api/auth/logout" method="POST" className="mt-1 px-2">
          <button
            type="submit"
            className="flex items-center gap-2 text-sm text-white/55 hover:text-white transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M10.5 5L14 8l-3.5 3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Log out
          </button>
        </form>
      </div>
    </aside>
  );
}
