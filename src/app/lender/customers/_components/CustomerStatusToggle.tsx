'use client';

import { useState } from 'react';

interface Props {
  customerId: string;
  isExistingCustomer: boolean;
}

export default function CustomerStatusToggle({ customerId, isExistingCustomer: initial }: Props) {
  const [isExisting, setIsExisting] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(newValue: boolean) {
    if (newValue === isExisting || loading) return;
    setLoading(true);
    setError(null);
    const prev = isExisting;
    setIsExisting(newValue); // optimistic update

    try {
      const res = await fetch(`/api/customers/${customerId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isExistingCustomer: newValue }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: { message?: string } })?.error?.message ?? 'Failed to update status');
      }
    } catch (err) {
      setIsExisting(prev); // revert on failure
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        className={`inline-flex rounded-lg border overflow-hidden text-xs font-medium ${
          loading ? 'opacity-60' : ''
        } border-gray-200`}
      >
        <button
          onClick={() => handleChange(false)}
          disabled={loading}
          className={`px-2.5 py-1 transition-colors border-r border-gray-200 ${
            !isExisting
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-white text-gray-500 hover:bg-gray-50'
          } ${loading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
          New
        </button>
        <button
          onClick={() => handleChange(true)}
          disabled={loading}
          className={`px-2.5 py-1 transition-colors ${
            isExisting
              ? 'bg-green-100 text-green-800'
              : 'bg-white text-gray-500 hover:bg-gray-50'
          } ${loading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
          Existing
        </button>
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </div>
  );
}
