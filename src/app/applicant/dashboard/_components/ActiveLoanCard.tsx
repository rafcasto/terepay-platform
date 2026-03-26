import Link from 'next/link';

export type ActiveLoanData = {
  status: 'active' | 'delinquent';
  remainingBalance: number;
  totalPaid: number;
  nextPaymentDate: string; // ISO string
} | null;

interface ActiveLoanCardProps {
  activeLoan: ActiveLoanData;
  hasPendingApp: boolean;
}

export default function ActiveLoanCard({ activeLoan, hasPendingApp }: ActiveLoanCardProps) {
  // State A — active or delinquent loan
  if (activeLoan) {
    const total = activeLoan.totalPaid + activeLoan.remainingBalance;
    const repaidPct = total > 0 ? Math.round((activeLoan.totalPaid / total) * 100) : 0;

    const nextDue = new Date(activeLoan.nextPaymentDate);
    const nextDueFormatted = nextDue.toLocaleDateString('en-NZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const [whole, cents] = activeLoan.remainingBalance.toFixed(2).split('.');
    const formattedWhole = Number(whole).toLocaleString('en-NZ');

    const isDelinquent = activeLoan.status === 'delinquent';

    return (
      <div className="rounded-2xl bg-[#0D1B2A] p-5 mb-6 text-white">
        <p className="text-xs font-semibold tracking-widest text-white/50 uppercase mb-4">
          Active Loan Balance
        </p>

        <div className="flex items-start justify-between mb-4">
          {/* Balance */}
          <div className="flex items-start leading-none">
            <span className="text-xl font-bold mt-1 mr-0.5">$</span>
            <span className="text-4xl font-bold">{formattedWhole}</span>
            <span className="text-xl font-bold text-white/60 mt-1">.{cents}</span>
          </div>
          {/* Next due */}
          <div className="text-right text-xs text-white/50">
            <p>Next due</p>
            <p className="font-semibold text-white mt-0.5">{nextDueFormatted}</p>
          </div>
        </div>

        {/* Status badge */}
        <div className="mb-5">
          {isDelinquent ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
              Late
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
              Active
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-white/50">Repayment progress</span>
            <span className="text-[#F5A523] font-medium">{repaidPct}% repaid</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#F5A523]"
              style={{ width: `${repaidPct}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // State B — application submitted, waiting for decision
  if (hasPendingApp) {
    return (
      <div className="rounded-2xl bg-[#0D1B2A] p-5 mb-6 text-white">
        <p className="text-xs font-semibold tracking-widest text-white/50 uppercase mb-4">
          Loan Application
        </p>
        <p className="text-lg font-semibold mb-1">Application in review</p>
        <p className="text-sm text-white/60 mb-5">
          We&apos;re processing your application. We&apos;ll notify you of any updates.
        </p>
        <Link
          href="/applicant/applications"
          className="inline-flex items-center text-sm text-[#F5A523] hover:text-[#E08B00] font-medium transition-colors"
        >
          View status →
        </Link>
      </div>
    );
  }

  // State C — new user, no loan or application
  return (
    <div className="rounded-2xl bg-[#0D1B2A] p-5 mb-6 text-white">
      <p className="text-xs font-semibold tracking-widest text-white/50 uppercase mb-4">
        Active Loan Balance
      </p>
      <p className="text-3xl font-bold mb-2">No active loan</p>
      <p className="text-sm text-white/60 mb-5">
        Ready to get started? Apply for a loan in minutes.
      </p>
      <Link
        href="/applicant/apply"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F5A523] text-white text-sm font-semibold hover:bg-[#E08B00] transition-colors"
      >
        Apply for a Loan →
      </Link>
    </div>
  );
}
