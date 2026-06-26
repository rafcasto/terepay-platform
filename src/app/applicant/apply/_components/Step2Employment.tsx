'use client';

import React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { TerepayApplicationInput } from '@/lib/validation/schemas';

const inputCls =
  'w-full px-3 h-11 border border-border-default rounded-xl text-sm focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-brand focus:outline-none transition-colors bg-surface-card text-ink-strong placeholder:text-[var(--text-disabled)]';
const selectCls = inputCls + ' appearance-none';
const labelCls = 'block text-sm font-semibold text-ink-strong mb-1.5';
const errorCls = 'mt-1.5 text-xs text-danger-text font-medium';

// Duration options, mirroring the "How long at this address?" field. We store the
// human-readable label (not a code) so the lender view and PDF render it directly.
const DURATION_OPTIONS = [
  'Less than 6 months',
  '6–12 months',
  '1–2 years',
  '2–5 years',
  '5+ years',
];

const NzdInput = React.forwardRef<
  HTMLInputElement,
  { name: string } & React.InputHTMLAttributes<HTMLInputElement>
>(({ name, ...props }, ref) => (
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-disabled)] select-none">
      $
    </span>
    <input
      ref={ref}
      name={name}
      type="number"
      inputMode="decimal"
      min={0}
      step="0.01"
      onFocus={(ev) => ev.currentTarget.select()}
      className="w-full pl-6 pr-3 py-2.5 border border-border-default rounded-lg text-sm focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-brand focus:outline-none transition-colors bg-surface-card"
      {...props}
    />
  </div>
));
NzdInput.displayName = 'NzdInput';

export default function Step2Employment() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<TerepayApplicationInput>();

  const e = errors.employment;

  const income = useWatch({ control, name: 'employment.income' });
  const timeAtEmployer = useWatch({ control, name: 'employment.timeAtEmployer' });
  const isNewJob = timeAtEmployer === 'Less than 6 months';

  const total =
    (income?.salaryAfterTax ?? 0) +
    (income?.winz ?? 0) +
    (income?.otherIncome ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink-strong">Employment &amp; Income</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">Tell us about your current employment and fortnightly earnings.</p>
      </div>

      {/* Employer details */}
      <div>
        <label className={labelCls}>
          Employer Name <span className="text-danger-text">*</span>
        </label>
        <input
          {...register('employment.employerName')}
          className={inputCls}
          placeholder="Acme Ltd"
        />
        {e?.employerName && <p className={errorCls}>{e.employerName.message}</p>}
      </div>

      <div>
        <label className={labelCls}>
          Employer Address <span className="text-danger-text">*</span>
        </label>
        <input
          {...register('employment.employerAddress')}
          className={inputCls}
          placeholder="123 Business Rd, Auckland"
        />
        {e?.employerAddress && <p className={errorCls}>{e.employerAddress.message}</p>}
      </div>

      {/* Occupation + Hours */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>
            Occupation / Job Title <span className="text-danger-text">*</span>
          </label>
          <input
            {...register('employment.occupation')}
            className={inputCls}
            placeholder="Sales Associate"
          />
          {e?.occupation && <p className={errorCls}>{e.occupation.message}</p>}
        </div>
        <div>
          <label className={labelCls}>
            Hours per Week <span className="text-danger-text">*</span>
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={168}
            {...register('employment.hoursPerWeek', { valueAsNumber: true })}
            onFocus={(ev) => ev.currentTarget.select()}
            className={inputCls}
            placeholder="40"
          />
          {e?.hoursPerWeek && <p className={errorCls}>{e.hoursPerWeek.message}</p>}
        </div>
      </div>

      {/* Employment status + time at employer */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>
            Employment Status <span className="text-danger-text">*</span>
          </label>
          <select {...register('employment.employmentStatus')} className={selectCls}>
            <option value="">Select…</option>
            <option value="permanent">Permanent</option>
            <option value="fixed_term">Fixed Term</option>
            <option value="casual">Casual</option>
            <option value="part_time">Part-time</option>
          </select>
          {e?.employmentStatus && <p className={errorCls}>{e.employmentStatus.message}</p>}
        </div>
        <div>
          <label className={labelCls}>
            Time at Current Employer <span className="text-danger-text">*</span>
          </label>
          <select {...register('employment.timeAtEmployer')} className={selectCls}>
            <option value="">Select…</option>
            {DURATION_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          {e?.timeAtEmployer && <p className={errorCls}>{e.timeAtEmployer.message}</p>}
        </div>
      </div>

      {/* Previous employer — only required when under 6 months at current employer */}
      {isNewJob && (
        <div className="rounded-xl border border-border-default bg-surface-sunken p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-ink-strong">Previous employer</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              You&apos;ve been at your current job under 6 months — tell us where you worked before.
            </p>
          </div>
          <div>
            <label className={labelCls}>
              Previous Employer Name <span className="text-danger-text">*</span>
            </label>
            <input
              {...register('employment.previousEmployer')}
              className={inputCls}
              placeholder="Previous Company Ltd"
            />
            {e?.previousEmployer && <p className={errorCls}>{e.previousEmployer.message}</p>}
          </div>
          <div>
            <label className={labelCls}>
              Time at Previous Employer <span className="text-danger-text">*</span>
            </label>
            <select {...register('employment.previousEmployerPeriod')} className={selectCls}>
              <option value="">Select…</option>
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {e?.previousEmployerPeriod && <p className={errorCls}>{e.previousEmployerPeriod.message}</p>}
          </div>
        </div>
      )}

      {/* Income table */}
      <div className="bg-surface-sunken rounded-xl border border-border-default p-4 space-y-3">
        <h3 className="text-sm font-semibold text-ink-strong">
          Fortnightly Income (NZD)
        </h3>

        <div className="space-y-3">
          {[
            {
              label: 'Salary / Wages (before tax)',
              field: 'employment.income.salaryBeforeTax' as const,
            },
            {
              label: 'Salary / Wages (after tax)',
              field: 'employment.income.salaryAfterTax' as const,
            },
            {
              label: 'Work &amp; Income (WINZ / Government Support)',
              field: 'employment.income.winz' as const,
            },
            {
              label: 'Other Income',
              field: 'employment.income.otherIncome' as const,
            },
          ].map(({ label, field }) => (
            <div key={field} className="flex items-center gap-3">
              <span
                className="text-sm text-[var(--text-muted)] flex-1"
                dangerouslySetInnerHTML={{ __html: label }}
              />
              <div className="w-36">
                <NzdInput
                  {...register(field, { valueAsNumber: true })}
                  defaultValue={0}
                  name={field}
                />
              </div>
            </div>
          ))}

          {/* Other income description */}
          <div>
            <label className={labelCls + ' mt-1'}>Other Income — please specify</label>
            <input
              {...register('employment.income.otherIncomeDescription')}
              className={inputCls}
              placeholder="e.g. Part-time job, rental income"
            />
          </div>
        </div>

        {/* Total */}
        <div className="flex items-center gap-3 pt-2 border-t border-border-default">
          <span className="text-sm font-semibold text-ink-strong flex-1">
            Total Fortnightly Income
          </span>
          <span className="w-36 px-3 py-2 bg-brand-soft text-brand-text font-bold text-sm rounded-lg text-right">
            ${total.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
