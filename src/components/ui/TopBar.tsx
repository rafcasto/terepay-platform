'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { ArrowLeft, Menu } from './Icons';

interface TopBarProps {
  logoHref?: string;
  showBack?: boolean;
  backHref?: string;
  onMenuClick?: () => void;
  right?: ReactNode;
}

export function TopBar({
  logoHref = '/applicant/dashboard',
  showBack = false,
  backHref,
  onMenuClick,
  right,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 bg-surface-inverse h-14 px-4 sm:px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        {showBack && backHref && (
          <Link
            href={backHref}
            aria-label="Back"
            className="text-white/80 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
        )}
        <Link href={logoHref} aria-label="TerePay" className="flex items-center">
          <Image
            src="/brand/terepay-wordmark-white.png"
            alt="TerePay"
            width={720}
            height={216}
            priority
            className="h-5 w-auto"
          />
        </Link>
      </div>

      {right ?? (
        onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open menu"
            className="text-white p-1.5 rounded-md hover:bg-white/10 transition-colors"
          >
            <Menu size={22} />
          </button>
        )
      )}
    </header>
  );
}
