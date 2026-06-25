'use client';

import { useState } from 'react';
import { Card, CardHeader, RangeSlider, QuickAmounts, StatGrid, ButtonLink } from '@/components/ui';
import { computeRepayment, LOAN_MIN, LOAN_MAX, LOAN_INSTALMENTS } from '@/lib/loan/status-display';
import { fmtNZD, fmtNZDCompact } from '@/lib/loan/format';

const QUICK = [300, 500, 1000, 1500, 2000];

export default function LoanCalculatorCard() {
  const [amount, setAmount] = useState(500);
  const r = computeRepayment(amount);

  return (
    <Card>
      <CardHeader
        eyebrow="Quick estimate"
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
        {LOAN_INSTALMENTS} fortnightly payments over 8 weeks. All loans are charged interest;
        includes an establishment fee of {fmtNZD(r.fee)}. Applications are subject to approval and
        affordability checks — final terms confirmed after assessment.
      </p>

      <div className="mt-5">
        <ButtonLink href="/applicant/apply" fullWidth>
          Continue to application
        </ButtonLink>
      </div>
    </Card>
  );
}
