'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AddNoteForm({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? 'Failed to add note');
      }
      setText('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-[var(--danger-700)]">{error}</p>}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add an internal note…"
        rows={3}
        className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white px-3 py-2 text-sm text-[var(--text-body)] focus:border-[var(--orange-400)] focus:outline-none focus:ring-2 focus:ring-[var(--orange-400)]"
      />
      <button
        onClick={submit}
        disabled={loading || !text.trim()}
        className="rounded-[10px] bg-[var(--ink-800)] px-4 py-2 text-sm font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-50"
      >
        {loading ? 'Saving…' : 'Add Note'}
      </button>
    </div>
  );
}
