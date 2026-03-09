import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import BenchmarksClient from './BenchmarksClient';

export const dynamic = 'force-dynamic';

async function getBenchmarks() {
  const db = getAdminDb();
  const snap = await db.collection('benchmarks').orderBy('categoryName').get();
  return snap.docs.map((d) => ({ benchmarkId: d.id, ...d.data() }));
}

export default async function BenchmarksPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('__session')?.value;
  if (!token) redirect('/auth/login');

  try {
    const decoded = await verifySessionOrIdToken(token);
    if (decoded.role !== 'lender') redirect('/auth/login');
  } catch {
    redirect('/auth/login');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const benchmarks = (await getBenchmarks()) as any[];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Benchmark Catalog</h1>
          <p className="text-gray-500 text-sm mt-1">
            Living expense benchmarks used in affordability assessments. Editing creates a new version — previous
            versions are retained for audit purposes.
          </p>
        </div>
        <BenchmarksClient initialBenchmarks={benchmarks} />
      </div>
    </div>
  );
}
