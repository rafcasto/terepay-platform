'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';

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
      <Button onClick={handleSubmit} disabled={loading}>
        {loading ? 'Submitting…' : 'Submit application'}
      </Button>
      {error && <p className="mt-2 text-xs text-danger font-medium">{error}</p>}
    </div>
  );
}
