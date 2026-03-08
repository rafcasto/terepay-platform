import { cookies } from 'next/headers';
import Link from 'next/link';
import { adminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import Badge from '@/components/shared/Badge';
import type { LoanStatus } from '@/types/loan';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

const LOAN_STATUS_VARIANT: Record<LoanStatus, BadgeVariant> = {
  active: 'success',
  paid_off: 'default',
  defaulted: 'error',
  delinquent: 'warning',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const fmtDate = (ts?: { toDate?: () => Date } | null) => {
  if (!ts?.toDate) return '—';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(ts.toDate());
};

export default async function LenderPortfolioPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) return null;

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded || decoded.role !== 'lender') return null;

  const snap = await adminDb
    .collection('loans')
    .orderBy('createdAt', 'desc')
    .get();

  const loans = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const totalOutstanding = loans
    .filter((l) => (l as Record<string, unknown>).status === 'active')
    .reduce((sum, l) => sum + ((l as Record<string, unknown>).remainingBalance as number ?? 0), 0);

  const activeCount = loans.filter((l) => (l as Record<string, unknown>).status === 'active').length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Portfolio</h1>
        <p className="text-gray-500 mt-1">All funded loans</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Loans</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{loans.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active Loans</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Outstanding Balance</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(totalOutstanding)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loans.length === 0 ? (
          <p className="px-6 py-12 text-sm text-gray-400 text-center">No funded loans yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Loan ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Principal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Remaining</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Funded</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Application</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loans.map((loan) => {
                const l = loan as Record<string, unknown>;
                const status = l.status as LoanStatus;
                return (
                  <tr key={loan.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-gray-700">{loan.id.slice(0, 8)}…</td>
                    <td className="px-6 py-4 text-gray-900">{fmt(l.principal as number ?? 0)}</td>
                    <td className="px-6 py-4 text-gray-700">{fmt(l.remainingBalance as number ?? 0)}</td>
                    <td className="px-6 py-4 text-gray-700">{l.interestRate as number}%</td>
                    <td className="px-6 py-4">
                      <Badge variant={LOAN_STATUS_VARIANT[status]}>{status.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{fmtDate(l.createdAt as { toDate?: () => Date } | null)}</td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/lender/applications/${l.applicationId as string}`}
                        className="text-indigo-600 hover:underline text-xs"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
