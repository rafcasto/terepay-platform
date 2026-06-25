'use client';

import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import type { TerepayApplicationInput } from '@/lib/validation/schemas';
import AddressAutocomplete from './AddressAutocomplete';

// Computed at module load time — acceptable for DOB age gate (changes at most once daily)
const MAX_DOB_DATE = new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().split('T')[0];

const inputCls =
  'w-full px-3 h-11 border border-border-default rounded-xl text-sm focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-brand focus:outline-none transition-colors bg-surface-card text-ink-strong placeholder:text-[var(--text-disabled)]';
const inputPrefilledCls =
  'w-full px-3 h-11 border border-[var(--info-500)]/40 rounded-xl text-sm focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-brand focus:outline-none transition-colors bg-info-soft-ds/40 text-ink-strong';
const selectCls = inputCls + ' appearance-none';
const selectPrefilledCls = inputPrefilledCls + ' appearance-none';
const labelCls = 'block text-sm font-semibold text-ink-strong mb-1.5';
const errorCls = 'mt-1.5 text-xs text-danger-text font-medium';

type PrefilledFields = Set<string>;

export default function Step1PersonalInfo() {
  const {
    register,
    setValue,
    watch,
    formState: { errors, touchedFields },
  } = useFormContext<TerepayApplicationInput>();

  const e = errors.personalInfo;
  const visaStatus = watch('personalInfo.visaStatus');
  const isVisaExpiryHidden = visaStatus === 'citizen';

  const [prefilled, setPrefilled] = useState<PrefilledFields>(new Set());
  const [displayAddress, setDisplayAddress] = useState('');

  // Fetch profile on mount and pre-populate empty fields
  useEffect(() => {
    fetch('/api/users/profile')
      .then((r) => r.json())
      .then(({ data }) => {
        if (!data) return;

        const newPrefilled = new Set<string>();

        function fill(field: string, value: unknown) {
          if (value == null || value === '') return;
          setValue(`personalInfo.${field}` as Parameters<typeof setValue>[0], value as never, {
            shouldDirty: false,
            shouldValidate: false,
          });
          newPrefilled.add(field);
        }

        fill('firstName', data.firstName);
        fill('lastName', data.lastName);
        fill('email', data.email);
        fill('phone', data.phone ?? data.phoneNumber);
        fill('dateOfBirth', data.dateOfBirth);
        fill('address', data.address);
        fill('suburb', data.suburb);
        fill('city', data.city);
        fill('postCode', data.postCode);
        fill('housingStatus', data.housingStatus);
        fill('timeAtAddress', data.timeAtAddress);

        // Map immigrationStatus (onboarding) → visaStatus (loan form enum)
        const immigrationToVisa: Record<string, string> = {
          citizen: 'citizen',
          permanent_resident: 'citizen',
          resident: 'resident_visa',
          work_visa: 'work_visa',
          student: 'student_visa',
        };
        const resolvedVisa =
          data.visaStatus ??
          (data.immigrationStatus ? (immigrationToVisa[data.immigrationStatus] ?? 'other') : undefined);
        fill('visaStatus', resolvedVisa);
        fill('visaExpiryDate', data.visaExpiryDate);
        fill('householdType', data.householdType);
        if (data.numberOfChildren != null) fill('numberOfChildren', data.numberOfChildren);
        if (data.numberOfDependents != null) fill('numberOfDependents', data.numberOfDependents);

        // Build display string for address autocomplete search box
        if (data.address) {
          const parts = [data.address, data.suburb, data.city, data.postCode].filter(Boolean);
          setDisplayAddress(parts.join(', '));
        }

        setPrefilled(newPrefilled);
      })
      .catch(() => {/* silent — form stays empty */});
  }, [setValue]);

  // Remove prefill indicator when user touches a field
  const touched = touchedFields.personalInfo ?? {};
  const cls = (field: string) =>
    prefilled.has(field) && !touched[field as keyof typeof touched]
      ? field.includes('Status') || field.includes('Type') || field.includes('household')
        ? selectPrefilledCls
        : inputPrefilledCls
      : field.includes('Status') || field.includes('Type') || field.includes('household')
      ? selectCls
      : inputCls;

  // Watch address to detect when the user edits it and remove the prefill indicator
  const currentAddress = watch('personalInfo.address');
  useEffect(() => {
    if (currentAddress && prefilled.has('address')) {
      // indicator cleared automatically via `touched` check
    }
  }, [currentAddress, prefilled]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink-strong">Personal Information</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">Please provide your legal personal details.</p>
      </div>

      {/* Name row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>
            First Name <span className="text-danger-text">*</span>
          </label>
          <input {...register('personalInfo.firstName')} className={cls('firstName')} placeholder="Jane" />
          {e?.firstName && <p className={errorCls}>{e.firstName.message}</p>}
        </div>
        <div>
          <label className={labelCls}>
            Last Name <span className="text-danger-text">*</span>
          </label>
          <input {...register('personalInfo.lastName')} className={cls('lastName')} placeholder="Smith" />
          {e?.lastName && <p className={errorCls}>{e.lastName.message}</p>}
        </div>
      </div>

      {/* DOB + Phone */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>
            Date of Birth <span className="text-danger-text">*</span>
          </label>
          <input
            type="date"
            {...register('personalInfo.dateOfBirth')}
            className={cls('dateOfBirth')}
            max={MAX_DOB_DATE}
          />
          {e?.dateOfBirth && <p className={errorCls}>{e.dateOfBirth.message}</p>}
        </div>
        <div>
          <label className={labelCls}>
            Mobile Phone <span className="text-danger-text">*</span>
          </label>
          <input
            type="tel"
            {...register('personalInfo.phone')}
            className={cls('phone')}
            placeholder="+64 21 000 0000"
          />
          {e?.phone && <p className={errorCls}>{e.phone.message}</p>}
        </div>
      </div>

      {/* Email */}
      <div>
        <label className={labelCls}>
          Email Address <span className="text-danger-text">*</span>
        </label>
        <input
          type="email"
          {...register('personalInfo.email')}
          className={cls('email')}
          placeholder="jane@example.com"
        />
        {e?.email && <p className={errorCls}>{e.email.message}</p>}
      </div>

      {/* Address autocomplete */}
      <AddressAutocomplete initialDisplayAddress={displayAddress} />

      {/* Time at address + Housing status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>
            How long at this address? <span className="text-danger-text">*</span>
          </label>
          <input
            {...register('personalInfo.timeAtAddress')}
            className={cls('timeAtAddress')}
            placeholder="e.g. 2 years"
          />
          {e?.timeAtAddress && <p className={errorCls}>{e.timeAtAddress.message}</p>}
        </div>
        <div>
          <label className={labelCls}>
            Housing Status <span className="text-danger-text">*</span>
          </label>
          <select {...register('personalInfo.housingStatus')} className={cls('housingStatus')}>
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
            Visa Status <span className="text-danger-text">*</span>
          </label>
          <select {...register('personalInfo.visaStatus')} className={cls('visaStatus')}>
            <option value="">Select…</option>
            <option value="citizen">NZ Citizen / PR</option>
            <option value="resident_visa">Resident Visa</option>
            <option value="work_visa">Work Visa</option>
            <option value="student_visa">Student Visa</option>
            <option value="other">Other</option>
          </select>
          {e?.visaStatus && <p className={errorCls}>{e.visaStatus.message}</p>}
        </div>
        {!isVisaExpiryHidden && (
          <div>
            <label className={labelCls}>Visa Expiry Date</label>
            <input type="date" {...register('personalInfo.visaExpiryDate')} className={cls('visaExpiryDate')} />
          </div>
        )}
      </div>

      {/* Household Type */}
      <div>
        <label className={labelCls}>
          Household Type <span className="text-danger-text">*</span>
        </label>
        <select {...register('personalInfo.householdType')} className={cls('householdType')}>
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
            className={cls('numberOfChildren')}
            defaultValue={0}
          />
        </div>
        <div>
          <label className={labelCls}>Number of Dependents</label>
          <input
            type="number"
            min={0}
            {...register('personalInfo.numberOfDependents', { valueAsNumber: true })}
            className={cls('numberOfDependents')}
            defaultValue={0}
          />
        </div>
      </div>
    </div>
  );
}
