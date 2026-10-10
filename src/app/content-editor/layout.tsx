import type { ReactNode } from 'react';
import type { UserRole } from '@/types/user';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionOrIdToken } from '@/lib/firebase/admin';
import { normalizeRoles, preferredDashboard } from '@/lib/auth/roles';
import ContentEditorShell from './_components/ContentEditorShell';

export default async function ContentEditorLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) redirect('/auth/login');

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded) redirect('/auth/login');

  const roles = normalizeRoles(decoded.role, decoded.roles);
  if (!roles.includes('content_editor') && !roles.includes('admin')) {
    redirect(preferredDashboard(decoded.role as UserRole | undefined, roles));
  }

  return <ContentEditorShell>{children}</ContentEditorShell>;
}
