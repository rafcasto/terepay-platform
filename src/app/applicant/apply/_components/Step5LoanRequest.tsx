'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import type { TerepayApplicationInput } from '@/lib/validation/schemas';

const inputCls =
  'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5A523] focus:border-[#F5A523] focus:outline-none transition-colors bg-white';
const selectCls = inputCls + ' appearance-none';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';
const errorCls = 'mt-1 text-xs text-red-600';

const LOAN_PURPOSES = [
  { value: 'emergency', label: 'Emergency / Unexpected expense' },
  { value: 'medical', label: 'Medical / Dental' },
  { value: 'car', label: 'Car repair / purchase' },
  { value: 'household', label: 'Household bills / Utilities' },
  { value: 'education', label: 'Education / Training' },
  { value: 'family', label: 'Family occasion / Event' },
  { value: 'travel', label: 'Travel' },
  { value: 'debt_consolidation', label: 'Debt consolidation' },
  { value: 'home_improvement', label: 'Home improvement' },
  { value: 'other', label: 'Other' },
];

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
    formState: { errors },
  } = useFormContext<TerepayApplicationInput>();

  const e = errors.loanRequest;
  const isPEP = useWatch({ control, name: 'loanRequest.isPEP' });
  const remittanceFreq = useWatch({ control, name: 'loanRequest.remittance.frequency' });
  const amount = useWatch({ control, name: 'loanRequest.requestedAmount' }) ?? 0;

  // Estimate repayments (4 fortnightly payments, 4.7% interest, $50 establishment fee)
  const principal = Number(amount) || 0;
  const interest = principal * 0.047;
  const estFee = 50;
  const totalRepayable = principal + interest + estFee;
  const fortnightlyPayment = totalRepayable / 4;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Loan Request</h2>
        <p className="text-sm text-gray-500 mt-1">Tell us about the loan you need.</p>
      </div>

      {/* Loan terms banner */}
      <div className="bg-[#FEF7E9] border border-[#F5A523]/30 rounded-xl p-4 space-y-2">
        <h3 className="text-xs font-bold text-[#E08B00] uppercase tracking-wide">Loan Terms</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-[#1C2740]">
          <div><span className="font-semibold">Period:</span> 8 weeks (56 days)</div>
          <div><span className="font-semibold">Payments:</span> 4 × fortnightly</div>
          <div><span className="font-semibold">APR:</span> 49%</div>
          <div><span className="font-semibold">Interest:</span> 4.7% for 8 weeks</div>
          <div><span className="font-semibold">New customer fee:</span> $50</div>
          <div><span className="font-semibold">Repeat customer fee:</span> $20</div>
        </div>
      </div>

      {/* Requested amount */}
      <div>
        <label className={labelCls}>
          Requested Amount (NZD) <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
          <input
            type="number"
            min={100}
            max={50000}
            step={50}
            {...register('loanRequest.requestedAmount', { valueAsNumber: true })}
            className={inputCls + ' pl-7'}
            placeholder="e.g. 500"
          />
        </div>
        {e?.requestedAmount && <p className={errorCls}>{e.requestedAmount.message}</p>}
      </div>

      {/* Repayment estimate */}
      {principal >= 100 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-1">
          <p className="text-xs font-semibold text-green-800">Estimated Repayment Schedule</p>
          <p className="text-xs text-green-700">
            4 fortnightly payments of{' '}
            <span className="font-bold">${fortnightlyPayment.toFixed(2)}</span>
          </p>
          <p className="text-xs text-green-600">
            Total repayable: ${totalRepayable.toFixed(2)} (incl. $50 establishment fee &amp; 4.7% interest)
          </p>
        </div>
      )}

      {/* Purpose */}
      <div>
        <label className={labelCls}>
          Purpose of Loan <span className="text-red-500">*</span>
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
          Please provide details <span className="text-red-500">*</span>
        </label>
        <textarea
          rows={3}
          {...register('loanRequest.purposeDescription')}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5A523] focus:outline-none resize-none"
          placeholder="Briefly explain the purpose of this loan…"
        />
        {e?.purposeDescription && <p className={errorCls}>{e.purposeDescription.message}</p>}
      </div>

      {/* Primary income source */}
      <div>
        <label className={labelCls}>
          Primary Source(s) of Income <span className="text-red-500">*</span>
        </label>
        <input
          {...register('loanRequest.primaryIncomeSource')}
          className={inputCls}
          placeholder="e.g. Wages, WINZ, Self-employment"
        />
        {e?.primaryIncomeSource && <p className={errorCls}>{e.primaryIncomeSource.message}</p>}
      </div>

      {/* PEP */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            {...register('loanRequest.isPEP')}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#F5A523] focus:ring-[#F5A523]"
          />
          <span className="text-sm text-amber-900">
            I, or an immediate family member, am a{' '}
            <strong>Politically Exposed Person (PEP)</strong> or a close associate of a PEP.
          </span>
        </label>
        {isPEP && (
          <div>
            <label className={labelCls}>Please provide details</label>
            <textarea
              rows={2}
              {...register('loanRequest.pepDetails')}
              className="w-full px-3 py-2.5 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:outline-none resize-none bg-white"
              placeholder="Name, role, and relationship…"
            />
          </div>
        )}
      </div>

      {/* Remittance */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Remittance Information</h3>
          <p className="text-xs text-gray-500">
            Regular money transfers abroad help us understand your financial commitments.
          </p>
        </div>

        <div>
          <label className={labelCls}>
            How often do you send remittances? <span className="text-red-500">*</span>
          </label>
          <select {...register('loanRequest.remittance.frequency')} className={selectCls}>
            <option value="">Select…</option>
            <option value="weekly">Weekly</option>
            <option value="fortnightly">Fortnightly</option>
            <option value="monthly">Monthly</option>
            <option value="occasionally">Occasionally</option>
            <option value="never">I don&apos;t send remittances</option>
          </select>
          {e?.remittance?.frequency && (
            <p className={errorCls}>{e.remittance.frequency.message}</p>
          )}
        </div>

        {remittanceFreq && remittanceFreq !== 'never' && (
          <>
            <div>
              <label className={labelCls}>
                Average Amount per Remittance per Fortnight (NZD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  {...register('loanRequest.remittance.averageAmount', { valueAsNumber: true })}
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
                      className="h-4 w-4 rounded border-gray-300 text-[#F5A523] focus:ring-[#F5A523]"
                    />
                    <span className="text-sm text-gray-700">{p}</span>
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
