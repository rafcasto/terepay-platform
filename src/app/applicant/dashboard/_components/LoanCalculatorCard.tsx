'use client';

import { useState } from 'react';
import { Card, CardHeader, RangeSlider, QuickAmounts, StatGrid, ButtonLink } from '@/components/ui';
import { computeRepayment, LOAN_MIN, LOAN_MAX, LOAN_INSTALMENTS } from '@/lib/loan/status-display';
import { fmtNZD, fmtNZDCompact } from '@/lib/loan/format';
import { APPLICATION_FEE_NEW, APPLICATION_FEE_EXISTING, TERM_INTEREST_RATE_PCT } from '@/lib/constants/fees';
import { DEFAULT_CONTENT, type ContentSectionValues } from '@/types/content';

const QUICK = [300, 500, 1000, 1500, 2000];

export default function LoanCalculatorCard({ content }: { content?: ContentSectionValues }) {
  const c = { ...DEFAULT_CONTENT['borrower.dashboard'], ...(content ?? {}) };
  const [amount, setAmount] = useState(500);
  const r = computeRepayment(amount);

  return (
    <Card>
      <CardHeader
        eyebrow={c.calculatorEyebrow}
        title={`Borrow ${fmtNZDCompact(amount)}`}
      />
      <div className="mt-5">
        <RangeSlider
          min={LOAN_MIN}
          max={LOAN_MAX}
          step={50}
          value={amount}
          onChange={setAmount}
          formatLabel={(n) => fmtNZDCompact(n)}
        />
      </div>
      <div className="mt-5">
        <QuickAmounts
          amounts={QUICK}
          value={QUICK.includes(amount) ? amount : null}
          onChange={setAmount}
          formatLabel={(n) => `$${n.toLocaleString('en-NZ')}`}
        />
      </div>

      <div className="mt-5">
        <StatGrid
          onInk={false}
          stats={[
            { label: 'Per fortnight', value: fmtNZD(r.instalmentAmount) },
            { label: 'Total repayable', value: fmtNZD(r.totalRepayable) },
          ]}
        />
      </div>

      <p className="mt-4 text-[12.5px] text-[var(--text-muted)] leading-relaxed">
        {LOAN_INSTALMENTS} fortnightly payments over 8 weeks. {TERM_INTEREST_RATE_PCT}% interest. All
        loans are charged interest; an establishment fee of {fmtNZD(APPLICATION_FEE_NEW)} applies to new
        customers, and an application fee of {fmtNZD(APPLICATION_FEE_EXISTING, { cents: false })} applies to
        repeat customers. {c.calculatorDisclaimer}
      </p>

      <div className="mt-5">
        <ButtonLink href="/applicant/apply" fullWidth>
          {c.calculatorCta}
        </ButtonLink>
      </div>
    </Card>
  );
}
