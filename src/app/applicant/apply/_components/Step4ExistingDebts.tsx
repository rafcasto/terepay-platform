'use client';

import { useState } from 'react';
import { useFormContext, useWatch, type UseFormRegister } from 'react-hook-form';
import type { TerepayApplicationInput } from '@/lib/validation/schemas';
import { Toggle } from '@/components/ui';

const inputCls =
  'w-full pl-7 pr-3 h-11 border border-border-default rounded-xl text-sm focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-brand focus:outline-none transition-colors bg-surface-card text-ink-strong';
const textCls =
  'w-full px-3 h-11 border border-border-default rounded-xl text-sm focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-brand focus:outline-none transition-colors bg-surface-card text-ink-strong placeholder:text-[var(--text-disabled)]';
const miniLabel = 'block text-[11px] font-medium text-[var(--text-muted)] mb-1';

const money = (n: number) => `$${n.toFixed(2)}`;

const DEBT_KEYS = ['mortgage', 'personalLoans', 'carLoans', 'creditCard', 'bankOverdrafts'] as const;

function MoneyField({
  label,
  fieldName,
  register,
}: {
  label: string;
  fieldName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
}) {
  return (
    <div>
      <label className={miniLabel}>{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-disabled)]">$</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          defaultValue={0}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {...register(fieldName as any, { valueAsNumber: true })}
          onFocus={(ev) => ev.currentTarget.select()}
          className={inputCls}
        />
      </div>
    </div>
  );
}

function DebtBlock({
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
    <div className="py-3 border-b border-border-subtle last:border-0">
      <p className="text-sm font-medium text-ink-strong mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <MoneyField label="Total owed" fieldName={`${basePath}.totalOwed`} register={register} />
        <MoneyField label="Fortnightly payment" fieldName={`${basePath}.fortnightlyPayment`} register={register} />
      </div>
    </div>
  );
}

export default function Step4ExistingDebts() {
  const { register, control, setValue } = useFormContext<TerepayApplicationInput>();

  const debts = useWatch({ control, name: 'existingDebts' });
  const safeNum = (v: unknown) => (typeof v === 'number' && !isNaN(v) ? v : 0);

  const totalOwed =
    safeNum(debts?.mortgage?.totalOwed) +
    safeNum(debts?.personalLoans?.totalOwed) +
    safeNum(debts?.carLoans?.totalOwed) +
    safeNum(debts?.creditCard?.totalOwed) +
    safeNum(debts?.bankOverdrafts?.totalOwed) +
    (debts?.otherLoans ?? []).reduce((a, l) => a + safeNum(l?.totalOwed), 0);

  const totalFortnightly =
    safeNum(debts?.mortgage?.fortnightlyPayment) +
    safeNum(debts?.personalLoans?.fortnightlyPayment) +
    safeNum(debts?.carLoans?.fortnightlyPayment) +
    safeNum(debts?.creditCard?.fortnightlyPayment) +
    safeNum(debts?.bankOverdrafts?.fortnightlyPayment) +
    (debts?.otherLoans ?? []).reduce((a, l) => a + safeNum(l?.fortnightlyPayment), 0);

  // null = auto (reveal when a resumed draft already has values); true/false = user choice.
  const [override, setOverride] = useState<boolean | null>(null);
  const hasDebts = override ?? totalOwed + totalFortnightly > 0;

  const toggleDebts = (v: boolean) => {
    setOverride(v);
    if (!v) {
      DEBT_KEYS.forEach((k) => {
        setValue(`existingDebts.${k}.totalOwed`, 0);
        setValue(`existingDebts.${k}.fortnightlyPayment`, 0);
      });
      [0, 1, 2].forEach((i) => {
        setValue(`existingDebts.otherLoans.${i}.description`, '');
        setValue(`existingDebts.otherLoans.${i}.totalOwed`, 0);
        setValue(`existingDebts.otherLoans.${i}.fortnightlyPayment`, 0);
      });
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-ink-strong">Existing Debts &amp; Commitments</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Tell us about loans or repayments you already have, so we can check this loan is affordable.
        </p>
      </div>

      <div className="rounded-xl border border-border-default p-4">
        <Toggle
          checked={hasDebts}
          onChange={toggleDebts}
          label="Do you have any existing debts or repayments?"
          description="Mortgage, personal or car loans, credit cards, overdrafts, BNPL, etc."
        />
      </div>

      {hasDebts && (
        <>
          <div className="bg-surface-sunken rounded-xl border border-border-default p-4">
            <DebtBlock label="Mortgage" basePath="existingDebts.mortgage" register={register} />
            <DebtBlock label="Personal loans" basePath="existingDebts.personalLoans" register={register} />
            <DebtBlock label="Car loans" basePath="existingDebts.carLoans" register={register} />
            <DebtBlock label="Credit card" basePath="existingDebts.creditCard" register={register} />
            <DebtBlock label="Bank overdrafts" basePath="existingDebts.bankOverdrafts" register={register} />

            {/* Other loans */}
            <div className="pt-3 mt-1 border-t border-border-default space-y-4">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Other loans (optional)</p>
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <input
                    {...register(`existingDebts.otherLoans.${i}.description`)}
                    className={textCls + ' mb-2'}
                    placeholder={`Other loan ${i + 1} — describe (e.g. store card)`}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <MoneyField label="Total owed" fieldName={`existingDebts.otherLoans.${i}.totalOwed`} register={register} />
                    <MoneyField label="Fortnightly payment" fieldName={`existingDebts.otherLoans.${i}.fortnightlyPayment`} register={register} />
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="grid grid-cols-2 gap-3 pt-4 mt-3 border-t-2 border-border-default">
              <div>
                <p className={miniLabel}>Total owed</p>
                <div className="px-3 py-2.5 bg-brand-soft text-brand-text font-bold text-sm rounded-xl text-right font-tabular">
                  {money(totalOwed)}
                </div>
              </div>
              <div>
                <p className={miniLabel}>Total fortnightly</p>
                <div className="px-3 py-2.5 bg-brand-soft text-brand-text font-bold text-sm rounded-xl text-right font-tabular">
                  {money(totalFortnightly)}
                </div>
              </div>
            </div>
          </div>

          {/* Debt purpose description */}
          <div>
            <label className="block text-sm font-semibold text-ink-strong mb-1">
              Help us understand your situation
            </label>
            <p className="text-xs text-[var(--text-muted)] mb-2">
              What are these loans for, and when will they finish?
            </p>
            <textarea
              rows={4}
              {...register('existingDebts.debtPurposeDescription')}
              className="w-full px-3 py-2.5 border border-border-default rounded-xl text-sm focus:ring-2 focus:ring-[var(--focus-ring)] focus:outline-none resize-none bg-surface-card"
              placeholder="e.g. Car loan finishing in 18 months, credit card for emergency medical costs…"
            />
          </div>
        </>
      )}
    </div>
  );
}
