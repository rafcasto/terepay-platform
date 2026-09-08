import { Hero, HeroBalance, Pill, ProgressBar, StatGrid, ButtonLink, Confetti } from '@/components/ui';
import { fmtDate, fmtNZD, daysUntil } from '@/lib/loan/format';
import type { LoanDisplayState } from '@/lib/loan/status-display';
import { withDefaults, type ContentSectionValues } from '@/types/content';

export type DashboardHeroData = {
  state: LoanDisplayState;
  // active / paid
  loan?: {
    remainingBalance: number;
    totalPaid: number;
    nextPaymentDate: string;
    isDelinquent?: boolean;
    /** Active loan's application id — links straight to its repayment schedule. */
    applicationId?: string;
  };
  // draft / review / approved / rejected
  application?: {
    id: string;
    referenceNumber?: string;
    requestedAmount?: number;
    approvedAmount?: number;
    submittedAt?: string | null;
  };
};

/**
 * Status hero for the borrower dashboard. `content` is the editable
 * `borrower.status.<state>` section matching `data.state` (defaults applied
 * if absent), so every heading, subtitle, pill and button here is editable.
 */
export default function LoanHero({
  data,
  firstName,
  content,
}: {
  data: DashboardHeroData;
  firstName?: string | null;
  content?: ContentSectionValues;
}) {
  const c = withDefaults(`borrower.status.${data.state}`, content);

  if (data.state === 'active' && data.loan) {
    const { remainingBalance, totalPaid, nextPaymentDate, isDelinquent, applicationId } = data.loan;
    const total = totalPaid + remainingBalance;
    const repaidPct = total > 0 ? Math.round((totalPaid / total) * 100) : 0;
    const dleft = daysUntil(nextPaymentDate);
    return (
      <Hero
        eyebrow={isDelinquent ? c.delinquentEyebrow : c.eyebrow}
        subtitle={isDelinquent ? c.delinquentSubtitle : undefined}
        pill={
          isDelinquent ? (
            <Pill tone="danger" pulse onInk>
              {c.pillLate}
            </Pill>
          ) : (
            <Pill tone="success" pulse onInk>
              {c.pillOnTrack}
            </Pill>
          )
        }
      >
        <HeroBalance amount={remainingBalance} />
        <div className="mt-4">
          <ProgressBar
            value={repaidPct}
            onInk
            label={c.progressLabel}
            trailing={`${repaidPct}% repaid`}
          />
        </div>
        <div className="mt-5">
          <StatGrid
            stats={[
              { label: 'Next payment', value: fmtDate(nextPaymentDate) },
              { label: 'Repaid so far', value: fmtNZD(totalPaid) },
            ]}
          />
        </div>
        {typeof dleft === 'number' && dleft >= 0 && dleft <= 14 && !isDelinquent && (
          <p className="mt-4 text-[12.5px] text-white/60">
            Next payment in {dleft === 0 ? 'today' : `${dleft} day${dleft === 1 ? '' : 's'}`}.
          </p>
        )}
        {applicationId && (
          <div className="mt-5">
            <ButtonLink href={`/applicant/applications/${applicationId}`} variant="ghost-light" fullWidth>
              {c.cta}
            </ButtonLink>
          </div>
        )}
      </Hero>
    );
  }

  if (data.state === 'paid' && data.loan) {
    return (
      <Hero
        state="paid"
        eyebrow={c.eyebrow}
        title={`${c.title}${firstName ? `, ${firstName}` : ''}`}
        subtitle={c.subtitle}
        pill={
          <Pill tone="success" onInk>
            {c.pill}
          </Pill>
        }
      >
        <div className="relative">
          <Confetti />
          <StatGrid
            stats={[
              { label: 'Total repaid', value: fmtNZD(data.loan.totalPaid + data.loan.remainingBalance) },
            ]}
            columns={2}
          />
        </div>
      </Hero>
    );
  }

  if (data.state === 'draft') {
    const requested = data.application?.requestedAmount;
    return (
      <Hero
        eyebrow={c.eyebrow}
        title={c.title}
        subtitle={c.subtitle}
        pill={
          <Pill tone="amber" pulse onInk>
            {c.pill}
          </Pill>
        }
      >
        {requested ? (
          <StatGrid
            stats={[{ label: 'Requested', value: fmtNZD(requested) }]}
            columns={2}
          />
        ) : null}
        <div className="mt-5">
          <ButtonLink href="/applicant/apply" fullWidth>
            {c.cta}
          </ButtonLink>
        </div>
        <p className="mt-3 text-[12px] text-white/60">{c.disclaimer}</p>
      </Hero>
    );
  }

  if (data.state === 'approved' && data.application) {
    return (
      <Hero
        state="approved"
        eyebrow={c.eyebrow}
        title={c.title}
        subtitle={c.subtitle}
        pill={
          <Pill tone="success" pulse onInk>
            {c.pill}
          </Pill>
        }
      >
        <StatGrid
          stats={[
            {
              label: 'Approved',
              value: data.application.approvedAmount
                ? fmtNZD(data.application.approvedAmount)
                : fmtNZD(data.application.requestedAmount),
            },
            { label: 'Ref', value: data.application.referenceNumber ?? '—' },
          ]}
        />
        <div className="mt-5">
          <ButtonLink href={`/applicant/applications/${data.application.id}`} fullWidth>
            {c.cta}
          </ButtonLink>
        </div>
      </Hero>
    );
  }

  if (data.state === 'review' && data.application) {
    return (
      <Hero
        eyebrow={c.eyebrow}
        title={c.title}
        subtitle={c.subtitle}
        pill={
          <Pill tone="amber" pulse onInk>
            {c.pill}
          </Pill>
        }
      >
        <StatGrid
          stats={[
            { label: 'Requested', value: fmtNZD(data.application.requestedAmount) },
            { label: 'Submitted', value: fmtDate(data.application.submittedAt) },
          ]}
        />
        <div className="mt-5">
          <ButtonLink href={`/applicant/applications/${data.application.id}`} variant="ghost-light" fullWidth>
            {c.cta}
          </ButtonLink>
        </div>
      </Hero>
    );
  }

  if (data.state === 'rejected' && data.application) {
    return (
      <Hero
        state="rejected"
        eyebrow={c.eyebrow}
        title={c.title}
        subtitle={c.subtitle}
        pill={
          <Pill tone="danger" onInk>
            {c.pill}
          </Pill>
        }
      >
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/applicant/applications/${data.application.id}`} variant="ghost-light">
            {c.detailsCta}
          </ButtonLink>
          <ButtonLink href="/applicant/apply">{c.applyAgainCta}</ButtonLink>
        </div>
      </Hero>
    );
  }

  // state === 'new' (also the fallback when a status has no matching data)
  const n = withDefaults('borrower.status.new', data.state === 'new' ? content : undefined);
  return (
    <Hero eyebrow={n.eyebrow} title={n.title} subtitle={n.subtitle}>
      <ButtonLink href="/applicant/apply" fullWidth>
        {n.cta}
      </ButtonLink>
    </Hero>
  );
}
