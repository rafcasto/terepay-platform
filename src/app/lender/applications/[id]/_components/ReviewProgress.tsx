'use client';

import ConsoleIcon, { type ConsoleIconName } from '@/components/lender/ConsoleIcon';
import type { ReviewData, TabKey } from './review-types';

type StepState = 'done' | 'attention' | 'todo';

type Step = {
  key: TabKey;
  n: number;
  label: string;
  icon: ConsoleIconName;
  state: StepState;
  detail: string;
};

/**
 * The lender's review checklist, in the order it should be worked:
 * documents → affordability → KYC → credit reports → communication.
 * Each step links to its tab.
 */
export default function ReviewProgress({ data, onSelect }: { data: ReviewData; onSelect: (tab: TabKey) => void }) {
  const docsState: StepState =
    data.docsTotal === 0 ? 'todo' : data.docsPending > 0 ? 'attention' : 'done';
  const docsDetail =
    data.docsTotal === 0
      ? 'Nothing uploaded'
      : data.docsPending > 0
        ? `${data.docsPending} to review`
        : `${data.docsVerified}/${data.docsTotal} accepted`;

  const kycDone = data.kyc.reports.length > 0;
  const creditDone = data.credit.reports.length > 0;
  const commsCount = data.communications.length;

  const steps: Step[] = [
    { key: 'documents', n: 1, label: 'Documents', icon: 'fileText', state: docsState, detail: docsDetail },
    {
      key: 'affordability',
      n: 2,
      label: 'Affordability',
      icon: 'wallet',
      state: data.affordability.complete ? 'done' : 'todo',
      detail: data.affordability.complete ? 'Assessed' : 'Not assessed',
    },
    {
      key: 'kyc',
      n: 3,
      label: 'KYC',
      icon: 'shield',
      state: kycDone ? 'done' : data.kyc.borrowerDocuments.some((d) => d.status === 'pending') ? 'attention' : 'todo',
      detail: kycDone ? 'DataZoo report on file' : 'DataZoo report needed',
    },
    {
      key: 'credit',
      n: 4,
      label: 'Credit reports',
      icon: 'trending',
      state: creditDone ? 'done' : 'todo',
      detail: creditDone ? 'Credit report on file' : 'Upload credit report',
    },
    {
      key: 'communication',
      n: 5,
      label: 'Communication',
      icon: 'phoneCall',
      state: commsCount > 0 ? 'done' : 'todo',
      detail: commsCount > 0 ? `${commsCount} logged` : 'Nothing logged',
    },
  ];

  const doneCount = steps.filter((s) => s.state === 'done').length;

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white p-5 shadow-[var(--shadow-xs)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-[15px] font-bold text-[var(--text-strong)]">Review checklist</h2>
        <span className="text-xs font-semibold text-[var(--text-muted)]">
          {doneCount}/{steps.length} complete
        </span>
      </div>
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-5">
        {steps.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => onSelect(s.key)}
              className={`flex w-full items-start gap-2.5 rounded-[var(--radius-md)] border p-3 text-left transition-colors hover:bg-[var(--surface-sunken)] ${
                s.state === 'done'
                  ? 'border-[var(--success-700)]/25 bg-[var(--success-50)]/40'
                  : s.state === 'attention'
                    ? 'border-[var(--warning-700)]/30 bg-[var(--warning-50)]/50'
                    : 'border-[var(--border-subtle)] bg-white'
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  s.state === 'done'
                    ? 'bg-[var(--success-700)] text-white'
                    : s.state === 'attention'
                      ? 'bg-[var(--warning-700)] text-white'
                      : 'bg-[var(--slate-100)] text-[var(--slate-600)]'
                }`}
              >
                {s.state === 'done' ? <ConsoleIcon name="check" size={14} /> : s.n}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-[var(--text-strong)]">{s.label}</span>
                <span className="block truncate text-[11px] text-[var(--text-muted)]">{s.detail}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
