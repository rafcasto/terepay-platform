'use client';

import { useFormContext } from 'react-hook-form';
import type { TerepayApplicationInput } from '@/lib/validation/schemas';

const inputCls =
  'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-colors bg-white';
const selectCls = inputCls + ' appearance-none';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';
const errorCls = 'mt-1 text-xs text-red-600';

export default function Step1PersonalInfo() {
  const {
    register,
    formState: { errors },
  } = useFormContext<TerepayApplicationInput>();

  const e = errors.personalInfo;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Personal Information</h2>
        <p className="text-sm text-gray-500 mt-1">Please provide your legal personal details.</p>
      </div>

      {/* Name row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>
            First Name <span className="text-red-500">*</span>
          </label>
          <input {...register('personalInfo.firstName')} className={inputCls} placeholder="Jane" />
          {e?.firstName && <p className={errorCls}>{e.firstName.message}</p>}
        </div>
        <div>
          <label className={labelCls}>
            Last Name <span className="text-red-500">*</span>
          </label>
          <input {...register('personalInfo.lastName')} className={inputCls} placeholder="Smith" />
          {e?.lastName && <p className={errorCls}>{e.lastName.message}</p>}
        </div>
      </div>

      {/* DOB + Phone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>
            Date of Birth <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            {...register('personalInfo.dateOfBirth')}
            className={inputCls}
            max={new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().split('T')[0]}
          />
          {e?.dateOfBirth && <p className={errorCls}>{e.dateOfBirth.message}</p>}
        </div>
        <div>
          <label className={labelCls}>
            Mobile Phone <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            {...register('personalInfo.phone')}
            className={inputCls}
            placeholder="+64 21 000 0000"
          />
          {e?.phone && <p className={errorCls}>{e.phone.message}</p>}
        </div>
      </div>

      {/* Email */}
      <div>
        <label className={labelCls}>
          Email Address <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          {...register('personalInfo.email')}
          className={inputCls}
          placeholder="jane@example.com"
        />
        {e?.email && <p className={errorCls}>{e.email.message}</p>}
      </div>

      {/* Address */}
      <div>
        <label className={labelCls}>
          Residential Address <span className="text-red-500">*</span>
        </label>
        <input
          {...register('personalInfo.address')}
          className={inputCls}
          placeholder="123 Main Street"
        />
        {e?.address && <p className={errorCls}>{e.address.message}</p>}
      </div>

      {/* City + Postcode */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>
            City / Town <span className="text-red-500">*</span>
          </label>
          <input {...register('personalInfo.city')} className={inputCls} placeholder="Auckland" />
          {e?.city && <p className={errorCls}>{e.city.message}</p>}
        </div>
        <div>
          <label className={labelCls}>
            Post Code <span className="text-red-500">*</span>
          </label>
          <input {...register('personalInfo.postCode')} className={inputCls} placeholder="1010" />
          {e?.postCode && <p className={errorCls}>{e.postCode.message}</p>}
        </div>
      </div>

      {/* Time at address + Housing status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>
            How long at this address? <span className="text-red-500">*</span>
          </label>
          <input
            {...register('personalInfo.timeAtAddress')}
            className={inputCls}
            placeholder="e.g. 2 years"
          />
          {e?.timeAtAddress && <p className={errorCls}>{e.timeAtAddress.message}</p>}
        </div>
        <div>
          <label className={labelCls}>
            Housing Status <span className="text-red-500">*</span>
          </label>
          <select {...register('personalInfo.housingStatus')} className={selectCls}>
            <option value="">Select…</option>
            <option value="rent">Rent</option>
            <option value="own">Own</option>
            <option value="flatmates">Flatmates</option>
            <option value="other">Other</option>
          </select>
          {e?.housingStatus && <p className={errorCls}>{e.housingStatus.message}</p>}
        </div>
      </div>

      {/* Visa Status + Expiry */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>
            Visa Status <span className="text-red-500">*</span>
          </label>
          <select {...register('personalInfo.visaStatus')} className={selectCls}>
            <option value="">Select…</option>
            <option value="citizen">NZ Citizen / PR</option>
            <option value="resident_visa">Resident Visa</option>
            <option value="work_visa">Work Visa</option>
            <option value="student_visa">Student Visa</option>
            <option value="other">Other</option>
          </select>
          {e?.visaStatus && <p className={errorCls}>{e.visaStatus.message}</p>}
        </div>
        <div>
          <label className={labelCls}>Visa Expiry Date</label>
          <input type="date" {...register('personalInfo.visaExpiryDate')} className={inputCls} />
        </div>
      </div>

      {/* Household Type */}
      <div>
        <label className={labelCls}>
          Household Type <span className="text-red-500">*</span>
        </label>
        <select {...register('personalInfo.householdType')} className={selectCls}>
          <option value="">Select…</option>
          <option value="single">Single</option>
          <option value="single_children">Single + Children</option>
          <option value="couple">Couple</option>
          <option value="couple_children">Couple + Children</option>
        </select>
        {e?.householdType && <p className={errorCls}>{e.householdType.message}</p>}
      </div>

      {/* Children + Dependents */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Number of Children</label>
          <input
            type="number"
            min={0}
            {...register('personalInfo.numberOfChildren', { valueAsNumber: true })}
            className={inputCls}
            defaultValue={0}
          />
        </div>
        <div>
          <label className={labelCls}>Number of Dependents</label>
          <input
            type="number"
            min={0}
            {...register('personalInfo.numberOfDependents', { valueAsNumber: true })}
            className={inputCls}
            defaultValue={0}
          />
        </div>
      </div>
    </div>
  );
}
