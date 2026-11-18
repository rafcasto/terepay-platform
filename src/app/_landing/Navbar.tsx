'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { MenuIcon, XIcon } from './icons';

// Section anchors are rooted at "/" so they work from any page that shows
// this navbar (e.g. the legal pages), not just the homepage.
const NAV_LINKS = [
  { label: "What it's for", href: '/#uses' },
  { label: 'Repayments', href: '/#calculator' },
  { label: 'How to apply', href: '/#apply' },
  { label: 'FAQ', href: '/#faq' },
];

const linkCls =
  'text-sm font-medium text-[rgba(234,240,247,0.82)] transition-colors duration-[120ms] hover:text-white';

/** Resolved server-side from the session cookie by the page that renders the navbar. */
export type NavbarViewer = {
  /** Dashboard for the viewer's role — see `getViewerSession()`. */
  dashboardHref: string;
};

type Props = {
  /** `null`/omitted → signed-out chrome (Sign in / Join Now). */
  viewer?: NavbarViewer | null;
};

/**
 * Signed-in users get a direct route to their portal and a sign-out action in
 * place of the sign-in / registration links, so the public pages reflect the
 * session instead of offering to log in again. Sign-out is a plain form POST:
 * `/api/auth/logout` clears the cookie and 303s back to the login page.
 */
function SignOutButton({ className, onClick }: { className: string; onClick?: () => void }) {
  return (
    <form method="post" action="/api/auth/logout" className="contents">
      <button type="submit" className={className} onClick={onClick}>
        Sign out
      </button>
    </form>
  );
}

export default function Navbar({ viewer = null }: Props) {
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
          {viewer ? (
            <>
              <SignOutButton className={linkCls} />
              <Link href={viewer.dashboardHref} className="tp-btn tp-btn--accent">
                My dashboard
              </Link>
            </>
          ) : (
            <>
              <Link href="/auth/login" className={linkCls}>
                Sign in
              </Link>
              <Link href="/auth/signup" className="tp-btn tp-btn--accent">
                Join Now
              </Link>
            </>
          )}
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
          {viewer ? (
            <>
              <SignOutButton className={`${linkCls} text-left`} onClick={() => setOpen(false)} />
              <Link
                href={viewer.dashboardHref}
                className="tp-btn tp-btn--accent tp-btn--block"
                onClick={() => setOpen(false)}
              >
                My dashboard
              </Link>
            </>
          ) : (
            <>
              <Link href="/auth/login" className={linkCls} onClick={() => setOpen(false)}>
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="tp-btn tp-btn--accent tp-btn--block"
                onClick={() => setOpen(false)}
              >
                Join Now
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
