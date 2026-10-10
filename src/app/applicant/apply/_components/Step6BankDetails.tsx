'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import type { TerepayApplicationInput } from '@/lib/validation/schemas';
import { useSiteContent } from '@/lib/content/SiteContentContext';
import { useRepeatBorrower } from './RepeatBorrowerContext';
import YesNoQuestion from './YesNoQuestion';

/** Show only the last four digits of an account number. */
function maskAccountNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length > 4 ? `Ending in ${digits.slice(-4)}` : 'On file';
}

const inputCls =
  'w-full px-3 h-11 border border-border-default rounded-xl text-sm focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-brand focus:outline-none transition-colors bg-surface-card text-ink-strong placeholder:text-[var(--text-disabled)]';
const labelCls = 'block text-sm font-semibold text-ink-strong mb-1.5';
const errorCls = 'mt-1.5 text-xs text-danger-text font-medium';

export default function Step6BankDetails() {
  const {
    register,
    control,
    setValue,
    clearErrors,
    formState: { errors },
  } = useFormContext<TerepayApplicationInput>();
  const c = useSiteContent('apply.step6');
  const { isRepeat, previous } = useRepeatBorrower();

  const e = errors.bankDetails;

  // Repeat borrowers keep the bank account from their last application unless
  // they tell us it has changed.
  const askAccountChange = isRepeat && Boolean(previous.bankDetails);
  const accountChanged = useWatch({ control, name: 'bankDetails.changedSinceLastApplication' });
  const retained = askAccountChange && accountChanged === false;
  const showForm = !askAccountChange || accountChanged === true;

  const answerAccountChange = (changed: boolean) => {
    if (changed === accountChanged) return;
    clearErrors('bankDetails');
    setValue(
      'bankDetails',
      changed
        ? { bankName: '', accountHolderName: '', accountNumber: '', changedSinceLastApplication: true }
        : { ...previous.bankDetails!, changedSinceLastApplication: false },
      { shouldDirty: true },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink-strong">{c.title}</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">{c.intro}</p>
      </div>

      {/* Security note */}
      <div className="flex items-start gap-3 bg-info-soft border border-[color-mix(in_srgb,var(--info-500)_25%,transparent)] rounded-xl p-4">
        <svg className="w-5 h-5 text-[var(--info-700)] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <p className="text-xs text-[var(--info-700)]">{c.securityNote}</p>
      </div>

      {askAccountChange && (
        <YesNoQuestion
          name="bank-account-changed"
          question="Has your bank account changed since your last application?"
          hint="If it hasn't, we'll keep using the account from your last application."
          value={accountChanged}
          onChange={answerAccountChange}
          error={e?.changedSinceLastApplication?.message}
        />
      )}

      {retained && previous.bankDetails && (
        <div className="rounded-xl border border-border-default bg-surface-card p-4">
          <h3 className="text-sm font-semibold text-ink-strong">Account kept from your last application</h3>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            {[
              ['Bank', previous.bankDetails.bankName],
              ['Account holder', previous.bankDetails.accountHolderName],
              ['Account number', maskAccountNumber(previous.bankDetails.accountNumber)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
                <dd className="mt-0.5 font-medium text-ink-strong break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {showForm && (
      <>
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
        <p className="mt-1 text-xs text-[var(--text-disabled)]">{c.accountFormatHint}</p>
        {e?.accountNumber && <p className={errorCls}>{e.accountNumber.message}</p>}
      </div>
      </>
      )}
    </div>
  );
}
