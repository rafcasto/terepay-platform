'use client';

import { fmt } from '../types';

interface Props {
  loanAmount: number;
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
  loanAmount,
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
      ? { pill: 'bg-green-100 text-green-800 border-green-200', dot: 'bg-green-500' }
      : surplus >= 50
      ? { pill: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500' }
      : { pill: 'bg-red-100 text-red-800 border-red-200', dot: 'bg-red-500' };

  const effectiveRecommendation = forced ? 'decline' : recommendation;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Results &amp; Decision</h2>
        <p className="text-sm text-gray-500 mt-1">
          Affordability calculation summary based on verified income and expenses.
        </p>
      </div>

      {/* Hard decline banner */}
      {forced && (
        <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4">
          <p className="font-semibold text-red-800 mb-2">Hard Decline Triggered</p>
          <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
            {hardDeclines.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <p className="text-xs text-red-600 mt-2">
            These conditions cannot be overridden. The assessment will be force-declined.
          </p>
        </div>
      )}

      {/* Affordability summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Affordability Calculation
        </h3>

        <div className="space-y-2.5">
          <SummaryRow label="Total Verified Income" value={fmt(totalIncome)} color="text-green-700" />
          <SummaryRow label="Total Verified Expenses" value={fmt(totalExpenses)} color="text-red-600" />
          <div className="border-t border-gray-100 pt-2.5">
            <SummaryRow
              label="Net Disposable Income"
              value={fmt(netDisposable)}
              color={netDisposable >= 0 ? 'text-gray-900' : 'text-red-700'}
              bold
            />
          </div>
          <SummaryRow
            label={`Loan Fortnightly Payment (${fmt(loanAmount)} × 1.047 ÷ 4)`}
            value={fmt(loanPayment)}
            color="text-gray-600"
          />
          <div className="border-t border-gray-200 pt-3">
            <div
              className={[
                'flex items-center justify-between rounded-xl px-4 py-3.5 border',
                surplusStyle.pill,
              ].join(' ')}
            >
              <div className="flex items-center gap-2.5">
                <span className={['h-2.5 w-2.5 rounded-full shrink-0', surplusStyle.dot].join(' ')} />
                <span className="font-bold text-sm">Final Available Surplus</span>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">{fmt(surplus)}</div>
                <div className="text-xs font-semibold mt-0.5">{surplusRating}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendation */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Lender Recommendation
        </h3>

        {forced ? (
          <div className="flex items-center gap-2 text-sm text-red-700 font-medium">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0" />
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
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
          <p className="font-semibold text-red-800 mb-1">Submission failed</p>
          <p className="text-sm text-red-700">{error}</p>
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
          disabled={loading}
          className={[
            'px-7 py-2.5 rounded-lg text-sm font-semibold transition-colors',
            effectiveRecommendation === 'decline'
              ? 'bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300'
              : 'bg-green-700 hover:bg-green-800 text-white disabled:bg-green-300',
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
      <span className={['text-sm text-gray-600', bold ? 'font-semibold' : ''].join(' ')}>
        {label}
      </span>
      <span className={['text-sm', color, bold ? 'font-bold' : 'font-semibold'].join(' ')}>
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
  const activeStyle = variant === 'green' ? 'bg-green-700 text-white border-green-700' : 'bg-red-600 text-white border-red-600';
  const inactiveStyle =
    variant === 'green'
      ? 'border-green-600 text-green-700 hover:bg-green-50'
      : 'border-red-500 text-red-600 hover:bg-red-50';
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'py-2.5 px-4 rounded-lg text-sm font-semibold border transition-colors',
        active ? activeStyle : inactiveStyle,
      ].join(' ')}
    >
      {label}
    </button>
  );
}

const backBtnCls =
  'px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50';
