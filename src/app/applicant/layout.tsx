import type { ReactNode } from 'react';
import { getSiteSettings } from '@/lib/admin/site-settings';
import MaintenancePage from '@/components/shared/MaintenancePage';
import ApplicantShell from './_components/ApplicantShell';

// Maintenance mode is read from Firestore per request — never statically prerender
// this segment, or the flag would be frozen at build time. Applies to all /applicant/* routes.
export const dynamic = 'force-dynamic';

export default async function ApplicantLayout({ children }: { children: ReactNode }) {
  const settings = await getSiteSettings();
  if (settings.maintenanceMode.applicants) {
    return <MaintenancePage message={settings.maintenanceMessage} />;
  }

  return <ApplicantShell>{children}</ApplicantShell>;
}
