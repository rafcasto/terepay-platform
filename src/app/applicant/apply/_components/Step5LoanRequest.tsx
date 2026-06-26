'use client';

import { useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { TerepayApplicationInput } from '@/lib/validation/schemas';
import { LOAN_PURPOSES } from '@/lib/constants/loan-purposes';
import {
  APPLICATION_FEE_NEW,
  APPLICATION_FEE_EXISTING,
  LOAN_INTEREST_RATE,
  computeApplicationFee,
} from '@/lib/constants/fees';
import { LOAN_MIN, LOAN_MAX } from '@/lib/loan/status-display';
import { RangeSlider, QuickAmounts } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';

const inputCls =
  'w-full px-3 h-11 border border-border-default rounded-xl text-sm focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-brand focus:outline-none transition-colors bg-surface-card text-ink-strong placeholder:text-[var(--text-disabled)]';
const selectCls = inputCls + ' appearance-none';
const labelCls = 'block text-sm font-semibold text-ink-strong mb-1.5';
const errorCls = 'mt-1.5 text-xs text-danger-text font-medium';

const QUICK_AMOUNTS = [200, 500, 1000, 1500, 2000];
const fmtNZD0 = (n: number) => `$${n.toLocaleString('en-NZ')}`;

const REMITTANCE_PURPOSES = [
  'Family support',
  'Medical expenses',
  'Education fees',
  'Mortgage/Rent',
  'Business support',
  'Savings/Investment',
  'Emergency fund',
  'Special occasions',
];

export default function Step5LoanRequest() {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<TerepayApplicationInput>();
  const { user } = useAuth();

  const e = errors.loanRequest;
  const isPEP = useWatch({ control, name: 'loanRequest.isPEP' });
  const remittanceFreq = useWatch({ control, name: 'loanRequest.remittance.frequency' });
  const amount = useWatch({ control, name: 'loanRequest.requestedAmount' });

  // Start at the minimum so the slider, field and estimate are consistent and
  // the borrower has a sensible, adjustable starting point.
  useEffect(() => {
    if (amount == null || Number.isNaN(Number(amount))) {
      setValue('loanRequest.requestedAmount', LOAN_MIN, { shouldDirty: false });
    }
  }, [amount, setValue]);

  const principal = Number(amount) || 0;
  const sliderValue = Math.min(Math.max(principal || LOAN_MIN, LOAN_MIN), LOAN_MAX);

  const setAmount = (n: number) =>
    setValue('loanRequest.requestedAmount', n, { shouldValidate: true, shouldDirty: true });

  // Estimate repayments: 4 fortnightly payments of (principal + 4.7% interest).
  // The application fee is deducted from the disbursement, NOT added to repayments.
  const interest = principal * LOAN_INTEREST_RATE;
  const estFee = computeApplicationFee(user?.isExistingCustomer);
  const totalRepayable = principal + interest;
  const fortnightlyPayment = totalRepayable / 4;
  const amountReceived = Math.max(principal - estFee, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink-strong">Loan Request</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">Tell us about the loan you need.</p>
      </div>

      {/* Requested amount — slider + quick picks + precise entry */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <label className={labelCls + ' mb-0'}>
            How much do you need? <span className="text-danger-text">*</span>
          </label>
          <span className="font-tabular text-lg font-bold text-ink-strong">{fmtNZD0(sliderValue)}</span>
        </div>

        <RangeSlider
          min={LOAN_MIN}
          max={LOAN_MAX}
          step={50}
          value={sliderValue}
          onChange={setAmount}
          formatLabel={fmtNZD0}
        />

        <div className="mt-4">
          <QuickAmounts amounts={QUICK_AMOUNTS} value={principal || null} onChange={setAmount} formatLabel={fmtNZD0} />
        </div>

        <div className="relative mt-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-disabled)]">$</span>
          <input
            type="number"
            inputMode="numeric"
            min={LOAN_MIN}
            max={LOAN_MAX}
            step={50}
            {...register('loanRequest.requestedAmount', { valueAsNumber: true })}
            onFocus={(ev) => ev.currentTarget.select()}
            className={inputCls + ' pl-7'}
            placeholder="Enter an exact amount"
          />
        </div>
        <p className="mt-1.5 text-xs text-[var(--text-muted)]">
          Borrow between {fmtNZD0(LOAN_MIN)} and {fmtNZD0(LOAN_MAX)}.
        </p>
        {e?.requestedAmount && <p className={errorCls}>{e.requestedAmount.message}</p>}
      </div>

      {/* Repayment estimate */}
      {principal >= LOAN_MIN && (
        <div className="bg-success-soft border border-[color-mix(in_srgb,var(--success-500)_25%,transparent)] rounded-xl p-4 space-y-1.5">
          <p className="text-xs font-semibold text-[var(--success-700)] uppercase tracking-wide">
            Estimated repayments
          </p>
          <p className="text-sm text-ink-strong">
            4 fortnightly payments of{' '}
            <span className="font-bold font-tabular">${fortnightlyPayment.toFixed(2)}</span>
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Total repayable ${totalRepayable.toFixed(2)} (principal + 4.7% interest over 8 weeks).
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            You&apos;ll receive{' '}
            <span className="font-semibold text-ink-strong">${amountReceived.toFixed(2)}</span> after the ${estFee}{' '}
            application fee is deducted. All loans are charged interest and fees.
          </p>
        </div>
      )}

      {/* Loan terms — key facts */}
      <details className="bg-brand-soft border border-brand/30 rounded-xl p-4">
        <summary className="text-xs font-bold text-brand-text uppercase tracking-wide cursor-pointer">
          Loan terms
        </summary>
        <div className="grid grid-cols-2 gap-3 text-xs text-ink-strong mt-3">
          <div><span className="font-semibold">Period:</span> 8 weeks (56 days)</div>
          <div><span className="font-semibold">Payments:</span> 4 × fortnightly</div>
          <div><span className="font-semibold">Interest:</span> 4.7% for 8 weeks</div>
          <div><span className="font-semibold">APR:</span> 49%</div>
          <div><span className="font-semibold">New customer fee:</span> ${APPLICATION_FEE_NEW}</div>
          <div><span className="font-semibold">Existing customer fee:</span> ${APPLICATION_FEE_EXISTING}</div>
        </div>
      </details>

      {/* Purpose */}
      <div>
        <label className={labelCls}>
          Purpose of Loan <span className="text-danger-text">*</span>
        </label>
        <select {...register('loanRequest.purpose')} className={selectCls}>
          <option value="">Select a purpose…</option>
          {LOAN_PURPOSES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {e?.purpose && <p className={errorCls}>{e.purpose.message}</p>}
      </div>

      {/* Purpose description */}
      <div>
        <label className={labelCls}>
          Please provide details <span className="text-danger-text">*</span>
        </label>
        <textarea
          rows={3}
          {...register('loanRequest.purposeDescription')}
          className="w-full px-3 py-2.5 border border-border-default rounded-lg text-sm focus:ring-2 focus:ring-[var(--focus-ring)] focus:outline-none resize-none"
          placeholder="Briefly explain the purpose of this loan…"
        />
        {e?.purposeDescription && <p className={errorCls}>{e.purposeDescription.message}</p>}
      </div>

      {/* Primary income source */}
      <div>
        <label className={labelCls}>
          Primary Source(s) of Income <span className="text-danger-text">*</span>
        </label>
        <input
          {...register('loanRequest.primaryIncomeSource')}
          className={inputCls}
          placeholder="e.g. Wages, WINZ, Self-employment"
        />
        {e?.primaryIncomeSource && <p className={errorCls}>{e.primaryIncomeSource.message}</p>}
      </div>

      {/* PEP */}
      <div className="bg-brand-soft border border-[var(--orange-500)]/40 rounded-xl p-4 space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            {...register('loanRequest.isPEP')}
            className="mt-0.5 h-4 w-4 rounded border-border-default text-brand-text focus:ring-[var(--focus-ring)]"
          />
          <span className="text-sm text-amber-900">
            I, or an immediate family member, am a{' '}
            <strong>Politically Exposed Person (PEP)</strong> — someone who holds a senior public role — or a close
            associate of one.
          </span>
        </label>
        {isPEP && (
          <div>
            <label className={labelCls}>Please provide details</label>
            <textarea
              rows={2}
              {...register('loanRequest.pepDetails')}
              className="w-full px-3 py-2.5 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none resize-none bg-surface-card"
              placeholder="Name, role, and relationship…"
            />
          </div>
        )}
      </div>

      {/* Remittance */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-ink-strong mb-1">Money you send overseas</h3>
          <p className="text-xs text-[var(--text-muted)]">
            Regular transfers abroad (remittances) help us understand your financial commitments.
          </p>
        </div>

        <div>
          <label className={labelCls}>
            How often do you send money overseas? <span className="text-danger-text">*</span>
          </label>
          <select {...register('loanRequest.remittance.frequency')} className={selectCls}>
            <option value="">Select…</option>
            <option value="weekly">Weekly</option>
            <option value="fortnightly">Fortnightly</option>
            <option value="monthly">Monthly</option>
            <option value="occasionally">Occasionally</option>
            <option value="never">I don&apos;t send money overseas</option>
          </select>
          {e?.remittance?.frequency && (
            <p className={errorCls}>{e.remittance.frequency.message}</p>
          )}
        </div>

        {remittanceFreq && remittanceFreq !== 'never' && (
          <>
            <div>
              <label className={labelCls}>
                Average amount per fortnight (NZD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-disabled)]">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  {...register('loanRequest.remittance.averageAmount', { valueAsNumber: true })}
                  onFocus={(ev) => ev.currentTarget.select()}
                  className={inputCls + ' pl-7'}
                  defaultValue={0}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Usual purpose(s) of remittance</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {REMITTANCE_PURPOSES.map((p) => (
                  <label key={p} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      value={p}
                      {...register('loanRequest.remittance.purposes')}
                      className="h-4 w-4 rounded border-border-default text-brand-text focus:ring-[var(--focus-ring)]"
                    />
                    <span className="text-sm text-ink-strong">{p}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
