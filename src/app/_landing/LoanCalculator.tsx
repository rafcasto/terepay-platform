'use client';

import Link from 'next/link';
import { useState } from 'react';
import { computeRepayment, LOAN_INSTALMENTS, LOAN_MAX, LOAN_MIN } from '@/lib/loan/status-display';
import { fmtNZD, fmtNZDCompact } from '@/lib/loan/format';
import InterestDisclosure from './InterestDisclosure';

const DEFAULT_AMOUNT = 1000;

/**
 * Public repayment calculator. Uses the same `computeRepayment()` as the
 * application form and borrower dashboard so every surface quotes the same
 * figures: level fortnightly instalments on principal + interest, with the
 * application fee deducted from the cash paid out.
 */
export default function LoanCalculator({ ctaLabel, disclosure }: { ctaLabel: string; disclosure: string }) {
  const [amount, setAmount] = useState(DEFAULT_AMOUNT);
  const [existing, setExisting] = useState(false);
  const r = computeRepayment(amount, existing);

  const rows = [
    { label: 'Amount borrowed', value: fmtNZD(amount) },
    { label: 'Interest (49% p.a. over eight weeks)', value: fmtNZD(r.interest) },
    {
      label: existing ? 'Application fee' : 'Establishment fee (once only)',
      sub: 'Deducted from the amount paid to you',
      value: fmtNZD(r.fee),
    },
    { label: 'Amount paid to you', value: fmtNZD(r.amountReceived) },
    { label: `Fortnightly repayment (× ${LOAN_INSTALMENTS})`, value: fmtNZD(r.instalmentAmount) },
  ];

  return (
    <div className="mt-9 grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-start gap-5">
      {/* Inputs */}
      <div className="min-w-0 rounded-xl border border-border-default bg-[var(--surface-page)] p-[clamp(24px,3vw,32px)]">
        <div className="mb-[22px] flex flex-wrap gap-2" role="group" aria-label="Customer type">
          <button
            type="button"
            aria-pressed={!existing}
            onClick={() => setExisting(false)}
            className={`tp-btn tp-btn--sm${existing ? ' tp-btn--secondary' : ''}`}
          >
            New customer
          </button>
          <button
            type="button"
            aria-pressed={existing}
            onClick={() => setExisting(true)}
            className={`tp-btn tp-btn--sm${existing ? '' : ' tp-btn--secondary'}`}
          >
            Repeat customer
          </button>
        </div>

        <label htmlFor="tp-amount" className="block font-display text-[15px] font-semibold text-ink-strong">
          How much do you need?
        </label>
        <output htmlFor="tp-amount" className="mb-1 mt-2.5 block font-tabular text-[40px] font-semibold text-ink-strong">
          {fmtNZD(amount)}
        </output>
        <div className="text-[13px] text-ink-muted">
          Between {fmtNZDCompact(LOAN_MIN)} and {fmtNZDCompact(LOAN_MAX)}
        </div>
        <input
          id="tp-amount"
          type="range"
          min={LOAN_MIN}
          max={LOAN_MAX}
          step={50}
          value={amount}
          onChange={(e) => setAmount(Number(e.currentTarget.value))}
          aria-label="Loan amount"
          aria-valuetext={fmtNZD(amount)}
          className="mt-[18px] w-full accent-[var(--orange-600)]"
        />
        <div className="flex justify-between font-tabular text-xs text-ink-muted">
          <span>{fmtNZDCompact(LOAN_MIN)}</span>
          <span>{fmtNZDCompact(LOAN_MAX)}</span>
        </div>

        <div className="mt-[26px] flex flex-wrap gap-3 border-t border-border-default pt-[22px]">
          <div className="min-w-0 flex-[1_1_140px] rounded-[12px] border border-border-default bg-surface-card px-4 py-3.5">
            <div className="text-xs uppercase tracking-[.06em] text-ink-muted">Loan term</div>
            <div className="mt-1 font-display text-[17px] font-semibold text-ink-strong">Eight weeks</div>
          </div>
          <div className="min-w-0 flex-[1_1_140px] rounded-[12px] border border-border-default bg-surface-card px-4 py-3.5">
            <div className="text-xs uppercase tracking-[.06em] text-ink-muted">Interest rate</div>
            <div className="mt-1 font-display text-[17px] font-semibold text-ink-strong">49% p.a.</div>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="flex min-w-0 flex-col gap-3.5">
        <dl
          className="rounded-xl border border-border-default bg-surface-card p-[clamp(24px,3vw,32px)] shadow-md"
          aria-live="polite"
        >
          {rows.map((row, i) => (
            <div
              key={row.label}
              className={`flex justify-between gap-4 py-2.5 text-[15px] text-[var(--ink-800)]${
                i > 0 ? ' border-t border-border-subtle' : ''
              }`}
            >
              <dt>
                {row.label}
                {row.sub && <span className="mt-0.5 block text-xs text-ink-muted">{row.sub}</span>}
              </dt>
              <dd className="tp-num font-semibold text-ink-strong">{row.value}</dd>
            </div>
          ))}
          <div className="mt-2 flex justify-between gap-4 border-t-2 border-[var(--ink-900)] pt-4 font-display text-[17px] font-bold text-ink-strong">
            <dt>Total to repay</dt>
            <dd className="tp-num">{fmtNZD(r.totalRepayable)}</dd>
          </div>
        </dl>

        <Link href="/auth/signup" className="tp-btn tp-btn--accent tp-btn--lg tp-btn--block">
          {ctaLabel}
        </Link>

        <InterestDisclosure>{disclosure}</InterestDisclosure>
      </div>
    </div>
  );
}
