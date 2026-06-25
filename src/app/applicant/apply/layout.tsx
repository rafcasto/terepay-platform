import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
    <div className="min-h-screen flex flex-col sm:flex-row bg-[var(--surface-page)]">
      {/* ── Sidebar (desktop) ──────────────────────────────────────────── */}
      <aside className="hidden sm:flex flex-col w-72 lg:w-80 shrink-0 bg-surface-inverse text-white px-8 py-10">
        <div className="mb-12">
          <Image
            src="/brand/terepay-wordmark-white.png"
            alt="TerePay"
            width={720}
            height={216}
            priority
            className="h-7 w-auto"
          />
          <p className="mt-4 text-[11px] font-display font-semibold uppercase tracking-[0.08em] text-white/45">
            Loan application
          </p>
        </div>

        <LoanStepTracker />

        <div className="mt-auto pt-10 flex flex-col gap-4">
          <Link
            href="/applicant/dashboard"
            className="flex items-center gap-2 text-sm text-white/55 hover:text-white transition-colors"
          >
            <Icons.ArrowLeft size={16} />
            Back to dashboard
          </Link>

          <div className="flex items-start gap-2.5 text-white/55">
            <Icons.ShieldCheck size={18} className="shrink-0 mt-0.5 text-[var(--gold-300)]" />
            <p className="text-xs leading-relaxed">
              Your information is encrypted and stored securely. We comply with the NZ Privacy Act 2020.
            </p>
          </div>
        </div>
      </aside>

      {/* ── Main column ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen sm:min-h-0">
        <header className="sm:hidden sticky top-0 z-20 bg-surface-inverse px-4 h-14 flex items-center justify-between shrink-0">
          <Link
            href="/applicant/dashboard"
            className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors"
            aria-label="Back to dashboard"
          >
            <Icons.ArrowLeft size={20} />
          </Link>
          <Image
            src="/brand/terepay-wordmark-white.png"
            alt="TerePay"
            width={720}
            height={216}
            priority
            className="h-5 w-auto"
          />
          <div className="w-5" aria-hidden="true" />
        </header>

        <div className="sm:hidden">
          <LoanStepTracker />
        </div>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
