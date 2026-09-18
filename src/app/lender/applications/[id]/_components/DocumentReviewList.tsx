'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { DocumentStatus } from '@/types/application';
import ConsoleIcon from '@/components/lender/ConsoleIcon';
import ConsolePill, { type PillTone } from '@/components/lender/ConsolePill';
import { INPUT_CLASS } from './Card';
import type { ReviewableDocument } from './review-types';

const docTone = (s: DocumentStatus): PillTone =>
  s === 'accepted' ? 'success' : s === 'rejected' ? 'danger' : 'warning';

const docLabel = (s: DocumentStatus) =>
  s === 'accepted' ? 'Reviewed · accepted' : s === 'rejected' ? 'Rejected' : 'Needs review';

/**
 * List of documents with accept / reject controls. Works for both
 * application uploads (PATCH /documents/[docId]) and onboarding KYC evidence
 * (PATCH /kyc-documents/[fileId]) — the row only needs a `reviewUrl`.
 */
export default function DocumentReviewList({
  items,
  canReview,
  emptyText = 'No documents uploaded yet.',
}: {
  items: ReviewableDocument[];
  canReview: boolean;
  emptyText?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] bg-white/70 p-4 text-sm text-[var(--text-muted)]">
        {emptyText}
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((d) => (
        <DocumentRow key={d.id} doc={d} canReview={canReview} />
      ))}
    </ul>
  );
}

function DocumentRow({ doc, canReview }: { doc: ReviewableDocument; canReview: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'rejecting' | 'changing'>('idle');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showActions = canReview && (doc.status === 'pending' || mode === 'changing' || mode === 'rejecting');

  const review = async (action: 'accept' | 'reject') => {
    if (action === 'reject' && reason.trim().length < 3) {
      setError('Tell the applicant why this document was rejected.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(doc.reviewUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          rejectionReason: action === 'reject' ? reason.trim() : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error?.message ?? 'Could not update document');
      }
      setMode('idle');
      setReason('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] ${
              doc.status === 'accepted'
                ? 'bg-[var(--success-50)] text-[var(--success-700)]'
                : doc.status === 'rejected'
                  ? 'bg-[var(--danger-50)] text-[var(--danger-700)]'
                  : 'bg-[var(--slate-100)] text-[var(--text-muted)]'
            }`}
          >
            <ConsoleIcon name={doc.status === 'accepted' ? 'check' : doc.status === 'rejected' ? 'x' : 'fileText'} size={16} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-body)]">{doc.title}</p>
            <p className="truncate text-xs text-[var(--text-muted)]">
              {doc.subtitle} · Uploaded {doc.uploadedAt}
              {doc.reviewedAt && doc.status !== 'pending' && ` · Reviewed ${doc.reviewedAt}`}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <ConsolePill tone={docTone(doc.status)} dot={doc.status === 'pending'}>
            {docLabel(doc.status)}
          </ConsolePill>
          <a
            href={doc.viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-[8px] border border-[var(--border-default)] bg-white px-2 py-1 text-xs font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)]"
          >
            <ConsoleIcon name="search" size={14} />
            View
          </a>

          {showActions && mode !== 'rejecting' && (
            <>
              <button
                type="button"
                onClick={() => review('accept')}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-[8px] bg-[var(--success-700)] px-2.5 py-1 text-xs font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-50"
              >
                <ConsoleIcon name="check" size={14} />
                Accept
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('rejecting');
                  setError(null);
                }}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-[8px] border border-[var(--danger-700)]/40 bg-white px-2.5 py-1 text-xs font-semibold text-[var(--danger-700)] transition-colors hover:bg-[var(--danger-50)] disabled:opacity-50"
              >
                <ConsoleIcon name="x" size={14} />
                Reject
              </button>
            </>
          )}

          {canReview && doc.status !== 'pending' && (mode === 'idle' || mode === 'changing') && (
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'idle' ? 'changing' : 'idle');
                setError(null);
              }}
              disabled={busy}
              className="text-xs font-semibold text-[var(--text-muted)] underline-offset-2 hover:text-[var(--text-body)] hover:underline disabled:opacity-50"
            >
              {mode === 'idle' ? 'Change' : 'Cancel'}
            </button>
          )}
        </div>
      </div>

      {doc.status === 'rejected' && doc.rejectionReason && mode !== 'rejecting' && (
        <p className="mt-2 rounded-[8px] bg-[var(--danger-50)] px-3 py-2 text-xs text-[var(--danger-700)]">
          Rejected: {doc.rejectionReason}
        </p>
      )}

      {mode === 'rejecting' && (
        <div className="mt-3 space-y-2 border-t border-[var(--border-subtle)] pt-3">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
            Why is this document being rejected? (shown to the applicant)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="e.g. Statement is older than 90 days — please upload the most recent 3 months."
            className={`${INPUT_CLASS} resize-none`}
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('idle');
                setReason('');
                setError(null);
              }}
              disabled={busy}
              className="rounded-[8px] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-body)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => review('reject')}
              disabled={busy}
              className="rounded-[8px] bg-[var(--danger-700)] px-3 py-1.5 text-xs font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Confirm rejection'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-[var(--danger-700)]">{error}</p>}
    </li>
  );
}
