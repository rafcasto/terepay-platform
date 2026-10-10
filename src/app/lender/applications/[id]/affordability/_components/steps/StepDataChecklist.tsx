'use client';

import type { Checklist } from '../types';
import { MIN_DAYS_OF_DATA } from '../types';

interface Props {
  checklist: Checklist;
  onChange: (c: Checklist) => void;
  daysOfData: number;
  /** NZ citizens have no visa — the passport is confirmed instead. */
  isCitizen: boolean;
  hardDeclines: string[];
  /** What will actually be recorded (hard declines force `decline`). */
  effectiveRecommendation: 'proceed' | 'decline';
  onSubmit: () => Promise<void>;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  validationErrors?: string[];
}

/**
 * Final step of the affordability wizard — the lender's sign-off that every
 * piece of evidence was collected and sighted. Submitting records the
 * assessment; only then can the loan be approved.
 */
export default function StepDataChecklist({
  checklist,
  onChange,
  daysOfData,
  isCitizen,
  hardDeclines,
  effectiveRecommendation,
  onSubmit,
  loading,
  error,
  onBack,
  validationErrors,
}: Props) {
  const update = (patch: Partial<Checklist>) => onChange({ ...checklist, ...patch });
  const hasEnoughData = daysOfData >= MIN_DAYS_OF_DATA;
  const forced = hardDeclines.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-[var(--text-strong)]">Data Collection Checklist</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Final sign-off before the assessment is recorded. Confirm every item was obtained and sighted — the loan
          cannot be approved until this checklist is complete.
        </p>
      </div>

      {/* Validation errors */}
      {validationErrors && validationErrors.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--danger-700)]/30 bg-[var(--danger-50)] p-4">
          <p className="mb-2 text-sm font-semibold text-[var(--danger-700)]">Please complete all required items before submitting:</p>
          <ul className="list-inside list-disc space-y-1 text-sm text-[var(--danger-700)]">
            {validationErrors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}

      <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white shadow-[var(--shadow-xs)]">
        {/* 1. Centrix credit report */}
        <ChecklistItem
          checked={checklist.centrixReportObtained}
          label="Centrix Report obtained"
          onChange={(v) => update({ centrixReportObtained: v })}
        >
          <input
            type="text"
            value={checklist.centrixReportNumber}
            onChange={(e) => update({ centrixReportNumber: e.target.value })}
            placeholder="Report Number"
            className={inputCls}
          />
        </ChecklistItem>

        {/* 2. First transaction date */}
        <ChecklistItem
          checked={checklist.firstTransactionVerified}
          label={
            <span>
              First transaction date verified ({MIN_DAYS_OF_DATA}+ days required)
              {daysOfData > 0 && (
                <span
                  className={`ml-2 rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                    hasEnoughData
                      ? 'bg-[var(--success-50)] text-[var(--success-700)]'
                      : 'bg-[var(--danger-50)] text-[var(--danger-700)]'
                  }`}
                >
                  {daysOfData} days — {hasEnoughData ? 'OK' : 'INSUFFICIENT'}
                </span>
              )}
            </span>
          }
          onChange={(v) => update({ firstTransactionVerified: v })}
        >
          <input
            type="date"
            value={checklist.firstTransactionDate}
            onChange={(e) => update({ firstTransactionDate: e.target.value })}
            className={inputCls}
          />
        </ChecklistItem>

        {/* 3. Payslips */}
        <ChecklistItem
          checked={checklist.payslipsReceived}
          label="Payslips received (last 2-3)"
          onChange={(v) => update({ payslipsReceived: v })}
        />

        {/* 4. Centrix affordability report */}
        <ChecklistItem
          checked={checklist.creditReportObtained}
          label="Centrix affordability report obtained"
          onChange={(v) => update({ creditReportObtained: v })}
        />

        {/* 5. Employment */}
        <ChecklistItem
          checked={checklist.employmentVerified}
          label="Employment verified"
          onChange={(v) => update({ employmentVerified: v })}
        >
          <input
            type="text"
            value={checklist.employmentVerificationMethod}
            onChange={(e) => update({ employmentVerificationMethod: e.target.value })}
            placeholder="Verification method"
            className={inputCls}
          />
        </ChecklistItem>

        {/* 6. Right to remain: passport for citizens, visa for everyone else */}
        {isCitizen ? (
          <ChecklistItem
            checked={checklist.passportConfirmed}
            label={
              <span>
                Passport sighted
                <span className="ml-2 rounded-full bg-[var(--slate-100)] px-1.5 py-0.5 text-xs font-semibold text-[var(--slate-600)]">
                  NZ citizen — no visa required
                </span>
              </span>
            }
            onChange={(v) => update({ passportConfirmed: v })}
          >
            <label className="mb-1 block text-xs text-[var(--text-muted)]" htmlFor="passport-expiry">
              Passport expiry date
            </label>
            <input
              id="passport-expiry"
              type="date"
              value={checklist.passportExpiryDate}
              onChange={(e) => update({ passportExpiryDate: e.target.value })}
              className={inputCls}
            />
          </ChecklistItem>
        ) : (
          <ChecklistItem
            checked={checklist.visaConfirmed}
            label="Visa status confirmed"
            onChange={(v) => update({ visaConfirmed: v })}
          >
            <label className="mb-1 block text-xs text-[var(--text-muted)]" htmlFor="visa-expiry">
              Visa expiry date
            </label>
            <input
              id="visa-expiry"
              type="date"
              value={checklist.visaExpiryDate}
              onChange={(e) => update({ visaExpiryDate: e.target.value })}
              className={inputCls}
            />
          </ChecklistItem>
        )}
      </div>

      {/* Outcome that will be recorded */}
      {forced ? (
        <div className="rounded-[var(--radius-lg)] border-2 border-[var(--danger-700)]/40 bg-[var(--danger-50)] p-4">
          <p className="mb-2 font-semibold text-[var(--danger-700)]">Hard Decline Triggered</p>
          <ul className="list-inside list-disc space-y-1 text-sm text-[var(--danger-700)]">
            {hardDeclines.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[var(--danger-700)]">
            These conditions cannot be overridden. Submitting records the assessment as declined.
          </p>
        </div>
      ) : (
        <div
          className={`rounded-[var(--radius-lg)] border p-4 text-sm ${
            effectiveRecommendation === 'decline'
              ? 'border-[var(--danger-700)]/30 bg-[var(--danger-50)] text-[var(--danger-700)]'
              : 'border-[var(--success-700)]/30 bg-[var(--success-50)] text-[var(--success-700)]'
          }`}
        >
          Recommendation to be recorded:{' '}
          <span className="font-bold">{effectiveRecommendation === 'decline' ? 'Decline application' : 'Proceed to credit check'}</span>
          . Go back to Results &amp; Decision to change it.
        </div>
      )}

      {/* Submission error */}
      {error && (
        <div className="rounded-[var(--radius-lg)] border-2 border-[var(--danger-700)]/30 bg-[var(--danger-50)] p-4">
          <p className="mb-1 font-semibold text-[var(--danger-700)]">Submission failed</p>
          <p className="text-sm text-[var(--danger-700)]">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onBack} className={backBtnCls} disabled={loading}>
          ← Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className={[
            'rounded-[10px] px-7 py-2.5 text-sm font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-50',
            effectiveRecommendation === 'decline' ? 'bg-[var(--danger-700)]' : 'bg-[var(--success-700)]',
          ].join(' ')}
        >
          {loading ? 'Submitting…' : effectiveRecommendation === 'decline' ? 'Submit Decline' : 'Submit Assessment'}
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ChecklistItem({
  checked,
  label,
  onChange,
  children,
}: {
  checked: boolean;
  label: React.ReactNode;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="p-5">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--border-default)] text-[var(--orange-500)] focus:ring-[var(--orange-400)]"
        />
        <span className="text-sm font-medium text-[var(--text-body)]">{label}</span>
      </label>
      {children && <div className="mt-2 pl-7">{children}</div>}
    </div>
  );
}

const inputCls =
  'w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white px-3 py-2 text-sm text-[var(--text-body)] focus:border-[var(--orange-400)] focus:outline-none focus:ring-2 focus:ring-[var(--orange-400)]';
const backBtnCls =
  'rounded-[10px] border border-[var(--border-default)] px-6 py-2.5 text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-50';
