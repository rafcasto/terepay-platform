'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, FormField, SelectField, Button } from '@/components/ui';
import Loading from '@/components/shared/Loading';

// ---------------------------------------------------------------------------
// Form schema — all fields optional except name; empty strings are allowed and
// stripped before sending to PATCH /api/users/profile.
// ---------------------------------------------------------------------------
const optionalString = z.string().optional().or(z.literal(''));

const profileFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  dateOfBirth: optionalString,
  phone: z.string().max(30).optional().or(z.literal('')),
  address: z.string().max(200).optional().or(z.literal('')),
  suburb: z.string().max(100).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  postCode: z.string().max(20).optional().or(z.literal('')),
  country: z.string().max(100).optional().or(z.literal('')),
  visaStatus: optionalString,
  visaExpiryDate: optionalString,
  anniversaryDate: optionalString,
  numberOfDependents: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((v) => v == null || v === '' || /^\d+$/.test(v), 'Enter a whole number'),
  occupation: z.string().max(120).optional().or(z.literal('')),
  employerName: z.string().max(120).optional().or(z.literal('')),
  employmentStatus: optionalString,
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

type ProfileData = ProfileFormValues & {
  email?: string;
  phoneNumber?: string;
  customerId?: string;
  status?: string;
};

const VISA_OPTIONS: Array<[string, string]> = [
  ['work_visa', 'Work visa'],
  ['resident_visa', 'Resident visa'],
  ['student_visa', 'Student visa'],
  ['permanent_resident', 'Permanent resident'],
  ['citizen', 'Citizen'],
  ['other', 'Other'],
];

const EMPLOYER_STATUS_OPTIONS: Array<[string, string]> = [
  ['permanent', 'Permanent'],
  ['fixed_term', 'Fixed-term'],
  ['casual', 'Casual'],
  ['part_time', 'Part-time'],
  ['self-employed', 'Self-employed'],
  ['unemployed', 'Unemployed'],
  ['retired', 'Retired'],
];

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-success-soft text-success border-success/30',
  suspended: 'bg-danger-soft text-danger border-danger/30',
  inactive: 'bg-surface-2 text-muted border-border',
};

function StatusPill({ status }: { status?: string }) {
  const key = (status ?? 'active').toLowerCase();
  const cls = STATUS_STYLES[key] ?? STATUS_STYLES.inactive;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${cls}`}
    >
      {status ?? 'Active'}
    </span>
  );
}

function ReadOnlyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-semibold text-text text-right">{children}</span>
    </div>
  );
}

export default function ApplicantProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormValues>({ resolver: zodResolver(profileFormSchema) });

  useEffect(() => {
    fetch('/api/users/profile')
      .then((r) => r.json())
      .then((body) => {
        const user = (body.user ?? body.data ?? body) as Record<string, unknown>;
        setProfile(user as ProfileData);
        reset({
          firstName: (user.firstName as string) ?? '',
          lastName: (user.lastName as string) ?? '',
          dateOfBirth: (user.dateOfBirth as string) ?? '',
          phone: (user.phone as string) ?? (user.phoneNumber as string) ?? '',
          address: (user.address as string) ?? '',
          suburb: (user.suburb as string) ?? '',
          city: (user.city as string) ?? '',
          postCode: (user.postCode as string) ?? (user.zipCode as string) ?? '',
          country: (user.country as string) ?? 'New Zealand',
          visaStatus: (user.visaStatus as string) ?? (user.immigrationStatus as string) ?? '',
          visaExpiryDate: (user.visaExpiryDate as string) ?? '',
          anniversaryDate: (user.anniversaryDate as string) ?? '',
          numberOfDependents:
            user.numberOfDependents != null ? String(user.numberOfDependents) : '',
          occupation: (user.occupation as string) ?? (user.jobTitle as string) ?? '',
          employerName: (user.employerName as string) ?? '',
          employmentStatus: (user.employmentStatus as string) ?? '',
        });
      })
      .finally(() => setFetchLoading(false));
  }, [reset]);

  const onSubmit = async (data: ProfileFormValues) => {
    setServerError(null);
    setSaveSuccess(false);

    // Build a clean payload — drop empty strings so we never overwrite with blanks.
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value === '' || value == null) continue;
      if (key === 'numberOfDependents') {
        payload[key] = Number(value);
      } else {
        payload[key] = value;
      }
    }

    const res = await fetch('/api/users/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setServerError(body.error?.message ?? 'Failed to save your changes. Please try again.');
      return;
    }
    setSaveSuccess(true);
    reset(data);
  };

  if (fetchLoading) return <Loading text="Loading profile…" />;

  return (
    <div className="p-6 sm:p-8 max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-text">Your profile</h1>
        <p className="mt-1 text-muted">
          Review and update your details. Keeping these current helps us assess future applications.
        </p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* Account — read only */}
        <Card>
          <CardHeader eyebrow="Account" title="Your TerePay details" />
          <div className="mt-4">
            <ReadOnlyRow label="Client ID">
              <span className="font-tabular">{profile?.customerId ?? '—'}</span>
            </ReadOnlyRow>
            <ReadOnlyRow label="Email">{profile?.email ?? '—'}</ReadOnlyRow>
            <ReadOnlyRow label="Status">
              <StatusPill status={profile?.status} />
            </ReadOnlyRow>
          </div>
          <p className="mt-4 text-xs text-muted">
            Client ID and account status are managed by TerePay. To change your email, use your
            account security settings.
          </p>
        </Card>

        {/* Personal details */}
        <Card>
          <CardHeader eyebrow="Personal" title="Personal details" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FormField
              label="First name"
              required
              error={errors.firstName?.message}
              {...register('firstName')}
            />
            <FormField
              label="Last name"
              required
              error={errors.lastName?.message}
              {...register('lastName')}
            />
            <FormField
              label="Date of birth"
              type="date"
              error={errors.dateOfBirth?.message}
              {...register('dateOfBirth')}
            />
            <FormField
              label="Contact number"
              type="tel"
              placeholder="e.g. 021 234 5678"
              error={errors.phone?.message}
              {...register('phone')}
            />
          </div>
        </Card>

        {/* Full address */}
        <Card>
          <CardHeader eyebrow="Address" title="Full address" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FormField
              label="Street address"
              className="sm:col-span-2"
              error={errors.address?.message}
              {...register('address')}
            />
            <FormField label="Suburb" error={errors.suburb?.message} {...register('suburb')} />
            <FormField label="City / town" error={errors.city?.message} {...register('city')} />
            <FormField label="Post code" error={errors.postCode?.message} {...register('postCode')} />
            <FormField label="Country" error={errors.country?.message} {...register('country')} />
          </div>
        </Card>

        {/* Immigration */}
        <Card>
          <CardHeader eyebrow="Immigration" title="Visa & residency" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Visa"
              error={errors.visaStatus?.message}
              {...register('visaStatus')}
            >
              <option value="">Select a visa type</option>
              {VISA_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            <FormField
              label="Visa expiry"
              type="date"
              error={errors.visaExpiryDate?.message}
              {...register('visaExpiryDate')}
            />
            <FormField
              label="Anniversary date"
              type="date"
              hint="Optional"
              error={errors.anniversaryDate?.message}
              {...register('anniversaryDate')}
            />
          </div>
        </Card>

        {/* Household & employment */}
        <Card>
          <CardHeader eyebrow="Employment" title="Household & work" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FormField
              label="Number of dependents"
              type="number"
              min={0}
              inputMode="numeric"
              error={errors.numberOfDependents?.message}
              {...register('numberOfDependents')}
            />
            <FormField
              label="Occupation"
              error={errors.occupation?.message}
              {...register('occupation')}
            />
            <FormField
              label="Employer"
              error={errors.employerName?.message}
              {...register('employerName')}
            />
            <SelectField
              label="Employer status"
              error={errors.employmentStatus?.message}
              {...register('employmentStatus')}
            >
              <option value="">Select a status</option>
              {EMPLOYER_STATUS_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </div>
        </Card>

        {serverError && (
          <div className="rounded-xl border border-danger/40 bg-danger-soft p-3">
            <p className="text-sm text-danger">{serverError}</p>
          </div>
        )}
        {saveSuccess && (
          <div className="rounded-xl border border-success/40 bg-success-soft p-3">
            <p className="text-sm text-success">Profile saved successfully.</p>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
