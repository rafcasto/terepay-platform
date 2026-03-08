'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfileSchema, type UpdateProfileInput } from '@/lib/validation/schemas';
import Loading from '@/components/shared/Loading';

type ProfileData = { firstName: string; lastName: string; email: string; companyName?: string; phoneNumber?: string };

export default function LenderProfilePage() {
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
        reset({ firstName: user.firstName ?? '', lastName: user.lastName ?? '', phoneNumber: user.phoneNumber ?? '' });
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
    if (!res.ok) { setServerError(body.error?.message ?? 'Failed to save'); return; }
    setSaveSuccess(true);
    reset(data);
  };

  if (fetchLoading) return <Loading text="Loading profile…" />;

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Lender Profile</h1>
      <p className="text-gray-500 mb-8">Update your information.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                {...register('firstName')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                {...register('lastName')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={profile?.email ?? ''}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              {...register('phoneNumber')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </section>

        {serverError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{serverError}</p>
          </div>
        )}
        {saveSuccess && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-700">Profile saved.</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !isDirty}
          className="w-full py-2.5 px-4 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
