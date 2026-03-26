import type { ReactNode } from 'react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import LoanStepTracker from './_components/LoanStepTracker';

// Statuses that are terminal — user may start a fresh application after these
const TERMINAL_STATUSES = new Set([
  'declined', 'withdrawn', 'expired', 'closed_repaid',
  // legacy
  'rejected', 'completed',
]);

interface Props {
  children: ReactNode;
}

/**
 * Layout for the loan application flow.
 * Mirrors the onboarding split-panel design: navy left panel (desktop) + white content right.
 * Intentionally does NOT include the applicant shell nav.
 */
export default async function ApplyLayout({ children }: Props) {
  // Block access if the user has an active (non-draft, non-terminal) application
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (session) {
    const decoded = await verifySessionOrIdToken(session).catch(() => null);
    if (decoded) {
      const db = getAdminDb();
      const snap = await db
        .collection('loanApplications')
        .where('applicantId', '==', decoded.uid)
        .limit(20)
        .get();
      const activeApp = snap.docs
        .map((d) => ({ id: d.id, status: d.data().status as string }))
        .find((a) => a.status !== 'draft' && !TERMINAL_STATUSES.has(a.status));
      if (activeApp) {
        redirect(`/applicant/applications/${activeApp.id}`);
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col sm:flex-row">
      {/* ── Left Brand Panel (desktop only) ─────────────────────────────── */}
      <aside className="hidden sm:flex flex-col w-72 lg:w-80 bg-[#0D1B2A] shrink-0 px-8 py-10">
        <div className="mb-10">
          <span className="text-2xl font-bold text-[#F5A523] tracking-tight">TerePay</span>
          <p className="text-xs text-white/40 mt-1">Loan Application</p>
        </div>

        <LoanStepTracker />

        <div className="mt-auto pt-10 flex flex-col gap-4">
          <Link
            href="/applicant/applications"
            className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back to Applications
          </Link>

          <p className="text-xs text-white/30 leading-relaxed">
            Your information is encrypted and stored securely. We comply with NZ Privacy Act 2020.
          </p>
        </div>
      </aside>

      {/* ── Main Content Panel ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen sm:min-h-0">
        {/* Mobile top bar */}
        <header className="sm:hidden sticky top-0 z-20 bg-[#0D1B2A] px-4 h-12 flex items-center justify-between shrink-0">
          <Link
            href="/applicant/applications"
            className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors"
            aria-label="Back to Applications"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <span className="text-lg font-bold text-[#F5A523]">TerePay</span>
          {/* spacer to balance the back arrow */}
          <div className="w-5" aria-hidden="true" />
        </header>

        {/* Mobile step progress */}
        <div className="sm:hidden">
          <LoanStepTracker />
        </div>

        <main className="flex-1 bg-white overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
