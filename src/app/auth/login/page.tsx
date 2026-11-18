import { redirect } from 'next/navigation';
import { getViewerSession } from '@/lib/auth/session';
import { safeRedirectPath } from '@/lib/auth/redirect';
import LoginForm from './LoginForm';

// Reads the session cookie on every request — never prerender.
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ redirect?: string }> };

/**
 * A user who already holds a valid session has nothing to do here: send them
 * to where they were going (`?redirect=`), or to their dashboard. Only
 * unauthenticated visitors see the form.
 */
export default async function LoginPage({ searchParams }: Props) {
  const viewer = await getViewerSession();
  if (viewer) {
    const { redirect: to } = await searchParams;
    redirect(safeRedirectPath(to) ?? viewer.dashboardHref);
  }
  return <LoginForm />;
}
