'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 20;

type Props = {
  applicationId: string;
  detailHref: string;
};

export default function PendingPoller({ applicationId, detailHref }: Props) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checking) return;
    if (attempts >= MAX_ATTEMPTS) {
      setChecking(false);
      return;
    }
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/applications/${applicationId}/consent/status`);
        const body = await res.json();
        if (!res.ok) {
          setError(body.error?.message ?? 'Failed to check status');
          setChecking(false);
          return;
        }
        const status = body.data?.status;
        if (
          status === 'active' ||
          status === 'failed' ||
          status === 'expired' ||
          status === 'cancelled'
        ) {
          router.refresh();
          return;
        }
        setAttempts((a) => a + 1);
      } catch {
        setError('Network error while checking status');
        setChecking(false);
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [attempts, checking, applicationId, router]);

  const recheck = () => {
    setError(null);
    setAttempts(0);
    setChecking(true);
  };

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!checking && (
        <button
          onClick={recheck}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Check again
        </button>
      )}
      <div>
        <Link href={detailHref} className="text-sm text-indigo-600 hover:underline">
          ← Back to your application
        </Link>
      </div>
    </div>
  );
}
