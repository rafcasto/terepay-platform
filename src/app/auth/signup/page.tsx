import { redirect } from 'next/navigation';
import { getViewerSession } from '@/lib/auth/session';
import SignupForm from './SignupForm';

// Reads the session cookie on every request — never prerender.
export const dynamic = 'force-dynamic';

/** Signed-in users are sent to their dashboard instead of the registration form. */
export default async function SignupPage() {
  const viewer = await getViewerSession();
  if (viewer) redirect(viewer.dashboardHref);
  return <SignupForm />;
}
