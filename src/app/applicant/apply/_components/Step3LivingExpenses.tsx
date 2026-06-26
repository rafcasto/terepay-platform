'use client';

import { useState, type ReactNode } from 'react';
import { useFormContext, useWatch, type UseFormRegister } from 'react-hook-form';
import type { TerepayApplicationInput } from '@/lib/validation/schemas';
import { Icons, Toggle } from '@/components/ui';

const selectCls =
  'w-full px-3 h-11 border border-border-default rounded-xl text-sm focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-brand focus:outline-none transition-colors bg-surface-card text-ink-strong appearance-none';

const FREQ_OPTIONS = [
  { value: 'M', label: 'Monthly' },
  { value: 'F', label: 'Fortnightly' },
  { value: 'O', label: 'Occasionally' },
  { value: 'N/A', label: 'N/A' },
];

const SUB_KEYS = ['gym', 'netflix', 'spotify', 'sports', 'others'] as const;
const BNPL_KEYS = ['afterpay', 'klarna', 'zip'] as const;

const money = (n: number) => `$${n.toFixed(2)}`;

function NzdRow({
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
    <div className="flex items-center gap-3 py-2 border-b border-border-subtle last:border-0">
      <span className="text-sm text-[var(--text-muted)] flex-1">{label}</span>
      <div className="relative w-32 shrink-0">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-disabled)]">$</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          defaultValue={0}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {...register(fieldName as any, { valueAsNumber: true })}
          onFocus={(ev) => ev.currentTarget.select()}
          className="w-full pl-6 pr-2 py-2 border border-border-default rounded-md text-sm focus:ring-2 focus:ring-[var(--focus-ring)] focus:outline-none bg-surface-card"
        />
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  hint,
  subtotal,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  subtotal: number;
  open: string | null;
  onToggle: (id: string | null) => void;
  children: ReactNode;
}) {
  const isOpen = open === id;
  return (
    <div className="rounded-xl border border-border-default overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(isOpen ? null : id)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 bg-surface-sunken text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-strong">{title}</p>
          {hint && <p className="text-xs text-[var(--text-muted)] mt-0.5">{hint}</p>}
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="font-tabular text-sm font-bold text-brand-text">{money(subtotal)}</span>
          <Icons.ChevronDown size={18} className={`text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {isOpen && <div className="px-4 py-3 bg-surface-card">{children}</div>}
    </div>
  );
}

export default function Step3LivingExpenses() {
  const { register, control, setValue } = useFormContext<TerepayApplicationInput>();

  const nd = useWatch({ control, name: 'livingExpenses.nonDiscretionary' });
  const d = useWatch({ control, name: 'livingExpenses.discretionary' });
  const subs = useWatch({ control, name: 'livingExpenses.subscriptionDetails' });
  const bnpl = useWatch({ control, name: 'livingExpenses.bnpl' });

  const sumNd = nd ? Object.values(nd).reduce((a, b) => a + (Number(b) || 0), 0) : 0;
  const sumD = d ? Object.values(d).reduce((a, b) => a + (Number(b) || 0), 0) : 0;
  const sumSubs = subs
    ? Object.values(subs).reduce((a, s) => a + (Number((s as { amount: number }).amount) || 0), 0)
    : 0;
  const sumBnpl = bnpl ? Object.values(bnpl).reduce((a, b) => a + (Number(b) || 0), 0) : 0;
  const grandTotal = sumNd + sumD + sumSubs + sumBnpl;

  const [open, setOpen] = useState<string | null>('essentials');
  // null = auto (reveal when a resumed draft already has values); true/false = user choice.
  const [subsOverride, setSubsOverride] = useState<boolean | null>(null);
  const [bnplOverride, setBnplOverride] = useState<boolean | null>(null);
  const hasSubs = subsOverride ?? sumSubs > 0;
  const hasBnpl = bnplOverride ?? sumBnpl > 0;

  const toggleSubs = (v: boolean) => {
    setSubsOverride(v);
    if (!v) SUB_KEYS.forEach((s) => setValue(`livingExpenses.subscriptionDetails.${s}.amount`, 0));
  };
  const toggleBnpl = (v: boolean) => {
    setBnplOverride(v);
    if (!v) BNPL_KEYS.forEach((k) => setValue(`livingExpenses.bnpl.${k}`, 0));
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-ink-strong">Living Expenses</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Enter your regular <strong>fortnightly</strong> costs. Tap a section to open it, and skip anything that
          doesn&apos;t apply.
        </p>
      </div>

      {/* Essential costs */}
      <Section
        id="essentials"
        title="Essential costs"
        hint="Rent, food, power, transport, insurance…"
        subtotal={sumNd}
        open={open}
        onToggle={setOpen}
      >
        <NzdRow label="Accommodation (rent / board)" fieldName="livingExpenses.nonDiscretionary.accommodation" register={register} />
        <NzdRow label="Food & groceries" fieldName="livingExpenses.nonDiscretionary.food" register={register} />
        <NzdRow label="Utilities (power, water, internet)" fieldName="livingExpenses.nonDiscretionary.utilities" register={register} />
        <NzdRow label="Transport (fuel, WoF/rego, repairs)" fieldName="livingExpenses.nonDiscretionary.transport" register={register} />
        <NzdRow label="Personal (clothing, footwear)" fieldName="livingExpenses.nonDiscretionary.personalExpenses" register={register} />
        <NzdRow label="Medical (GP, prescriptions)" fieldName="livingExpenses.nonDiscretionary.medical" register={register} />
        <NzdRow label="Childcare / dependants" fieldName="livingExpenses.nonDiscretionary.childcare" register={register} />
        <NzdRow label="Health insurance" fieldName="livingExpenses.nonDiscretionary.healthInsurance" register={register} />
        <NzdRow label="Car insurance" fieldName="livingExpenses.nonDiscretionary.carInsurance" register={register} />
        <NzdRow label="Rates" fieldName="livingExpenses.nonDiscretionary.rates" register={register} />
        <NzdRow label="Education" fieldName="livingExpenses.nonDiscretionary.education" register={register} />
        <NzdRow label="Child support" fieldName="livingExpenses.nonDiscretionary.childSupport" register={register} />
        <NzdRow label="Remittances (overseas family)" fieldName="livingExpenses.nonDiscretionary.remittances" register={register} />
      </Section>

      {/* Lifestyle & extras */}
      <Section
        id="lifestyle"
        title="Lifestyle & extras"
        hint="Eating out, entertainment, travel…"
        subtotal={sumD}
        open={open}
        onToggle={setOpen}
      >
        <NzdRow label="Restaurants & takeaways" fieldName="livingExpenses.discretionary.restaurants" register={register} />
        <NzdRow label="Entertainment" fieldName="livingExpenses.discretionary.entertainment" register={register} />
        <NzdRow label="Travel" fieldName="livingExpenses.discretionary.travel" register={register} />
        <NzdRow label="Home improvement" fieldName="livingExpenses.discretionary.homeImprovement" register={register} />
        <NzdRow label="Cash withdrawals" fieldName="livingExpenses.discretionary.cashWithdrawals" register={register} />
        <NzdRow label="Other" fieldName="livingExpenses.discretionary.other" register={register} />
      </Section>

      {/* Subscriptions — optional */}
      <div className="rounded-xl border border-border-default p-4">
        <Toggle
          checked={hasSubs}
          onChange={toggleSubs}
          label="Do you pay for subscriptions?"
          description="Gym, streaming, sports and similar memberships."
        />
        {hasSubs && (
          <div className="mt-4 space-y-3">
            {SUB_KEYS.map((sub) => (
              <div key={sub} className="grid grid-cols-3 gap-3 items-end">
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 capitalize">{sub}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-disabled)]">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      defaultValue={0}
                      {...register(`livingExpenses.subscriptionDetails.${sub}.amount`, { valueAsNumber: true })}
                      onFocus={(ev) => ev.currentTarget.select()}
                      className="w-full pl-6 pr-2 py-2 border border-border-default rounded-md text-sm focus:ring-2 focus:ring-[var(--focus-ring)] focus:outline-none bg-surface-card"
                    />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Frequency</label>
                  <select
                    {...register(`livingExpenses.subscriptionDetails.${sub}.frequency`)}
                    className={selectCls + ' h-auto py-2'}
                  >
                    {FREQ_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-3 border-t border-border-default">
              <span className="text-sm font-semibold text-ink-strong">Subscriptions total</span>
              <span className="font-tabular text-sm font-bold text-brand-text">{money(sumSubs)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Buy Now, Pay Later — optional */}
      <div className="rounded-xl border border-border-default p-4">
        <Toggle
          checked={hasBnpl}
          onChange={toggleBnpl}
          label="Do you use Buy Now, Pay Later?"
          description="Afterpay, Klarna, Zip and similar."
        />
        {hasBnpl && (
          <div className="mt-3">
            <NzdRow label="Afterpay" fieldName="livingExpenses.bnpl.afterpay" register={register} />
            <NzdRow label="Klarna" fieldName="livingExpenses.bnpl.klarna" register={register} />
            <NzdRow label="Zip" fieldName="livingExpenses.bnpl.zip" register={register} />
          </div>
        )}
      </div>

      {/* Grand total */}
      <div className="flex items-center justify-between bg-[var(--orange-700)] text-white rounded-xl px-5 py-4">
        <span className="font-semibold text-sm">Total fortnightly expenses</span>
        <span className="font-tabular text-xl font-bold">{money(grandTotal)}</span>
      </div>
    </div>
  );
}
