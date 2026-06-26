import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * The standalone applications list has been removed — a borrower only ever has
 * one active loan, so the dashboard (which shows that loan) is the single home.
 * Individual loans remain reachable at /applicant/applications/[id].
 */
export default function ApplicantApplicationsPage() {
  redirect('/applicant/dashboard');
}
