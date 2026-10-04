'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import ConsoleIcon from '@/components/lender/ConsoleIcon';
import { creditSummarySchema, type CreditSummaryInput } from '@/lib/validation/schemas';
import { INPUT_CLASS, SECTION_LABEL } from './Card';
import type { CreditSummaryView } from './review-types';

const SCORE_MAX = 1000;

/** Empty number inputs become `undefined` so Zod reports "required" rather than NaN. */
const asNumber = (v: unknown) => (v === '' || v === null || v === undefined ? undefined : Number(v));

/**
 * Credit summary keyed in by the lender from the borrower's Centrix report.
 * Manual data entry — nothing is read from the uploaded file.
 */
export default function CreditSummary({
  applicationId,
  summary,
  dti,
  canEdit,
}: {
  applicationId: string;
  summary?: CreditSummaryView;
  /** Debt-to-income from the application's own figures (not from Centrix). */
  dti?: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreditSummaryInput>({
    resolver: zodResolver(creditSummarySchema),
    defaultValues: summary
      ? {
          reportDate: summary.reportDate,
          score: summary.score,
          defaults: summary.defaults,
          enquiries: summary.enquiries,
          utilisation: summary.utilisation,
        }
      : undefined,
  });

  const onSubmit = async (values: CreditSummaryInput) => {
    setServerError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}/credit-summary`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error?.message ?? 'Could not save the credit summary');
      }
      setEditing(false);
      router.refresh();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Could not save the credit summary');
    }
  };

  const cancel = () => {
    reset();
    setServerError(null);
    setEditing(false);
  };

  if (editing) {
    const fields: {
      name: keyof CreditSummaryInput;
      label: string;
      hint?: string;
      type: 'date' | 'number';
      step?: string;
      max?: number;
    }[] = [
      { name: 'reportDate', label: 'Report date', hint: 'Date shown on the Centrix report', type: 'date' },
      { name: 'score', label: 'Credit score', hint: 'Centrix score, 0 to 1000', type: 'number', step: '1', max: SCORE_MAX },
      { name: 'defaults', label: 'Defaults', type: 'number', step: '1', max: 99 },
      { name: 'enquiries', label: 'Credit enquiries (6m)', hint: 'Last 6 months', type: 'number', step: '1', max: 99 },
      { name: 'utilisation', label: 'Credit utilisation %', hint: 'Optional', type: 'number', step: '0.1', max: 999 },
    ];
    return (
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <p className={`${SECTION_LABEL} mb-1`}>Credit summary</p>
        <p className="mb-4 text-sm text-[var(--text-muted)]">
          Enter these figures from the borrower&apos;s Centrix comprehensive credit report.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((f) => {
            const error = errors[f.name]?.message;
            const id = `credit-summary-${f.name}`;
            return (
              <div key={f.name}>
                <label htmlFor={id} className={`${SECTION_LABEL} mb-1 block`}>
                  {f.label}
                </label>
                <input
                  id={id}
                  type={f.type}
                  inputMode={f.type === 'number' ? 'decimal' : undefined}
                  min={f.type === 'number' ? 0 : undefined}
                  max={f.max}
                  step={f.step}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${id}-error` : f.hint ? `${id}-hint` : undefined}
                  className={INPUT_CLASS}
                  {...register(f.name, f.type === 'number' ? { setValueAs: asNumber } : undefined)}
                />
                {error ? (
                  <p id={`${id}-error`} className="mt-1 text-xs text-[var(--danger-700)]">{error}</p>
                ) : (
                  f.hint && <p id={`${id}-hint`} className="mt-1 text-xs text-[var(--text-muted)]">{f.hint}</p>
                )}
              </div>
            );
          })}
        </div>
        {serverError && <p className="mt-3 text-sm text-[var(--danger-700)]">{serverError}</p>}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-[var(--ink-800)] px-3 py-1.5 text-sm font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-50"
          >
            <ConsoleIcon name="check" size={16} />
            {isSubmitting ? 'Saving…' : 'Save credit summary'}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={isSubmitting}
            className="rounded-[10px] border border-[var(--border-default)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  const editButton = canEdit && (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border border-[var(--border-default)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)]"
    >
      {summary ? 'Edit' : 'Enter credit summary'}
    </button>
  );

  if (!summary) {
    return (
      <div>
        <p className={`${SECTION_LABEL} mb-2`}>Credit summary</p>
        <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] bg-white/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--text-muted)]">
            {canEdit
              ? 'No credit summary entered yet. Enter the score and details from the Centrix report.'
              : 'No credit summary entered yet. Claim this application to enter it from the Centrix report.'}
          </p>
          {editButton}
        </div>
      </div>
    );
  }

  const pct = Math.max(0, Math.min(1, summary.score / SCORE_MAX));
  const metrics = [
    { label: 'Defaults', value: String(summary.defaults) },
    { label: 'Credit enquiries (6m)', value: String(summary.enquiries) },
    { label: 'Credit utilisation', value: summary.utilisation !== undefined ? `${summary.utilisation}%` : '—' },
    ...(dti ? [{ label: 'Debt-to-income (application)', value: dti }] : []),
  ];

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className={SECTION_LABEL}>Credit summary</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Centrix report dated {summary.reportDateLabel} · entered by {summary.updatedBy}
            {summary.updatedAt ? ` on ${summary.updatedAt}` : ''}
          </p>
        </div>
        {editButton}
      </div>
      <p className="font-tabular text-4xl font-bold tabular-nums text-[var(--text-strong)]">{summary.score}</p>
      <div
        role="img"
        aria-label={`Credit score ${summary.score} out of ${SCORE_MAX}`}
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--slate-100)]"
      >
        <div className="h-full rounded-full bg-[var(--orange-500)]" style={{ width: `${pct * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-[var(--text-muted)]">
        <span>0</span>
        <span>{SCORE_MAX}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white p-3">
            <p className={SECTION_LABEL}>{m.label}</p>
            <p className="mt-0.5 font-semibold text-[var(--text-strong)]">{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
