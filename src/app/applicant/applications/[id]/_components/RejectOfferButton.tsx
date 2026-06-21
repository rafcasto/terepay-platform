'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal, TextareaField } from '@/components/ui';

export default function RejectOfferButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (loading) return;
    setModalOpen(false);
    setError(null);
  };

  const handleReject = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/reject-offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error?.message ?? 'Something went wrong. Please try again.');
        return;
      }
      setModalOpen(false);
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setModalOpen(true)}>
        Decline offer
      </Button>

      <Modal
        open={modalOpen}
        onClose={close}
        title="Decline this loan offer?"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close} disabled={loading}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleReject} disabled={loading}>
              {loading ? 'Declining…' : 'Yes, decline'}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">
          You&apos;ll need to submit a new application to receive another offer from TerePay.
        </p>
        <div className="mt-4">
          <TextareaField
            label="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Let the lender know why you're declining…"
            error={error ?? undefined}
          />
        </div>
      </Modal>
    </>
  );
}
