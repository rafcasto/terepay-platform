'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import ConsoleIcon from '@/components/lender/ConsoleIcon';
import ConsolePill from '@/components/lender/ConsolePill';

type Props = {
  applicationId: string;
  /** `arrears_auto_enabled` flag — when off, this card is the only way fees/reminders are applied. */
  autoEnabled: boolean;
  isOverdue: boolean;
  /** False for loans written before the fee policy existed — the engine will skip them. */
  policyApplies: boolean;
};

type AssessResult = {
  ran: boolean;
  skippedReason: string | null;
  newFeeCount: number;
  remindersSent: number;
  isInArrears: boolean;
};

const SKIP_COPY: Record<string, string> = {
  no_policy: 'This loan pre-dates the fee policy, so no arrears charges apply to it.',
  not_live: 'The loan is not live, so there is nothing to assess.',
  no_schedule: 'The loan has no repayment schedule yet.',
  not_found: 'Application not found.',
};

/**
 * Lender-triggered arrears assessment. Runs the same engine the daily sweep
 * uses (late fees, default fee, overdue interest, reminder emails) on this one
 * loan. Idempotent — safe to press again.
 */
export default function AssessArrearsCard({ applicationId, autoEnabled, isOverdue, policyApplies }: Props) {
  const router = useRouter();
  const [isRunning, startRunning] = useTransition();
  const [result, setResult] = useState<AssessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ranAt, setRanAt] = useState<string | null>(null);

  const run = () => {
    setError(null);
    setResult(null);
    startRunning(async () => {
      try {
        const res = await fetch(`/api/applications/${applicationId}/arrears/assess`, { method: 'POST' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body.error?.message ?? 'Could not assess arrears');
          return;
        }
        setResult(body.data as AssessResult);
        setRanAt(new Date().toLocaleTimeString('en-NZ'));
        router.refresh();
      } catch {
        setError('Network error — could not assess arrears');
      }
    });
  };

  const summary = result
    ? !result.ran
      ? SKIP_COPY[result.skippedReason ?? ''] ?? 'Nothing to assess.'
      : [
          result.newFeeCount > 0
            ? `${result.newFeeCount} new ${result.newFeeCount === 1 ? 'fee' : 'fees'} charged`
            : 'No new fees',
          result.remindersSent > 0
            ? `${result.remindersSent} ${result.remindersSent === 1 ? 'reminder' : 'reminders'} emailed`
            : 'no reminders due',
          result.isInArrears ? 'loan is in arrears' : 'no payment overdue',
        ].join(' · ')
    : null;

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white p-5 shadow-[var(--shadow-xs)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-[var(--text-strong)]">
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--orange-50)] text-[var(--orange-700)]">
              <ConsoleIcon name="alert" size={16} />
            </span>
            Arrears assessment
          </h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {autoEnabled
              ? 'Runs automatically in the daily sweep. Run it now to bring this loan up to date straight away.'
              : 'Automatic assessment is switched off. Late payment fees, overdue interest and reminder emails are only applied when you run it here.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ConsolePill tone={autoEnabled ? 'info' : 'warning'}>
            {autoEnabled ? 'Automatic' : 'Manual only'}
          </ConsolePill>
          <button
            type="button"
            onClick={run}
            disabled={isRunning || !policyApplies}
            title={!policyApplies ? 'This loan pre-dates the fee policy' : undefined}
            className="rounded-[10px] bg-[var(--orange-600)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--orange-700)] disabled:opacity-50"
          >
            {isRunning ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                Assessing…
              </span>
            ) : (
              'Assess arrears now'
            )}
          </button>
        </div>
      </div>

      {!policyApplies && (
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          This loan was written before the fee policy, so the engine will not charge it.
        </p>
      )}
      {policyApplies && !autoEnabled && isOverdue && !result && (
        <p className="mt-3 text-xs font-semibold text-[var(--danger-700)]">
          A payment is overdue and has not been assessed. Check the repayments above are up to date, then run the
          assessment so any fees and reminders are applied.
        </p>
      )}
      {error && <p className="mt-3 text-xs text-[var(--danger-700)]">{error}</p>}
      {summary && (
        <p className={`mt-3 text-xs ${result?.ran ? 'text-[var(--text-body)]' : 'text-[var(--text-muted)]'}`}>
          {summary}
          {ranAt && <span className="ml-2 text-[var(--text-muted)]">· Ran {ranAt}</span>}
        </p>
      )}
    </section>
  );
}
