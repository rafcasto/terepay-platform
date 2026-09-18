'use client';

import { useEffect, useState } from 'react';
import type { CreditAssessmentJob, CreditAssessmentResult } from '@/types/credit-assessment';
import { fmt, type Checklist, type ExpenseRow, type IncomeRow } from '../types';

interface Props {
  applicationId: string;
  assessedAmount: number;
  incomeRows: IncomeRow[];
  expenseRows: ExpenseRow[];
  checklist: Checklist;
  householdMultiplier: number;
  daysOfData: number;
  /** Latest job the panel knows about (the form links a completed one to the submission). */
  onChange: (job: CreditAssessmentJob | null) => void;
}

interface PanelError {
  message: string;
  missing: string[];
  skipped: { name: string; reason: string }[];
}

type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    details?: { missing?: string[]; skippedDocuments?: { name: string; reason: string }[]; jobId?: string };
  };
};

const POLL_MS = 4000;
const isActive = (job: CreditAssessmentJob | null): job is CreditAssessmentJob =>
  !!job && (job.status === 'queued' || job.status === 'running');

const ratingTone = (v: string | undefined) =>
  v === 'Low' || v === 'Approve' || v === 'Lower'
    ? 'success'
    : v === 'Medium' || v === 'Conditional' || v === 'Moderate'
      ? 'warning'
      : 'danger';

const TONE = {
  success: 'border-[var(--success-700)]/20 bg-[var(--success-50)] text-[var(--success-700)]',
  warning: 'border-[var(--warning-700)]/20 bg-[var(--warning-50)] text-[var(--warning-700)]',
  danger: 'border-[var(--danger-700)]/20 bg-[var(--danger-50)] text-[var(--danger-700)]',
  neutral: 'border-[var(--border-default)] bg-[var(--surface-sunken)] text-[var(--text-body)]',
} as const;

const ESCALATION_LABEL: Record<string, string> = {
  none: 'No escalation required',
  credit_officer: 'Refer to credit officer',
  senior_credit_officer: 'Refer to senior credit officer',
  decline: 'Decline — document reasons per CCCFA s.9CA',
};

export default function AiAssessmentPanel({
  applicationId,
  assessedAmount,
  incomeRows,
  expenseRows,
  checklist,
  householdMultiplier,
  daysOfData,
  onChange,
}: Props) {
  const [job, setJob] = useState<CreditAssessmentJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PanelError | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [showEvidence, setShowEvidence] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const publish = (next: CreditAssessmentJob | null) => {
    setJob(next);
    onChange(next);
  };

  // Latest assessment for this application (a previous run, or one still in flight).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/applications/${applicationId}/credit-assessment`, { cache: 'no-store' });
        if (!res.ok) return;
        const body = (await res.json()) as { data: CreditAssessmentJob | null };
        if (alive && body.data) {
          setJob(body.data);
          onChange(body.data);
        }
      } catch {
        /* the panel simply starts empty */
      }
    })();
    return () => {
      alive = false;
    };
  }, [applicationId, onChange]);

  // Poll while queued / running.
  const activeId = isActive(job) ? job.id : null;
  useEffect(() => {
    if (!activeId) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/applications/${applicationId}/credit-assessment?jobId=${activeId}`, { cache: 'no-store' });
        if (!res.ok) return;
        const body = (await res.json()) as { data: CreditAssessmentJob | null };
        if (body.data) {
          setJob(body.data);
          onChange(body.data);
        }
      } catch {
        /* keep the last state; next tick retries */
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [activeId, applicationId, onChange]);

  // Elapsed-time ticker.
  useEffect(() => {
    if (!activeId) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [activeId]);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/credit-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessedAmount,
          incomeRows,
          expenseRows,
          householdMultiplier,
          checklist: { firstTransactionDate: checklist.firstTransactionDate, daysOfTransactionData: daysOfData },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as ApiErrorBody & { data?: { job: CreditAssessmentJob } };
      if (!res.ok || !body.data) {
        setError({
          message: body.error?.message ?? 'Could not start the AI assessment',
          missing: body.error?.details?.missing ?? [],
          skipped: body.error?.details?.skippedDocuments ?? [],
        });
        return;
      }
      publish(body.data.job);
    } catch (e) {
      setError({ message: e instanceof Error ? e.message : 'Network error', missing: [], skipped: [] });
    } finally {
      setBusy(false);
    }
  };

  const result: CreditAssessmentResult | null = job?.status === 'done' ? (job.result ?? null) : null;
  const ranFor = job?.payload?.application.loan_amount;
  const stale = !!result && ranFor !== undefined && ranFor !== assessedAmount;
  const elapsed = isActive(job) ? Math.max(0, Math.round((now - (job.startedAt ?? job.createdAt)) / 1000)) : 0;
  const logLines = (job?.log ?? '').trim().split('\n').filter(Boolean);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white p-6 shadow-[var(--shadow-xs)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">AI Credit Assessment</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Parses the uploaded bank statements, applies TerePay&apos;s red-flag thresholds and the Borrower Behaviour
            Scorecard, and writes an analyst note. Advisory only — the decision and its reasons stay with you.
          </p>
        </div>
        {job && <StatusPill job={job} />}
      </div>

      {/* Idle */}
      {!job && !error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] px-4 py-3">
          <p className="text-sm text-[var(--text-body)]">
            Sends the verified figures above, the loan amount under assessment ({fmt(assessedAmount)}) and the
            applicant&apos;s statements to the assessment engine. Usually takes 1–2 minutes.
          </p>
          <RunButton onClick={run} busy={busy} label="Run AI assessment" />
        </div>
      )}

      {/* Could not start */}
      {error && (
        <div className="rounded-[var(--radius-md)] border-2 border-[var(--danger-700)]/30 bg-[var(--danger-50)] p-4">
          <p className="font-semibold text-[var(--danger-700)]">
            {error.missing.length > 0 ? 'Missing inputs — the assessment was not started' : 'Assessment could not start'}
          </p>
          {error.missing.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--danger-700)]">
              {error.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-[var(--danger-700)]">{error.message}</p>
          )}
          {error.skipped.length > 0 && (
            <p className="mt-2 text-xs text-[var(--danger-700)]">
              Not usable: {error.skipped.map((s) => `${s.name} (${s.reason})`).join('; ')}
            </p>
          )}
          <div className="mt-3">
            <RunButton onClick={run} busy={busy} label="Try again" />
          </div>
        </div>
      )}

      {/* In flight */}
      {isActive(job) && (
        <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-sunken)] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[var(--orange-500)] border-t-transparent" />
            <p className="text-sm text-[var(--text-body)]">
              {job.status === 'queued'
                ? 'Queued — waiting for the assessment worker'
                : `Running${job.worker ? ` on ${job.worker}` : ''} · ${elapsed}s`}
              <span className="text-[var(--text-muted)]"> · usually 1–2 minutes; you can keep working on this page.</span>
            </p>
          </div>
          {logLines.length > 0 && (
            <p className="mt-2 truncate font-mono text-xs text-[var(--text-muted)]">{logLines[logLines.length - 1]}</p>
          )}
        </div>
      )}

      {/* Failed / cancelled */}
      {job && (job.status === 'failed' || job.status === 'cancelled') && !error && (
        <div className="rounded-[var(--radius-md)] border-2 border-[var(--danger-700)]/30 bg-[var(--danger-50)] p-4">
          <p className="font-semibold text-[var(--danger-700)]">
            {job.status === 'cancelled' ? 'Assessment cancelled' : 'Assessment failed'}
          </p>
          {job.error && <p className="mt-1 text-sm text-[var(--danger-700)]">{job.error}</p>}
          <div className="mt-3">
            <RunButton onClick={run} busy={busy} label="Run again" />
          </div>
        </div>
      )}

      {/* Result */}
      {result && job && (
        <div className="space-y-4">
          {stale && (
            <div className="rounded-[var(--radius-md)] border border-[var(--warning-700)]/30 bg-[var(--warning-50)] px-4 py-2.5 text-sm text-[var(--warning-700)]">
              This result was produced for {fmt(ranFor ?? 0)}. The amount under assessment is now {fmt(assessedAmount)} — re-run
              before relying on it.
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Tile label="Risk rating" value={result.risk_rating} tone={ratingTone(result.risk_rating)} />
            <Tile label="Recommendation" value={result.recommendation} tone={ratingTone(result.recommendation)} />
            <Tile
              label="Confidence"
              value={`${result.confidence_score}%`}
              tone={result.confidence_score >= 70 ? 'success' : result.confidence_score >= 45 ? 'warning' : 'danger'}
            />
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Row label="Escalation" value={ESCALATION_LABEL[result.escalation] ?? result.escalation} />
            <Row label="Expense red-flag tier" value={result.expense_risk_tier} />
            <Row
              label="Behaviour score"
              value={`${result.behaviour_score >= 0 ? '+' : ''}${result.behaviour_score} · ${result.behaviour_tier}`}
            />
            <Row
              label="Statement parsing"
              value={
                result.parser_mode === 'deterministic'
                  ? `Deterministic · ${result.statement?.transactions ?? 0} transactions${result.statement?.period_days ? ` over ${result.statement.period_days} days` : ''}`
                  : result.parser_mode === 'fallback'
                    ? 'Fallback — statements could not be parsed; automatic approval blocked'
                    : 'No documents parsed'
              }
            />
            {result.affordability.observed_income !== null && (
              <Row
                label="Observed net income"
                value={`${fmt(result.affordability.observed_income)}/month${
                  result.affordability.income_mismatch_pct !== null ? ` (${result.affordability.income_mismatch_pct}% from declared)` : ''
                }`}
              />
            )}
            {result.affordability.payslip_status !== 'none' && (
              <Row label="Payslips" value={result.affordability.payslip_status.replace(/_/g, ' ')} />
            )}
          </dl>

          {result.affordability.hold && (
            <p className="rounded-[var(--radius-md)] border border-[var(--warning-700)]/30 bg-[var(--warning-50)] px-4 py-2.5 text-sm text-[var(--warning-700)]">
              Affordability hold: the engine blocked automatic approval because the declared surplus or income does not
              reconcile with the statements. Verify before proceeding.
            </p>
          )}

          {result.analyst_note && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Analyst note</p>
              <blockquote className="border-l-2 border-[var(--orange-500)] pl-3 text-sm leading-relaxed text-[var(--text-body)]">
                {result.analyst_note}
              </blockquote>
            </div>
          )}

          {result.factors.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Findings</p>
              <ul className="space-y-1.5">
                {result.factors.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-start gap-2.5 text-sm">
                    <span
                      className={[
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        f.impact === 'Positive'
                          ? 'bg-[var(--success-500)]'
                          : f.impact === 'Negative'
                            ? 'bg-[var(--danger-500)]'
                            : 'bg-[var(--slate-400)]',
                      ].join(' ')}
                    />
                    <span className="text-[var(--text-body)]">
                      <span className="font-semibold">{f.name}.</span> {f.assessment}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.evidence.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowEvidence((v) => !v)}
                className="text-xs font-semibold text-[var(--orange-700)] hover:underline"
              >
                {showEvidence ? 'Hide' : 'Show'} statement evidence ({result.evidence.length} lines)
              </button>
              {showEvidence && (
                <pre className="mt-2 max-h-64 overflow-auto rounded-[var(--radius-md)] bg-[var(--surface-sunken)] p-3 font-mono text-xs leading-relaxed text-[var(--text-body)]">
                  {result.evidence.join('\n')}
                </pre>
              )}
            </div>
          )}

          {result.data_gaps.length > 0 && (
            <p className="text-xs text-[var(--text-muted)]">
              <span className="font-semibold">Data gaps noted by the analyst model:</span> {result.data_gaps.join('; ')}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--text-muted)]">
            <p>
              Documents: {result.documents.map((d) => `${d.name} (${d.kind}${d.unreadable ? ', unreadable' : ''})`).join(', ') || 'none'}
              {' · '}
              {result.model} · framework v{result.framework_version} · {Math.round(result.processing_ms / 1000)}s ·{' '}
              {new Date(result.completed_at).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland', hour12: false })}
              {logLines.length > 0 && (
                <>
                  {' · '}
                  <button type="button" onClick={() => setShowLog((v) => !v)} className="font-semibold text-[var(--orange-700)] hover:underline">
                    {showLog ? 'hide log' : 'log'}
                  </button>
                </>
              )}
            </p>
            <RunButton onClick={run} busy={busy} label="Re-run" secondary />
          </div>
          {showLog && (
            <pre className="max-h-48 overflow-auto rounded-[var(--radius-md)] bg-[var(--surface-sunken)] p-3 font-mono text-xs text-[var(--text-muted)]">
              {logLines.join('\n')}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function StatusPill({ job }: { job: CreditAssessmentJob }) {
  const tone =
    job.status === 'done' ? 'success' : job.status === 'failed' || job.status === 'cancelled' ? 'danger' : 'warning';
  const label =
    job.status === 'done' ? 'Complete' : job.status === 'running' ? 'Running' : job.status === 'queued' ? 'Queued' : job.status === 'failed' ? 'Failed' : 'Cancelled';
  return (
    <span className={['rounded-full border px-2.5 py-1 text-xs font-semibold', TONE[tone]].join(' ')}>{label}</span>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone: keyof typeof TONE }) {
  return (
    <div className={['rounded-[var(--radius-md)] border px-4 py-3', TONE[tone]].join(' ')}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-0.5 font-display text-lg font-bold">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border-subtle)] py-1">
      <dt className="shrink-0 text-[var(--text-muted)]">{label}</dt>
      <dd className="text-right font-medium text-[var(--text-body)]">{value}</dd>
    </div>
  );
}

function RunButton({ onClick, busy, label, secondary = false }: { onClick: () => void; busy: boolean; label: string; secondary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={[
        'rounded-[10px] px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50',
        secondary
          ? 'border border-[var(--border-default)] text-[var(--text-body)] hover:bg-[var(--surface-sunken)]'
          : 'bg-[var(--ink-800)] text-white hover:bg-[var(--ink-900)]',
      ].join(' ')}
    >
      {busy ? 'Starting…' : label}
    </button>
  );
}
