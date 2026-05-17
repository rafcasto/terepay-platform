'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';

export default function AcceptOfferButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/accept`, {
        method: 'POST',
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error?.message ?? 'Something went wrong. Please try again.');
        return;
      }
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button onClick={handleAccept} disabled={loading}>
        {loading ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
            Processing…
          </>
        ) : (
          'Accept loan offer'
        )}
      </Button>
      {error && <p className="text-sm text-danger font-medium">{error}</p>}
    </div>
  );
}
