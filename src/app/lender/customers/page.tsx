import { cookies } from 'next/headers';
import Link from 'next/link';
import { adminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import CustomersTable from './_components/CustomersTable';

export const dynamic = 'force-dynamic';

export type MergedCustomer = {
  type: 'online' | 'offline';
  /** Firebase UID for online, TERE ID for offline */
  id: string;
  /** TERE ID if the online user has claimed one, or the TERE ID for offline */
  customerId?: string;
  firstName: string;
  lastName: string;
  email: string;
  isExistingCustomer: boolean;
  /** Offline only */
  linkStatus?: 'linked' | 'unlinked';
  /** ISO 8601 string or null — serializable across server/client boundary */
  createdAt?: string | null;
};

export default async function LenderCustomersPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) return null;

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded || decoded.role !== 'lender') return null;

  // Fetch both collections in parallel
  const [onlineSnap, offlineSnap] = await Promise.all([
    adminDb
      .collection('users')
      .where('role', '==', 'applicant')
      .limit(200)
      .get(),
    adminDb
      .collection('offlineCustomers')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get(),
  ]);

  const customers: MergedCustomer[] = [];

  for (const doc of onlineSnap.docs) {
    const d = doc.data();
    customers.push({
      type: 'online',
      id: doc.id,
      customerId: d.customerId,
      firstName: d.firstName ?? '',
      lastName: d.lastName ?? '',
      email: d.email ?? '',
      isExistingCustomer: d.isExistingCustomer === true,
      createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
    });
  }

  for (const doc of offlineSnap.docs) {
    const d = doc.data();
    customers.push({
      type: 'offline',
      id: doc.id,
      customerId: d.customerId,
      firstName: d.firstName ?? '',
      lastName: d.lastName ?? '',
      email: d.email ?? '',
      isExistingCustomer: d.isExistingCustomer === true,
      linkStatus: d.status === 'linked' ? 'linked' : 'unlinked',
      createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
    });
  }

  // Alphabetical by name
  customers.sort((a, b) =>
    `${a.firstName} ${a.lastName}`
      .toLowerCase()
      .localeCompare(`${b.firstName} ${b.lastName}`.toLowerCase()),
  );

  return (
    <div className="p-6 sm:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1 text-sm">
            All registered (online) and offline customer records.
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

      <CustomersTable initialCustomers={customers} />
    </div>
  );
}
