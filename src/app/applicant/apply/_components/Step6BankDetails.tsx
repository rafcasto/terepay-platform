'use client';

import { useFormContext } from 'react-hook-form';
import type { TerepayApplicationInput } from '@/lib/validation/schemas';

const inputCls =
  'w-full px-3 h-11 border border-border rounded-xl text-sm focus:ring-2 focus:ring-accent focus:border-accent focus:outline-none transition-colors bg-surface text-text placeholder:text-muted/70';
const labelCls = 'block text-sm font-semibold text-text mb-1.5';
const errorCls = 'mt-1.5 text-xs text-danger font-medium';

export default function Step6BankDetails() {
  const {
    register,
    formState: { errors },
  } = useFormContext<TerepayApplicationInput>();

  const e = errors.bankDetails;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-text">Bank Account &amp; Repayment</h2>
        <p className="text-sm text-muted mt-1">
          Provide the account you would like loan funds deposited into and repayments deducted from.
        </p>
      </div>

      {/* Security note */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <svg className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <p className="text-xs text-blue-700">
          Your bank details are stored securely and used solely for loan disbursement and repayment
          collection. We never share this information with third parties.
        </p>
      </div>

      <div>
        <label className={labelCls}>
          Bank Name <span className="text-danger">*</span>
        </label>
        <input
          {...register('bankDetails.bankName')}
          className={inputCls}
          placeholder="e.g. ANZ, ASB, BNZ, Westpac, Kiwibank"
        />
        {e?.bankName && <p className={errorCls}>{e.bankName.message}</p>}
      </div>

      <div>
        <label className={labelCls}>
          Account Holder Name <span className="text-danger">*</span>
        </label>
        <input
          {...register('bankDetails.accountHolderName')}
          className={inputCls}
          placeholder="As it appears on your bank account"
        />
        {e?.accountHolderName && <p className={errorCls}>{e.accountHolderName.message}</p>}
      </div>

      <div>
        <label className={labelCls}>
          Account Number <span className="text-danger">*</span>
        </label>
        <input
          {...register('bankDetails.accountNumber')}
          className={inputCls}
          placeholder="XX-XXXX-XXXXXXX-XX"
        />
        <p className="mt-1 text-xs text-muted/70">
          NZ format: 02-0100-0000000-00
        </p>
        {e?.accountNumber && <p className={errorCls}>{e.accountNumber.message}</p>}
      </div>

      {/* Payment method */}
      <div>
        <label className={labelCls}>
          Preferred Repayment Method <span className="text-danger">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          {[
            {
              value: 'direct_debit',
              title: 'Direct Debit',
              description: 'Automatically deducted on payment due dates. Recommended.',
            },
            {
              value: 'bank_transfer',
              title: 'Bank Transfer',
              description: 'Manual transfer to TerePay on each due date.',
            },
          ].map((opt) => (
            <label key={opt.value} className="relative cursor-pointer">
              <input
                type="radio"
                value={opt.value}
                {...register('bankDetails.paymentMethod')}
                className="peer sr-only"
              />
              <div className="p-4 border-2 border-border rounded-xl peer-checked:border-accent peer-checked:bg-[#FEF7E9] transition-colors">
                <p className="font-semibold text-sm text-text">{opt.title}</p>
                <p className="text-xs text-muted mt-1">{opt.description}</p>
              </div>
              <div className="absolute top-3 right-3 w-4 h-4 rounded-full border-2 border-border peer-checked:border-accent peer-checked:bg-accent transition-colors" />
            </label>
          ))}
        </div>
        {e?.paymentMethod && <p className={errorCls}>{e.paymentMethod.message}</p>}
      </div>
    </div>
  );
}
