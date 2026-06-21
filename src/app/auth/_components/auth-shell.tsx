import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { AuthIcon } from './auth-icons';

/* ---------------------------------------------------------------------------
   AuthShell — the split institutional layout from the design system handoff:
   an ink brand panel (trust signals + compliance) on the left, and a white
   form column on the right with a segmented sign-in / create-account toggle
   and the standard responsible-lending disclosure.
   --------------------------------------------------------------------------- */

type Mode = 'signin' | 'register';

const POLICIES = ['Disclosure statement', 'Rates & fees', 'Hardship', 'Dispute resolution'];

function Tick({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[15px] leading-snug text-[#cdd8e6]">
      <span className="mt-px inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full bg-[rgba(240,128,0,0.16)] text-[var(--orange-400)] [&_svg]:h-[15px] [&_svg]:w-[15px]">
        {AuthIcon.check}
      </span>
      <span>{children}</span>
    </li>
  );
}

function BrandPanel({ mode }: { mode: Mode }) {
  const isReg = mode === 'register';
  return (
    <aside className="relative hidden flex-col overflow-hidden bg-[var(--ink-900)] px-[52px] py-[46px] text-[#EAF0F7] lg:flex">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[140px] -top-[120px] h-[420px] w-[420px] rounded-full"
        style={{ background: 'radial-gradient(circle at center, rgba(240,128,0,0.20), rgba(240,128,0,0) 68%)' }}
      />

      <div className="flex flex-col gap-2.5">
        <Image
          src="/brand/terepay-logo-white.png"
          alt="TerePay"
          width={84}
          height={98}
          priority
          className="h-[92px] w-auto"
        />
        <span className="text-[13px] text-[#8295ab]">Borrowing power in your hands</span>
      </div>

      <div className="relative z-10 my-auto max-w-[440px] py-12">
        <span className="font-display text-[12px] font-semibold uppercase tracking-[0.09em] text-[var(--orange-400)]">
          Borrow now, pay later
        </span>
        <h2 className="mt-3.5 font-serif text-[38px] font-semibold leading-[1.12] tracking-tight text-white">
          {isReg ? (
            <>
              Open your account in <em className="italic text-[var(--gold-300)]">minutes</em>.
            </>
          ) : (
            <>
              Welcome back to <em className="italic text-[var(--gold-300)]">TerePay</em>.
            </>
          )}
        </h2>
        <p className="mt-[18px] text-[16px] leading-relaxed text-[#aebccd]">
          {isReg
            ? 'Join thousands of families across Aotearoa who use TerePay for support back home, urgent bills and life’s surprises — while staying in control.'
            : 'Sign in to check your application, track repayments and manage your loan. We’re here when life can’t wait.'}
        </p>
        <ul className="mt-[30px] flex list-none flex-col gap-4 p-0">
          <Tick>Decisions in 24&ndash;48 hours &mdash; same-day funds once your contract is signed.</Tick>
          <Tick>A responsible lender: we make reasonable checks the loan suits you.</Tick>
          <Tick>No hidden fees &mdash; interest and the admin fee are shown before you sign.</Tick>
        </ul>
      </div>

      <div className="relative z-10 border-t border-white/10 pt-5">
        <p className="text-[12.5px] leading-relaxed text-[#8295ab]">
          Your information is encrypted and stored securely. We comply with the NZ Privacy Act 2020. All loans are charged interest.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1.5">
          {POLICIES.map((p) => (
            <a key={p} href="#" className="whitespace-nowrap text-[12.5px] text-[#aebccd] hover:text-white hover:underline">
              {p}
            </a>
          ))}
        </div>
      </div>
    </aside>
  );
}

function toggleCls(active: boolean) {
  return [
    'flex-1 inline-flex h-[42px] items-center justify-center rounded-full font-display text-[14.5px] font-semibold transition-all',
    active
      ? 'bg-white text-[var(--text-strong)] shadow-[var(--shadow-sm)]'
      : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]',
  ].join(' ');
}

export function AuthShell({
  mode,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  mode: Mode;
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const isReg = mode === 'register';
  return (
    <div className="grid min-h-screen bg-[var(--surface-page)] lg:grid-cols-[1.05fr_0.95fr]">
      <BrandPanel mode={mode} />

      <div className="flex items-start justify-center px-5 py-10 sm:items-center sm:px-7 sm:py-12">
        <div className="w-full max-w-[424px]">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <Image
              src="/brand/terepay-mark.png"
              alt=""
              width={34}
              height={30}
              priority
              className="h-[30px] w-auto"
            />
            <Image
              src="/brand/terepay-wordmark.png"
              alt="TerePay"
              width={67}
              height={20}
              priority
              className="h-[20px] w-auto"
            />
          </div>

          <span className="font-display text-[13px] font-semibold uppercase tracking-wide text-[var(--text-accent)]">
            {eyebrow}
          </span>
          <h1 className="mt-1.5 font-display text-[28px] font-bold tracking-tight text-[var(--text-strong)]">{title}</h1>
          <p className="mt-2 text-[15px] leading-normal text-[var(--text-muted)]">{subtitle}</p>

          <div
            className="my-7 flex gap-1 rounded-full border border-[var(--border-default)] bg-[var(--slate-100)] p-1"
            role="tablist"
            aria-label="Authentication mode"
          >
            <Link href="/auth/login" role="tab" aria-selected={!isReg} className={toggleCls(!isReg)}>
              Sign in
            </Link>
            <Link href="/auth/signup" role="tab" aria-selected={isReg} className={toggleCls(isReg)}>
              Create account
            </Link>
          </div>

          {children}

          <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-[var(--orange-200)] bg-[var(--surface-brand-soft)] px-4 py-3.5">
            <span className="mt-px flex-none text-[var(--orange-700)] [&_svg]:h-[18px] [&_svg]:w-[18px]">{AuthIcon.info}</span>
            <p className="text-[13px] leading-snug text-[var(--orange-900)]">
              TerePay is a responsible lender. Applications can be <strong>declined</strong>. All loans are charged interest &mdash; see the Disclosure statement and Rates &amp; fees for the full cost.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
