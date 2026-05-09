'use client';

import { useState } from 'react';

interface Props {
  applicationId: string;
  initialValue: boolean;
}

export default function ExistingCustomerToggle({ applicationId, initialValue }: Props) {
  const [isExisting, setIsExisting] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    setLoading(true);
    setError(null);
    const newValue = !isExisting;
    try {
      const res = await fetch(`/api/applications/${applicationId}/flag-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isExistingCustomer: newValue }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: { message?: string } })?.error?.message ?? 'Failed to update',
        );
      }
      setIsExisting(newValue);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="col-span-2 sm:col-span-3">
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
        Existing Customer
      </dt>
      <dd className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={toggle}
          disabled={loading}
          aria-pressed={isExisting}
          className={[
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#F5A523] focus:ring-offset-2 disabled:opacity-50',
            isExisting ? 'bg-[#F5A523]' : 'bg-gray-200',
          ].join(' ')}
        >
          <span
            className={[
              'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out',
              isExisting ? 'translate-x-5' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
        <span
          className={[
            'text-sm font-medium',
            isExisting ? 'text-[#E08B00]' : 'text-gray-500',
          ].join(' ')}
        >
          {isExisting
            ? 'Yes — Application fee: $20'
            : 'No — Application fee: $50'}
        </span>
        {loading && <span className="text-xs text-gray-400">Saving…</span>}
      </dd>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
