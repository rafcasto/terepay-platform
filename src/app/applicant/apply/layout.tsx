import type { ReactNode } from 'react';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import { Icons } from '@/components/ui';
import LoanStepTracker from './_components/LoanStepTracker';

const TERMINAL_STATUSES = new Set([
  'declined', 'withdrawn', 'expired', 'closed_repaid', 'offer_declined',
  'rejected', 'completed',
]);

interface Props {
  children: ReactNode;
}

export default async function ApplyLayout({ children }: Props) {
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
    <div className="min-h-screen flex flex-col sm:flex-row bg-bg">
      <aside className="hidden sm:flex flex-col w-72 lg:w-80 bg-ink shrink-0 px-8 py-10 text-white">
        <div className="mb-10">
          <span className="text-2xl font-extrabold text-accent tracking-tight">TerePay</span>
          <p className="text-xs text-white/40 mt-1">Loan application</p>
        </div>

        <LoanStepTracker />

        <div className="mt-auto pt-10 flex flex-col gap-4">
          <Link
            href="/applicant/dashboard"
            className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            <Icons.ArrowLeft size={16} />
            Back to dashboard
          </Link>

          <p className="text-xs text-white/30 leading-relaxed">
            Your information is encrypted and stored securely. We comply with NZ Privacy Act 2020.
          </p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen sm:min-h-0">
        <header className="sm:hidden sticky top-0 z-20 bg-ink px-4 h-12 flex items-center justify-between shrink-0">
          <Link
            href="/applicant/dashboard"
            className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors"
            aria-label="Back to dashboard"
          >
            <Icons.ArrowLeft size={20} />
          </Link>
          <span className="text-lg font-extrabold text-accent tracking-tight">TerePay</span>
          <div className="w-5" aria-hidden="true" />
        </header>

        <div className="sm:hidden">
          <LoanStepTracker />
        </div>

        <main className="flex-1 bg-bg overflow-auto">{children}</main>
      </div>
    </div>
  );
}
