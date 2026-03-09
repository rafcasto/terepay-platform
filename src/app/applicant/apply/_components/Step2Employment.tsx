'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import type { TerepayApplicationInput } from '@/lib/validation/schemas';

const inputCls =
  'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-colors bg-white';
const selectCls = inputCls + ' appearance-none';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';
const errorCls = 'mt-1 text-xs text-red-600';

function NzdInput({ name, ...props }: { name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 select-none">
        $
      </span>
      <input
        type="number"
        min={0}
        step="0.01"
        className="w-full pl-6 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-colors bg-white"
        {...props}
      />
    </div>
  );
}

export default function Step2Employment() {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<TerepayApplicationInput>();

  const e = errors.employment;

  const income = useWatch({ control, name: 'employment.income' });
  const total =
    (income?.salaryAfterTax ?? 0) +
    (income?.winz ?? 0) +
    (income?.otherIncome ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Employment &amp; Income</h2>
        <p className="text-sm text-gray-500 mt-1">Tell us about your current employment and fortnightly earnings.</p>
      </div>

      {/* Employer details */}
      <div>
        <label className={labelCls}>
          Employer Name <span className="text-red-500">*</span>
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
          Employer Address <span className="text-red-500">*</span>
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
            Occupation / Job Title <span className="text-red-500">*</span>
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
            Hours per Week <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={1}
            max={168}
            {...register('employment.hoursPerWeek', { valueAsNumber: true })}
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
            Employment Status <span className="text-red-500">*</span>
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
            Time at Current Employer <span className="text-red-500">*</span>
          </label>
          <input
            {...register('employment.timeAtEmployer')}
            className={inputCls}
            placeholder="e.g. 1 year 3 months"
          />
          {e?.timeAtEmployer && <p className={errorCls}>{e.timeAtEmployer.message}</p>}
        </div>
      </div>

      {/* Previous employer */}
      <div>
        <label className={labelCls}>Previous Employer (if less than 6 months)</label>
        <input
          {...register('employment.previousEmployer')}
          className={inputCls}
          placeholder="Leave blank if not applicable"
        />
      </div>

      {/* Income table */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">
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
                className="text-sm text-gray-600 flex-1"
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
        <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
          <span className="text-sm font-semibold text-gray-800 flex-1">
            Total Fortnightly Income
          </span>
          <span className="w-36 px-3 py-2 bg-indigo-50 text-indigo-700 font-bold text-sm rounded-lg text-right">
            ${total.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
