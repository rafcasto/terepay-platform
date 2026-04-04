import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionOrIdToken } from '@/lib/firebase/admin';
import LenderShell from './_components/LenderShell';

export default async function LenderLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) redirect('/auth/login');

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded || decoded.role !== 'lender') redirect('/auth/login');

  return <LenderShell>{children}</LenderShell>;
}
