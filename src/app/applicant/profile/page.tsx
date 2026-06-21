'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileSchema, type UpdateProfileInput } from '@/lib/validation/schemas';
import Loading from '@/components/shared/Loading';

type ProfileData = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
};

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
  } = useForm<UpdateProfileInput>({ resolver: zodResolver(updateProfileSchema) });

  useEffect(() => {
    fetch('/api/users/profile')
      .then((r) => r.json())
      .then((body) => {
        const user = body.user ?? body;
        setProfile(user);
        reset({
          firstName: user.firstName ?? '',
          lastName: user.lastName ?? '',
          phoneNumber: user.phoneNumber ?? '',
          address: user.address ?? {},
        });
      })
      .finally(() => setFetchLoading(false));
  }, [reset]);

  const onSubmit = async (data: UpdateProfileInput) => {
    setServerError(null);
    setSaveSuccess(false);
    const res = await fetch('/api/users/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      setServerError(body.error?.message ?? 'Failed to save');
      return;
    }
    setSaveSuccess(true);
    reset(data);
  };

  if (fetchLoading) return <Loading text="Loading profile…" />;

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-text mb-2">Your Profile</h1>
      <p className="text-muted mb-8">Update your personal information.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <section className="bg-white rounded-xl border border-border p-6 space-y-5">
          <h2 className="font-semibold text-text">Personal Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1">First Name</label>
              <input
                type="text"
                {...register('firstName')}
                className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-accent focus:outline-none"
              />
              {errors.firstName && (
                <p className="mt-1 text-xs text-danger">{errors.firstName.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Last Name</label>
              <input
                type="text"
                {...register('lastName')}
                className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-accent focus:outline-none"
              />
              {errors.lastName && (
                <p className="mt-1 text-xs text-danger">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Email</label>
            <input
              type="email"
              value={profile?.email ?? ''}
              disabled
              className="w-full px-3 py-2 border border-border rounded-md text-sm bg-surface-2 text-muted cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Phone Number</label>
            <input
              type="tel"
              {...register('phoneNumber')}
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-accent focus:outline-none"
              placeholder="+1 (555) 000-0000"
            />
          </div>
        </section>

        <section className="bg-white rounded-xl border border-border p-6 space-y-5">
          <h2 className="font-semibold text-text">Address</h2>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Street</label>
            <input
              type="text"
              {...register('address.street')}
              className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-accent focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1">City</label>
              <input
                type="text"
                {...register('address.city')}
                className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">State</label>
              <input
                type="text"
                {...register('address.state')}
                className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1">ZIP Code</label>
              <input
                type="text"
                {...register('address.zipCode')}
                className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Country</label>
              <input
                type="text"
                {...register('address.country')}
                defaultValue="US"
                className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-accent focus:outline-none"
              />
            </div>
          </div>
        </section>

        {serverError && (
          <div className="p-3 bg-danger-soft border border-danger/40 rounded-md">
            <p className="text-sm text-danger">{serverError}</p>
          </div>
        )}
        {saveSuccess && (
          <div className="p-3 bg-success-soft border border-success/40 rounded-md">
            <p className="text-sm text-success">Profile saved successfully.</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className="w-full py-2.5 px-4 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
