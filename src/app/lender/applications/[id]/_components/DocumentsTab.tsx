'use client';

import { useState } from 'react';
import Link from 'next/link';
import ConsoleIcon from '@/components/lender/ConsoleIcon';
import ConsolePill from '@/components/lender/ConsolePill';
import { Card, SECTION_LABEL } from './Card';
import DecisionModal from './DecisionModal';
import DocumentReviewList from './DocumentReviewList';
import type { ReviewData, ReuseItem } from './review-types';

/**
 * Step 1 of the review flow — check what the applicant sent, accept / reject
 * each file, and ask for more if something is missing. For returning
 * applicants, shows what is already on file so it isn't re-requested.
 */
export default function DocumentsTab({ data }: { data: ReviewData }) {
  const [requesting, setRequesting] = useState(false);
  const h = data.history;

  return (
    <>
      {h.previousCount > 0 && <ReturningApplicantCard data={data} />}

      {data.documentRequest && (
        <Card
          title={data.documentRequest.outstanding ? 'Waiting on the applicant' : 'Last document request'}
          icon="mail"
          muted={!data.documentRequest.outstanding}
          action={
            <ConsolePill tone={data.documentRequest.outstanding ? 'warning' : 'neutral'} dot={data.documentRequest.outstanding}>
              {data.documentRequest.outstanding ? 'Outstanding' : 'Sent'}
            </ConsolePill>
          }
        >
          <p className={`${SECTION_LABEL} mb-2`}>Requested {data.documentRequest.requestedAt}</p>
          <ul className="list-inside list-disc space-y-1 text-sm text-[var(--text-body)]">
            {data.documentRequest.requiredDocuments.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          {data.documentRequest.message && (
            <p className="mt-3 rounded-[var(--radius-md)] bg-[var(--slate-50)] p-3 text-sm text-[var(--text-muted)]">
              &ldquo;{data.documentRequest.message}&rdquo;
            </p>
          )}
        </Card>
      )}

      <Card
        title="Applicant documents"
        icon="fileText"
        action={
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              {data.docsVerified}/{data.docsTotal} accepted
              {data.docsPending > 0 && ` · ${data.docsPending} to review`}
            </span>
            {data.canRequestDocs && (
              <button
                type="button"
                onClick={() => setRequesting(true)}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--border-default)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)]"
              >
                <ConsoleIcon name="plus" size={16} />
                Request documents
              </button>
            )}
          </div>
        }
      >
        {!data.canReviewDocs && data.docsTotal > 0 && (
          <p className="mb-3 text-xs text-[var(--text-muted)]">
            {data.decision
              ? 'A decision has been recorded — documents are read-only.'
              : 'Claim this application to accept or reject documents.'}
          </p>
        )}
        <DocumentReviewList items={data.documents} canReview={data.canReviewDocs} />
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Rejected documents show the reason on the applicant&apos;s tracker so they can re-upload.
        </p>
      </Card>

      {requesting && (
        <DecisionModal
          mode="request"
          applicationId={data.applicationId}
          requestedAmount={data.decisionInput.requestedAmount}
          assessedAmount={data.decisionInput.assessedAmount}
          onClose={() => setRequesting(false)}
        />
      )}
    </>
  );
}

function reusePill(item: ReuseItem) {
  if (item.reusable === null) return <ConsolePill tone="success">On file</ConsolePill>;
  if (item.reusable) return <ConsolePill tone="success" dot>Still valid</ConsolePill>;
  return <ConsolePill tone="warning" dot>Expired · request again</ConsolePill>;
}

function ReturningApplicantCard({ data }: { data: ReviewData }) {
  const h = data.history;
  const reusable = h.reuse.filter((r) => r.reusable !== false).length;
  return (
    <Card
      title="Returning applicant"
      icon="users"
      action={
        <ConsolePill tone="brand">
          {h.previousCount} previous {h.previousCount === 1 ? 'application' : 'applications'}
        </ConsolePill>
      }
    >
      {h.lastLoanLabel && (
        <p className="mb-4 text-sm text-[var(--text-body)]">
          Last loan: <span className="font-semibold">{h.lastLoanLabel}</span>
        </p>
      )}

      <p className={`${SECTION_LABEL} mb-2`}>Evidence already on file</p>
      {h.reuse.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] bg-white/70 p-4 text-sm text-[var(--text-muted)]">
          Nothing reusable — no accepted documents or reports from earlier applications.
        </div>
      ) : (
        <ul className="space-y-2">
          {h.reuse.map((r) => (
            <li
              key={r.key}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white p-3"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] ${
                    r.reusable === false
                      ? 'bg-[var(--warning-50)] text-[var(--warning-700)]'
                      : 'bg-[var(--success-50)] text-[var(--success-700)]'
                  }`}
                >
                  <ConsoleIcon name={r.reusable === false ? 'clock' : 'check'} size={16} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text-body)]">{r.label}</p>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    {r.fileName} · {r.fromLabel} · {r.date} ({r.ageLabel})
                    {r.expiresLabel && r.reusable !== null && ` · ${r.reusable ? 'valid until' : 'expired'} ${r.expiresLabel}`}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {reusePill(r)}
                <a
                  href={r.viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-[8px] border border-[var(--border-default)] bg-white px-2 py-1 text-xs font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)]"
                >
                  <ConsoleIcon name="search" size={14} />
                  View
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-[var(--text-muted)]">
        {reusable > 0
          ? `${reusable} item${reusable === 1 ? '' : 's'} can be relied on without asking the applicant again. Only request what has expired or is missing.`
          : 'Everything on file has aged out — request fresh evidence.'}
      </p>

      {h.previous.length > 0 && (
        <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
          <p className={`${SECTION_LABEL} mb-2`}>Previous applications</p>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {h.previous.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <Link href={p.href} className="font-mono text-xs font-semibold text-[var(--orange-700)] hover:underline">
                    {p.reference}
                  </Link>
                  <span className="text-[var(--text-muted)]">·</span>
                  <span className="font-mono tabular-nums text-[var(--text-body)]">{p.amount}</span>
                  <span className="text-[var(--text-muted)]">·</span>
                  <span className="text-xs text-[var(--text-muted)]">{p.date}</span>
                </div>
                <ConsolePill tone={p.statusTone}>{p.statusLabel}</ConsolePill>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
