'use client';

import { fmt } from '../types';

interface Props {
  requestedAmount: number;
  assessedAmount: number;
  onAssessedAmountChange: (n: number) => void;
  totalIncome: number;
  totalExpenses: number;
  netDisposable: number;
  loanPayment: number;
  surplus: number;
  hardDeclines: string[];
  recommendation: 'proceed' | 'decline';
  onRecommendationChange: (r: 'proceed' | 'decline') => void;
  onSubmit: () => Promise<void>;
  loading: boolean;
  error: string | null;
  onBack: () => void;
}

export default function Step5ResultsDecision({
  requestedAmount,
  assessedAmount,
  onAssessedAmountChange,
  totalIncome,
  totalExpenses,
  netDisposable,
  loanPayment,
  surplus,
  hardDeclines,
  recommendation,
  onRecommendationChange,
  onSubmit,
  loading,
  error,
  onBack,
}: Props) {
  const isAdjusted = assessedAmount !== requestedAmount;
  const outOfRange = assessedAmount < 200 || assessedAmount > 2000;
  const forced = hardDeclines.length > 0;

  const surplusRating =
    surplus > 100
      ? 'LIKELY AFFORDABLE'
      : surplus >= 50
        ? 'MARGINAL'
        : surplus > 0
          ? 'HIGH RISK'
          : 'NOT AFFORDABLE';

  const surplusStyle =
    surplus > 100
      ? { pill: 'bg-[var(--success-50)] text-[var(--success-700)] border-[var(--success-700)]/20', dot: 'bg-[var(--success-500)]' }
      : surplus >= 50
        ? { pill: 'bg-[var(--warning-50)] text-[var(--warning-700)] border-[var(--warning-700)]/20', dot: 'bg-[var(--warning-500)]' }
        : { pill: 'bg-[var(--danger-50)] text-[var(--danger-700)] border-[var(--danger-700)]/20', dot: 'bg-[var(--danger-500)]' };

  const effectiveRecommendation = forced ? 'decline' : recommendation;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-[var(--text-strong)]">Results &amp; Decision</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Affordability calculation summary based on verified income and expenses.
        </p>
      </div>

      {/* Hard decline banner */}
      {forced && (
        <div className="rounded-[var(--radius-lg)] border-2 border-[var(--danger-700)]/40 bg-[var(--danger-50)] p-4">
          <p className="mb-2 font-semibold text-[var(--danger-700)]">Hard Decline Triggered</p>
          <ul className="list-inside list-disc space-y-1 text-sm text-[var(--danger-700)]">
            {hardDeclines.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[var(--danger-700)]">
            These conditions cannot be overridden. The assessment will be force-declined.
          </p>
        </div>
      )}

      {/* Loan amount under assessment */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white p-6 shadow-[var(--shadow-xs)]">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Loan Amount Under Assessment
        </h3>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Adjust the loan amount used in the affordability calculation. The applicant requested{' '}
          <span className="font-semibold text-[var(--text-body)]">{fmt(requestedAmount)}</span>.
        </p>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-muted)]">$</span>
          <input
            type="number"
            min={200}
            max={2000}
            step={1}
            value={Number.isFinite(assessedAmount) ? assessedAmount : ''}
            onChange={(e) => onAssessedAmountChange(Number(e.target.value))}
            className="w-40 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-white px-3 py-2 text-sm text-[var(--text-body)] focus:border-[var(--orange-400)] focus:outline-none focus:ring-2 focus:ring-[var(--orange-400)]"
          />
          {isAdjusted && !outOfRange && (
            <span className="rounded-full border border-[var(--warning-700)]/20 bg-[var(--warning-50)] px-2.5 py-1 text-xs font-medium text-[var(--warning-700)]">
              Adjusted from requested amount
            </span>
          )}
        </div>
        {outOfRange && (
          <p className="mt-2 text-xs text-[var(--danger-700)]">Amount must be between $200 and $2,000.</p>
        )}
      </div>

      {/* Affordability summary */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white p-6 shadow-[var(--shadow-xs)]">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Affordability Calculation
        </h3>

        <div className="space-y-2.5">
          <SummaryRow label="Total Verified Income" value={fmt(totalIncome)} color="text-[var(--success-700)]" />
          <SummaryRow label="Total Verified Expenses" value={fmt(totalExpenses)} color="text-[var(--danger-700)]" />
          <div className="border-t border-[var(--border-subtle)] pt-2.5">
            <SummaryRow
              label="Net Disposable Income"
              value={fmt(netDisposable)}
              color={netDisposable >= 0 ? 'text-[var(--text-strong)]' : 'text-[var(--danger-700)]'}
              bold
            />
          </div>
          <SummaryRow
            label={`Loan Fortnightly Payment (${fmt(assessedAmount)} × 1.047 ÷ 4)`}
            value={fmt(loanPayment)}
            color="text-[var(--text-muted)]"
          />
          <div className="border-t border-[var(--border-default)] pt-3">
            <div className={['flex items-center justify-between rounded-[var(--radius-lg)] border px-4 py-3.5', surplusStyle.pill].join(' ')}>
              <div className="flex items-center gap-2.5">
                <span className={['h-2.5 w-2.5 shrink-0 rounded-full', surplusStyle.dot].join(' ')} />
                <span className="text-sm font-bold">Final Available Surplus</span>
              </div>
              <div className="text-right">
                <div className="font-mono text-lg font-bold tabular-nums">{fmt(surplus)}</div>
                <div className="mt-0.5 text-xs font-semibold">{surplusRating}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendation */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-white p-6 shadow-[var(--shadow-xs)]">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Lender Recommendation
        </h3>

        {forced ? (
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--danger-700)]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--danger-500)]" />
            Hard decline conditions are met — recommendation forced to{' '}
            <span className="font-bold">Decline</span>.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <RecommendationBtn
              label="Proceed to Credit Check"
              active={recommendation === 'proceed'}
              onClick={() => onRecommendationChange('proceed')}
              variant="green"
            />
            <RecommendationBtn
              label="Decline Application"
              active={recommendation === 'decline'}
              onClick={() => onRecommendationChange('decline')}
              variant="red"
            />
          </div>
        )}
      </div>

      {/* Submission error */}
      {error && (
        <div className="rounded-[var(--radius-lg)] border-2 border-[var(--danger-700)]/30 bg-[var(--danger-50)] p-4">
          <p className="mb-1 font-semibold text-[var(--danger-700)]">Submission failed</p>
          <p className="text-sm text-[var(--danger-700)]">{error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onBack} className={backBtnCls} disabled={loading}>
          ← Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || outOfRange}
          className={[
            'rounded-[10px] px-7 py-2.5 text-sm font-semibold text-white transition-[filter] hover:brightness-110 disabled:opacity-50',
            effectiveRecommendation === 'decline' ? 'bg-[var(--danger-700)]' : 'bg-[var(--success-700)]',
          ].join(' ')}
        >
          {loading
            ? 'Submitting…'
            : effectiveRecommendation === 'decline'
              ? 'Submit Decline'
              : 'Submit & Proceed'}
        </button>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  color,
  bold = false,
}: {
  label: string;
  value: string;
  color: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={['text-sm text-[var(--text-muted)]', bold ? 'font-semibold' : ''].join(' ')}>{label}</span>
      <span className={['font-mono text-sm tabular-nums', color, bold ? 'font-bold' : 'font-semibold'].join(' ')}>
        {value}
      </span>
    </div>
  );
}

function RecommendationBtn({
  label,
  active,
  onClick,
  variant,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  variant: 'green' | 'red';
}) {
  const activeStyle =
    variant === 'green'
      ? 'bg-[var(--success-700)] text-white border-[var(--success-700)]'
      : 'bg-[var(--danger-700)] text-white border-[var(--danger-700)]';
  const inactiveStyle =
    variant === 'green'
      ? 'border-[var(--success-700)]/40 text-[var(--success-700)] hover:bg-[var(--success-50)]'
      : 'border-[var(--danger-700)]/40 text-[var(--danger-700)] hover:bg-[var(--danger-50)]';
  return (
    <button
      type="button"
      onClick={onClick}
      className={['rounded-[10px] border px-4 py-2.5 text-sm font-semibold transition-colors', active ? activeStyle : inactiveStyle].join(' ')}
    >
      {label}
    </button>
  );
}

const backBtnCls =
  'rounded-[10px] border border-[var(--border-default)] px-6 py-2.5 text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-50';
