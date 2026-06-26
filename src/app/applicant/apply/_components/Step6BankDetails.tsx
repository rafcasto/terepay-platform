'use client';

import { useFormContext } from 'react-hook-form';
import type { TerepayApplicationInput } from '@/lib/validation/schemas';

const inputCls =
  'w-full px-3 h-11 border border-border-default rounded-xl text-sm focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-brand focus:outline-none transition-colors bg-surface-card text-ink-strong placeholder:text-[var(--text-disabled)]';
const labelCls = 'block text-sm font-semibold text-ink-strong mb-1.5';
const errorCls = 'mt-1.5 text-xs text-danger-text font-medium';

export default function Step6BankDetails() {
  const {
    register,
    formState: { errors },
  } = useFormContext<TerepayApplicationInput>();

  const e = errors.bankDetails;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink-strong">Bank Account</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Provide the account where you&apos;d like your loan funds deposited.
        </p>
      </div>

      {/* Security note */}
      <div className="flex items-start gap-3 bg-info-soft border border-[color-mix(in_srgb,var(--info-500)_25%,transparent)] rounded-xl p-4">
        <svg className="w-5 h-5 text-[var(--info-700)] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <p className="text-xs text-[var(--info-700)]">
          Your bank details are stored securely and used solely to deposit your loan funds. We never share
          this information with third parties.
        </p>
      </div>

      <div>
        <label className={labelCls}>
          Bank Name <span className="text-danger-text">*</span>
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
          Account Holder Name <span className="text-danger-text">*</span>
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
          Account Number <span className="text-danger-text">*</span>
        </label>
        <input
          {...register('bankDetails.accountNumber')}
          inputMode="numeric"
          className={inputCls}
          placeholder="XX-XXXX-XXXXXXX-XX"
        />
        <p className="mt-1 text-xs text-[var(--text-disabled)]">
          NZ format: 02-0100-0000000-00
        </p>
        {e?.accountNumber && <p className={errorCls}>{e.accountNumber.message}</p>}
      </div>
    </div>
  );
}
