'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SubmitButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${id}/submit`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message ?? 'Failed to submit');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="px-4 py-2 text-sm font-medium bg-[#F5A523] text-white rounded-md hover:bg-[#E08B00] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Submitting…' : 'Submit Application'}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
