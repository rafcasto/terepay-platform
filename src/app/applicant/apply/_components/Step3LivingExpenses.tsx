'use client';

import { useFormContext, useWatch, type UseFormRegister } from 'react-hook-form';
import type { TerepayApplicationInput } from '@/lib/validation/schemas';

const inputCls =
  'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5A523] focus:border-[#F5A523] focus:outline-none transition-colors bg-white';
const selectCls = inputCls + ' appearance-none';

const FREQ_OPTIONS = [
  { value: 'M', label: 'Monthly' },
  { value: 'F', label: 'Fortnightly' },
  { value: 'O', label: 'Occasionally' },
  { value: 'N/A', label: 'N/A' },
];

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
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600 flex-1">{label}</span>
      <div className="relative w-32 shrink-0">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
        <input
          type="number"
          min={0}
          step="0.01"
          defaultValue={0}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {...register(fieldName as any, { valueAsNumber: true })}
          className="w-full pl-6 pr-2 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-[#F5A523] focus:outline-none bg-white"
        />
      </div>
    </div>
  );
}

export default function Step3LivingExpenses() {
  const { register, control } = useFormContext<TerepayApplicationInput>();

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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Living Expenses</h2>
        <p className="text-sm text-gray-500 mt-1">
          Enter your regular fortnightly expenses in NZD. Leave blank (or 0) if not applicable.
        </p>
      </div>

      {/* Non-Discretionary */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">
          Non-Discretionary Expenses (Fortnightly)
        </h3>
        <NzdRow label="Food &amp; Groceries" fieldName="livingExpenses.nonDiscretionary.food" register={register} />
        <NzdRow label="Utilities (power, water, internet)" fieldName="livingExpenses.nonDiscretionary.utilities" register={register} />
        <NzdRow label="Personal expenses (clothing, footwear)" fieldName="livingExpenses.nonDiscretionary.personalExpenses" register={register} />
        <NzdRow label="Transport (fuel, WoF/rego, maintenance)" fieldName="livingExpenses.nonDiscretionary.transport" register={register} />
        <NzdRow label="Medical (GP, prescriptions)" fieldName="livingExpenses.nonDiscretionary.medical" register={register} />
        <NzdRow label="Childcare / Dependants" fieldName="livingExpenses.nonDiscretionary.childcare" register={register} />
        <NzdRow label="Accommodation (Rental Payment)" fieldName="livingExpenses.nonDiscretionary.accommodation" register={register} />
        <NzdRow label="Health Insurance" fieldName="livingExpenses.nonDiscretionary.healthInsurance" register={register} />
        <NzdRow label="Car Insurance" fieldName="livingExpenses.nonDiscretionary.carInsurance" register={register} />
        <NzdRow label="Rates" fieldName="livingExpenses.nonDiscretionary.rates" register={register} />
        <NzdRow label="Education" fieldName="livingExpenses.nonDiscretionary.education" register={register} />
        <NzdRow label="Child Support" fieldName="livingExpenses.nonDiscretionary.childSupport" register={register} />
        <NzdRow label="Remittances (Overseas Family)" fieldName="livingExpenses.nonDiscretionary.remittances" register={register} />
        <div className="flex items-center gap-3 pt-3 mt-1 border-t border-gray-200">
          <span className="text-sm font-semibold text-gray-800 flex-1">Total Non-Discretionary</span>
          <span className="w-32 shrink-0 px-3 py-2 bg-[#FEF7E9] text-[#E08B00] font-bold text-sm rounded-md text-right">
            ${sumNd.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Discretionary */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">
          Discretionary Expenses (Fortnightly)
        </h3>
        <NzdRow label="Restaurants &amp; Dining / Takeaways" fieldName="livingExpenses.discretionary.restaurants" register={register} />
        <NzdRow label="Entertainment" fieldName="livingExpenses.discretionary.entertainment" register={register} />
        <NzdRow label="Travel" fieldName="livingExpenses.discretionary.travel" register={register} />
        <NzdRow label="Subscriptions" fieldName="livingExpenses.discretionary.subscriptions" register={register} />
        <NzdRow label="Home Improvement" fieldName="livingExpenses.discretionary.homeImprovement" register={register} />
        <NzdRow label="Cash Withdrawals" fieldName="livingExpenses.discretionary.cashWithdrawals" register={register} />
        <NzdRow label="Other Discretionary" fieldName="livingExpenses.discretionary.other" register={register} />
        <div className="flex items-center gap-3 pt-3 mt-1 border-t border-gray-200">
          <span className="text-sm font-semibold text-gray-800 flex-1">Total Discretionary</span>
          <span className="w-32 shrink-0 px-3 py-2 bg-[#FEF7E9] text-[#E08B00] font-bold text-sm rounded-md text-right">
            ${sumD.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Subscriptions detail */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Subscription Details</h3>
        <div className="space-y-3">
          {(['gym', 'netflix', 'spotify', 'sports', 'others'] as const).map((sub) => (
            <div key={sub} className="grid grid-cols-3 gap-3 items-end">
              <div className="col-span-1">
                <label className="block text-xs font-medium text-gray-500 mb-1 capitalize">{sub}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={0}
                    {...register(`livingExpenses.subscriptionDetails.${sub}.amount`, {
                      valueAsNumber: true,
                    })}
                    className="w-full pl-6 pr-2 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-[#F5A523] focus:outline-none bg-white"
                  />
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Frequency</label>
                <select
                  {...register(`livingExpenses.subscriptionDetails.${sub}.frequency`)}
                  className={selectCls + ' text-xs py-2'}
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
          <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
            <span className="text-sm font-semibold text-gray-800 flex-1">Total Subscriptions</span>
            <span className="px-3 py-2 bg-[#FEF7E9] text-[#E08B00] font-bold text-sm rounded-md">
              ${sumSubs.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* BNPL */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">
          Buy Now Pay Later (Fortnightly Payment)
        </h3>
        <NzdRow label="Afterpay" fieldName="livingExpenses.bnpl.afterpay" register={register} />
        <NzdRow label="Klarna" fieldName="livingExpenses.bnpl.klarna" register={register} />
        <NzdRow label="ZIP" fieldName="livingExpenses.bnpl.zip" register={register} />
        <div className="flex items-center gap-3 pt-3 mt-1 border-t border-gray-200">
          <span className="text-sm font-semibold text-gray-800 flex-1">Total BNPL</span>
          <span className="w-32 shrink-0 px-3 py-2 bg-[#FEF7E9] text-[#E08B00] font-bold text-sm rounded-md text-right">
            ${sumBnpl.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Grand total */}
      <div className="flex items-center justify-between bg-[#F5A523] text-white rounded-xl px-5 py-4">
        <span className="font-semibold text-sm">Total Fortnightly Expenses</span>
        <span className="text-xl font-bold">
          ${(sumNd + sumD + sumBnpl).toFixed(2)}
        </span>
      </div>
    </div>
  );
}
