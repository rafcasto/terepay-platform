import type { ReactNode } from 'react';
import { getSiteSettings } from '@/lib/admin/site-settings';
import MaintenancePage from '@/components/shared/MaintenancePage';
import ApplicantShell from './_components/ApplicantShell';

export default async function ApplicantLayout({ children }: { children: ReactNode }) {
  const settings = await getSiteSettings();
  if (settings.maintenanceMode.applicants) {
    return <MaintenancePage message={settings.maintenanceMessage} />;
  }

  return <ApplicantShell>{children}</ApplicantShell>;
}
