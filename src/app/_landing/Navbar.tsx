'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { MenuIcon, XIcon } from './icons';

const NAV_LINKS = [
  { label: "What it's for", href: '#uses' },
  { label: 'Repayments', href: '#calculator' },
  { label: 'How to apply', href: '#apply' },
  { label: 'FAQ', href: '#faq' },
];

const linkCls =
  'text-sm font-medium text-[rgba(234,240,247,0.82)] transition-colors duration-[120ms] hover:text-white';

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[rgba(11,22,35,0.92)] backdrop-blur-[10px]">
      <div className="mx-auto flex max-w-[1180px] items-center gap-7 px-6 py-3.5">
        <Link href="/" aria-label="TerePay home" className="flex items-center gap-2">
          <Image
            src="/brand/terepay-mark-white.png"
            alt=""
            width={480}
            height={418}
            priority
            className="h-[30px] w-auto"
          />
          <Image
            src="/brand/terepay-wordmark-white.png"
            alt="TerePay"
            width={720}
            height={216}
            priority
            className="h-[22px] w-auto"
          />
        </Link>

        <nav aria-label="Main navigation" className="ml-auto hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className={linkCls}>
              {l.label}
            </a>
          ))}
          <Link href="/auth/login" className={linkCls}>
            Sign in
          </Link>
          <Link href="/auth/signup" className="tp-btn tp-btn--accent">
            Join Now
          </Link>
        </nav>

        <button
          type="button"
          className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-md text-white/85 transition-colors duration-[120ms] hover:bg-white/10 hover:text-white md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="landing-mobile-nav"
        >
          {open ? <XIcon size={22} strokeWidth={2} /> : <MenuIcon size={22} strokeWidth={2} />}
        </button>
      </div>

      {open && (
        <nav
          id="landing-mobile-nav"
          aria-label="Main navigation"
          className="flex flex-col gap-4 border-t border-white/10 px-6 py-5 md:hidden"
        >
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className={linkCls} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <hr className="border-white/10" />
          <Link href="/auth/login" className={linkCls}>
            Sign in
          </Link>
          <Link href="/auth/signup" className="tp-btn tp-btn--accent tp-btn--block">
            Join Now
          </Link>
        </nav>
      )}
    </header>
  );
}
