import { cookies } from 'next/headers';
import Link from 'next/link';
import { adminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import Badge from '@/components/shared/Badge';

export const dynamic = 'force-dynamic';

const fmtDate = (ts?: { toDate?: () => Date } | null) => {
  if (!ts?.toDate) return '—';
  return new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium' }).format(ts.toDate());
};

export default async function LenderCustomersPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) return null;

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded || decoded.role !== 'lender') return null;

  const snap = await adminDb
    .collection('offlineCustomers')
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get();

  const customers = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<{
    id: string;
    customerId: string;
    firstName: string;
    lastName: string;
    email: string;
    dateOfBirth: string;
    phone?: string;
    status: string;
    createdAt?: { toDate?: () => Date };
  }>;

  return (
    <div className="p-6 sm:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Offline customer records managed by your team.
          </p>
        </div>
        <Link
          href="/lender/customers/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#F5A523] text-white text-sm font-medium rounded-lg hover:bg-[#E08B00] transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Customer
        </Link>
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <svg className="mx-auto h-12 w-12 mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4.13a4 4 0 10-8 0 4 4 0 008 0zm6 4a4 4 0 10-8 0 4 4 0 008 0z" />
          </svg>
          <p className="text-sm font-medium text-gray-500">No customers yet</p>
          <p className="text-xs text-gray-400 mt-1">Create your first offline customer record to get started.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Customer ID</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Email</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Date of Birth</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Created</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-[#E08B00]">{c.customerId}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{c.firstName} {c.lastName}</td>
                    <td className="px-4 py-3 text-gray-500">{c.email}</td>
                    <td className="px-4 py-3 text-gray-500">{c.dateOfBirth}</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.status === 'linked' ? 'success' : 'warning'}>
                        {c.status === 'linked' ? 'Linked' : 'Unlinked'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(c.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/lender/applications/new?offlineCustomerId=${c.customerId}`}
                        className="text-xs text-[#F5A523] font-medium hover:underline"
                      >
                        New Application
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {customers.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-mono font-bold text-[#E08B00] text-sm">{c.customerId}</p>
                    <p className="font-medium text-gray-900 text-sm">{c.firstName} {c.lastName}</p>
                  </div>
                  <Badge variant={c.status === 'linked' ? 'success' : 'warning'}>
                    {c.status === 'linked' ? 'Linked' : 'Unlinked'}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mb-3">{c.email}</p>
                <Link
                  href={`/lender/applications/new?offlineCustomerId=${c.customerId}`}
                  className="text-xs text-[#F5A523] font-medium"
                >
                  New Application →
                </Link>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
