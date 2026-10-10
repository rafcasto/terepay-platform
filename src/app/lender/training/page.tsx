import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionOrIdToken } from '@/lib/firebase/admin';
import { rolesFromClaims } from '@/lib/auth/roles';
import { hasTrainingAccess } from '@/lib/training/access';
import TrainingConsole from '@/components/training/TrainingConsole';

export const dynamic = 'force-dynamic';

/** Lender-portal view of the training console. Only for lenders an admin has granted access to. */
export default async function LenderTrainingPage() {
  const session = (await cookies()).get('__session')?.value;
  if (!session) redirect('/auth/login');
  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded) redirect('/auth/login');
  const access = await hasTrainingAccess(decoded.uid, rolesFromClaims({ role: decoded.role, roles: decoded.roles }));
  if (!access) redirect('/lender/dashboard');

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-[#16263B]">Model Training</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload historical applications, check the engine against real outcomes and write the officer labels the
          analyst model learns from. Nothing here changes a live decision.
        </p>
      </div>
      <TrainingConsole />
    </div>
  );
}
