import { cookies } from 'next/headers';
import { getAdminDb, verifySessionOrIdToken } from '@/lib/firebase/admin';
import Link from 'next/link';
import { loanPurposeLabel } from '@/lib/constants/loan-purposes';
import { Card, Pill, ButtonLink, Icons } from '@/components/ui';
import { fmtNZD, fmtDate, toDate } from '@/lib/loan/format';
import { toDisplayState, STATUS_LABELS } from '@/lib/loan/status-display';
import type { LoanDisplayState } from '@/lib/loan/status-display';

export const dynamic = 'force-dynamic';

const DISPLAY_TONE: Record<LoanDisplayState, Parameters<typeof Pill>[0]['tone']> = {
  new: 'muted',
  review: 'amber',
  approved: 'success',
  rejected: 'danger',
  active: 'info',
  paid: 'success',
};

export default async function ApplicantApplicationsPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('__session')?.value;
  if (!session) return null;

  const decoded = await verifySessionOrIdToken(session).catch(() => null);
  if (!decoded) return null;

  const db = getAdminDb();

  const userSnap = await db.collection('users').doc(decoded.uid).get();
  const customerId: string | undefined = userSnap.data()?.customerId;

  const [ownSnap, offlineSnap] = await Promise.all([
    db
      .collection('loanApplications')
      .where('applicantId', '==', decoded.uid)
      .orderBy('timeline.createdAt', 'desc')
      .get(),
    customerId
      ? db
          .collection('loanApplications')
          .where('offlineCustomerId', '==', customerId)
          .orderBy('timeline.createdAt', 'desc')
          .get()
      : Promise.resolve(null),
  ]);

  const seen = new Set<string>();
  const merged: Array<{ id: string } & Record<string, unknown>> = [];

  for (const snap of [ownSnap, offlineSnap]) {
    if (!snap) continue;
    for (const d of snap.docs) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        merged.push({ id: d.id, ...d.data() });
      }
    }
  }

  merged.sort((a, b) => {
    const ta = (a.timeline as Record<string, unknown>)?.createdAt as { _seconds?: number } | undefined;
    const tb = (b.timeline as Record<string, unknown>)?.createdAt as { _seconds?: number } | undefined;
    return (tb?._seconds ?? 0) - (ta?._seconds ?? 0);
  });

  const applications = merged;

  return (
    <div className="max-w-[640px] mx-auto px-4 sm:px-5 pt-6 pb-20 space-y-5 screen-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-text">Your applications</h1>
          <p className="mt-1 text-sm text-muted">Track every application you&apos;ve started or submitted.</p>
        </div>
        <ButtonLink href="/applicant/apply" size="sm">
          New
        </ButtonLink>
      </div>

      {applications.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-muted mb-3">No applications yet.</p>
          <ButtonLink href="/applicant/apply">Apply for your first loan</ButtonLink>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {applications.map((appDoc) => {
            const a = appDoc as Record<string, unknown>;
            const loanDetails = a.loanDetails as Record<string, unknown> | undefined;
            const status = a.status as string;
            const display = toDisplayState(status);
            const tone = DISPLAY_TONE[display];
            const ref = (a.referenceNumber as string | undefined) ?? `#${(appDoc.id as string).slice(0, 8)}`;
            const createdAt = (a.timeline as Record<string, unknown>)?.createdAt as Parameters<typeof toDate>[0];
            return (
              <Link
                key={appDoc.id}
                href={`/applicant/applications/${appDoc.id}`}
                className="group block bg-surface rounded-2xl border border-border hover:border-accent/60 hover:shadow-soft transition-all hover:-translate-y-0.5 p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-accent-2">{ref}</p>
                    <p className="mt-1 text-lg font-bold tabular-nums">
                      {fmtNZD(loanDetails?.requestedAmount as number | undefined, { cents: false })}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {loanPurposeLabel(loanDetails?.loanPurpose as string | undefined)} · {fmtDate(createdAt)}
                    </p>
                  </div>
                  <Pill tone={tone} pulse={display === 'review' || display === 'active'}>
                    {STATUS_LABELS[status] ?? status?.replace(/_/g, ' ')}
                  </Pill>
                </div>
                <div className="flex items-center justify-end gap-1 text-sm font-semibold text-accent-2 group-hover:gap-2 transition-all">
                  View details <Icons.ChevronRight size={16} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
