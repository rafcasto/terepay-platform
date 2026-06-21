import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionOrIdToken } from '@/lib/firebase/admin';
import { envResetEnabled } from '@/lib/flags/flags';
import AdminShell from './_components/AdminShell';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) redirect('/auth/login');

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded || decoded.role !== 'admin') redirect('/auth/login');

  const showEnvReset = await envResetEnabled();

  return <AdminShell showEnvReset={showEnvReset}>{children}</AdminShell>;
}
