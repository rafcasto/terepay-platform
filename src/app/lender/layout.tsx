import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionOrIdToken } from '@/lib/firebase/admin';
import { getSiteSettings } from '@/lib/admin/site-settings';
import MaintenancePage from '@/components/shared/MaintenancePage';
import LenderShell from './_components/LenderShell';

export default async function LenderLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) redirect('/auth/login');

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded || decoded.role !== 'lender') redirect('/auth/login');

  // Check maintenance mode — lenders can still access when applicants are blocked
  const settings = await getSiteSettings();
  if (settings.maintenanceMode.lenders) {
    return <MaintenancePage message={settings.maintenanceMessage} />;
  }

  return <LenderShell>{children}</LenderShell>;
}
