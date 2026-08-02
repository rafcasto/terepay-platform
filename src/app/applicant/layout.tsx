import type { ReactNode } from 'react';
import type { UserRole } from '@/types/user';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionOrIdToken } from '@/lib/firebase/admin';
import { normalizeRoles, preferredDashboard } from '@/lib/auth/roles';
import { getSiteSettings } from '@/lib/admin/site-settings';
import MaintenancePage from '@/components/shared/MaintenancePage';
import ApplicantShell from './_components/ApplicantShell';

// Maintenance mode is read from Firestore per request — never statically prerender
// this segment, or the flag would be frozen at build time. Applies to all /applicant/* routes.
export const dynamic = 'force-dynamic';

export default async function ApplicantLayout({ children }: { children: ReactNode }) {
  // Auth gate for the whole /applicant/* subtree. This replaces the old edge
  // middleware — full signature verification (not just a JWT decode) happens
  // here in the Node runtime we already pay for on render. API routes remain the
  // authoritative security boundary via withAuth().
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) redirect('/auth/login');

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded) redirect('/auth/login');

  const roles = normalizeRoles(decoded.role, decoded.roles);
  if (!roles.includes('applicant')) {
    redirect(preferredDashboard(decoded.role as UserRole | undefined, roles));
  }

  const settings = await getSiteSettings();
  if (settings.maintenanceMode.applicants) {
    return <MaintenancePage message={settings.maintenanceMessage} />;
  }

  return <ApplicantShell>{children}</ApplicantShell>;
}
