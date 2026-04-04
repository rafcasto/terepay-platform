'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const inputCls =
  'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F5A523] focus:border-[#F5A523] focus:outline-none transition-colors bg-white';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';
const errorCls = 'mt-1 text-xs text-red-600';

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  phone: string;
  notes: string;
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

function eighteenYearsAgo() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().split('T')[0];
}

export default function NewCustomerPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    firstName: '',
    lastName: '',
    email: '',
    dateOfBirth: '',
    phone: '',
    notes: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  const set = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const errs: FieldErrors = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required';
    if (!form.lastName.trim()) errs.lastName = 'Last name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Enter a valid email address';
    if (!form.dateOfBirth) errs.dateOfBirth = 'Date of birth is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setApiError('');
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          dateOfBirth: form.dateOfBirth,
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
          ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.error?.message ?? 'Failed to create customer. Please try again.');
        return;
      }
      setCreated(data.data.customerId);
    } catch {
      setApiError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  if (created) {
    return (
      <div className="flex items-start justify-center min-h-full py-16 px-4">
        <div className="w-full max-w-md text-center">
          <div className="mb-4 flex justify-center">
            <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Customer Created</h2>
          <p className="text-gray-500 mb-6 text-sm">
            Share the customer ID below with your client so they can link their TerePay account.
          </p>
          <div className="bg-[#FEF7E9] border border-[#F5A523]/40 rounded-xl px-6 py-5 mb-8 inline-block w-full">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Customer ID</p>
            <p className="text-3xl font-bold text-[#E08B00] tracking-widest">{created}</p>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => router.push('/lender/customers')}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              View All Customers
            </button>
            <button
              type="button"
              onClick={() => router.push(`/lender/applications/new?offlineCustomerId=${created}`)}
              className="px-4 py-2 rounded-lg bg-[#F5A523] text-white text-sm font-medium hover:bg-[#E08B00] transition-colors"
            >
              Create Application
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-center min-h-full py-8 px-4">
      <div className="w-full max-w-lg">
        <div className="mb-7">
          <button
            type="button"
            onClick={() => router.push('/lender/customers')}
            className="text-sm text-gray-500 hover:text-gray-700 mb-3 inline-flex items-center gap-1"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h2 className="text-2xl font-bold text-[#0D1B2A]">Create New Customer</h2>
          <p className="text-gray-500 mt-1 text-sm">
            A unique Customer ID will be generated automatically. Share it with the customer so they can link their online account.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                First name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                className={inputCls}
                autoComplete="given-name"
              />
              {errors.firstName && <p className={errorCls}>{errors.firstName}</p>}
            </div>
            <div>
              <label className={labelCls}>
                Last name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                className={inputCls}
                autoComplete="family-name"
              />
              {errors.lastName && <p className={errorCls}>{errors.lastName}</p>}
            </div>
          </div>

          {/* Email */}
          <div>
            <label className={labelCls}>
              Email address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              className={inputCls}
              autoComplete="email"
            />
            {errors.email && <p className={errorCls}>{errors.email}</p>}
          </div>

          {/* Date of birth */}
          <div>
            <label className={labelCls}>
              Date of birth <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => set('dateOfBirth', e.target.value)}
              max={eighteenYearsAgo()}
              className={inputCls}
            />
            {errors.dateOfBirth && <p className={errorCls}>{errors.dateOfBirth}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className={labelCls}>Phone number</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              className={inputCls}
              autoComplete="tel"
              placeholder="Optional"
            />
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              className={inputCls}
              placeholder="Internal notes about this customer (optional)"
            />
          </div>

          {apiError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {apiError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#F5A523] text-white font-semibold rounded-lg hover:bg-[#E08B00] transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm"
          >
            {loading ? 'Creating…' : 'Create Customer'}
          </button>
        </form>
      </div>
    </div>
  );
}
