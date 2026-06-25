'use client';

import { useFormContext, useWatch, type UseFormRegister } from 'react-hook-form';
import type { TerepayApplicationInput } from '@/lib/validation/schemas';

const inputCls =
  'w-full px-3 py-2 border border-border-default rounded-md text-sm focus:ring-2 focus:ring-[var(--focus-ring)] focus:outline-none bg-surface-card';

function DebtRow({
  label,
  basePath,
  register,
}: {
  label: string;
  basePath: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
}) {
  return (
    <div className="grid grid-cols-12 gap-2 py-2 items-center border-b border-border-subtle last:border-0">
      <span className="col-span-12 sm:col-span-4 text-sm text-ink-strong">{label}</span>
      <div className="col-span-6 sm:col-span-4">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-disabled)]">$</span>
          <input
            type="number"
            min={0}
            step="0.01"
            defaultValue={0}
            placeholder="Total owed"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {...register(`${basePath}.totalOwed` as any, { valueAsNumber: true })}
            className={`${inputCls} pl-6`}
          />
        </div>
      </div>
      <div className="col-span-6 sm:col-span-4">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-disabled)]">$</span>
          <input
            type="number"
            min={0}
            step="0.01"
            defaultValue={0}
            placeholder="Fortnightly"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {...register(`${basePath}.fortnightlyPayment` as any, { valueAsNumber: true })}
            className={`${inputCls} pl-6`}
          />
        </div>
      </div>
    </div>
  );
}

export default function Step4ExistingDebts() {
  const { register, control } = useFormContext<TerepayApplicationInput>();

  const debts = useWatch({ control, name: 'existingDebts' });

  const safeNum = (v: unknown) => (typeof v === 'number' && !isNaN(v) ? v : 0);

  const totalOwed =
    safeNum(debts?.mortgage?.totalOwed) +
    safeNum(debts?.personalLoans?.totalOwed) +
    safeNum(debts?.carLoans?.totalOwed) +
    safeNum(debts?.creditCard?.totalOwed) +
    safeNum(debts?.bankOverdrafts?.totalOwed) +
    (debts?.otherLoans ?? []).reduce((a, l) => a + safeNum(l?.totalOwed), 0);

  const totalForthnightly =
    safeNum(debts?.mortgage?.fortnightlyPayment) +
    safeNum(debts?.personalLoans?.fortnightlyPayment) +
    safeNum(debts?.carLoans?.fortnightlyPayment) +
    safeNum(debts?.creditCard?.fortnightlyPayment) +
    safeNum(debts?.bankOverdrafts?.fortnightlyPayment) +
    (debts?.otherLoans ?? []).reduce((a, l) => a + safeNum(l?.fortnightlyPayment), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink-strong">Existing Debts &amp; Commitments</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Enter 0 if a debt type does not apply to you.
        </p>
      </div>

      <div className="bg-surface-sunken rounded-xl border border-border-default p-4">
        {/* Column headers */}
        <div className="grid grid-cols-12 gap-2 mb-2 pb-2 border-b border-border-default">
          <span className="col-span-12 sm:col-span-4 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
            Debt Type
          </span>
          <span className="hidden sm:block col-span-4 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
            Total Owed (NZD)
          </span>
          <span className="hidden sm:block col-span-4 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
            Fortnightly Payment
          </span>
        </div>

        <DebtRow label="Mortgage Payments" basePath="existingDebts.mortgage" register={register} />
        <DebtRow label="Personal Loans" basePath="existingDebts.personalLoans" register={register} />
        <DebtRow label="Car Loans" basePath="existingDebts.carLoans" register={register} />
        <DebtRow label="Credit Card" basePath="existingDebts.creditCard" register={register} />
        <DebtRow label="Bank Overdrafts" basePath="existingDebts.bankOverdrafts" register={register} />

        {/* Other loans (3 rows) */}
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid grid-cols-12 gap-2 py-2 items-center border-b border-border-subtle last:border-0">
            <div className="col-span-12 sm:col-span-4">
              <input
                {...register(`existingDebts.otherLoans.${i}.description`)}
                className={inputCls}
                placeholder={`Other Loan ${i + 1} (describe)`}
              />
            </div>
            <div className="col-span-6 sm:col-span-4">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-disabled)]">$</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={0}
                  placeholder="Total owed"
                  {...register(`existingDebts.otherLoans.${i}.totalOwed`, { valueAsNumber: true })}
                  className={`${inputCls} pl-6`}
                />
              </div>
            </div>
            <div className="col-span-6 sm:col-span-4">
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-disabled)]">$</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={0}
                  placeholder="Fortnightly"
                  {...register(`existingDebts.otherLoans.${i}.fortnightlyPayment`, {
                    valueAsNumber: true,
                  })}
                  className={`${inputCls} pl-6`}
                />
              </div>
            </div>
          </div>
        ))}

        {/* Totals row */}
        <div className="grid grid-cols-12 gap-2 pt-3 mt-1 border-t-2 border-border-default">
          <span className="col-span-12 sm:col-span-4 text-sm font-bold text-ink-strong">TOTAL</span>
          <span className="col-span-6 sm:col-span-4 px-3 py-2 bg-brand-soft text-brand-text font-bold text-sm rounded-md text-right">
            ${totalOwed.toFixed(2)}
          </span>
          <span className="col-span-6 sm:col-span-4 px-3 py-2 bg-brand-soft text-brand-text font-bold text-sm rounded-md text-right">
            ${totalForthnightly.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Debt purpose description */}
      <div>
        <label className="block text-sm font-medium text-ink-strong mb-1">
          Please help us understand your situation
        </label>
        <p className="text-xs text-[var(--text-muted)] mb-2">
          What are the purposes of the existing loans, and when will they be finishing?
        </p>
        <textarea
          rows={4}
          {...register('existingDebts.debtPurposeDescription')}
          className="w-full px-3 py-2.5 border border-border-default rounded-lg text-sm focus:ring-2 focus:ring-[var(--focus-ring)] focus:outline-none resize-none"
          placeholder="e.g. Car loan finishing in 18 months, credit card for emergency medical costs…"
        />
      </div>
    </div>
  );
}
