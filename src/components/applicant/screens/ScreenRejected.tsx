import { Hero, Pill, ButtonLink } from '@/components/ui';
import type { LoanApplication, AnyApplicationStatus } from '@/types/application';
import { SectionCard } from './shared';

interface Props {
  app: LoanApplication & Record<string, unknown>;
  status: AnyApplicationStatus;
  applicationId: string;
}

export default function ScreenRejected({ app, status, applicationId }: Props) {
  const decision = app.decision;
  const refNum = (app.referenceNumber as string | undefined) ?? `#${applicationId.slice(0, 8)}`;
  const isOfferDeclined = status === 'offer_declined';
  const isExpired = status === 'expired';

  const title = isOfferDeclined
    ? 'Offer declined'
    : isExpired
      ? 'Application expired'
      : "We couldn't approve this time";

  const subtitle = isOfferDeclined
    ? 'You declined this loan offer. You can apply again whenever you’re ready.'
    : isExpired
      ? 'This application is no longer active. Start a fresh one when you’re ready.'
      : "We're sorry — your application wasn't approved. The details below explain why.";

  return (
    <div className="space-y-5">
      <Hero
        state="rejected"
        eyebrow={`Application ${refNum}`}
        title={title}
        subtitle={subtitle}
        pill={
          <Pill tone="danger" onInk>
            {isOfferDeclined ? 'Declined' : isExpired ? 'Expired' : 'Not approved'}
          </Pill>
        }
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/applicant/apply">Apply again</ButtonLink>
          <ButtonLink href="/applicant/applications" variant="ghost-light">
            See application history
          </ButtonLink>
        </div>
      </Hero>

      {!isOfferDeclined && decision?.declineReasons && decision.declineReasons.length > 0 && (
        <SectionCard eyebrow="Decision" title="Why we couldn't approve">
          <ul className="space-y-2 text-sm text-text">
            {decision.declineReasons.map((r) => (
              <li key={r} className="flex items-start gap-2">
                <span className="mt-2 h-1 w-1 rounded-full bg-danger shrink-0" />
                {r}
              </li>
            ))}
          </ul>
          {decision.rationale && (
            <p className="mt-4 text-sm text-muted leading-relaxed">{decision.rationale}</p>
          )}
        </SectionCard>
      )}

      <SectionCard eyebrow="What's next" title="Things you can do">
        <ul className="space-y-3 text-sm text-text">
          <li>
            <span className="font-semibold">Review your finances.</span> Try to clear short-term debts before
            re-applying — it can improve your chances.
          </li>
          <li>
            <span className="font-semibold">Update your details.</span> Make sure your employment and income are
            up to date in your profile.
          </li>
          <li>
            <span className="font-semibold">Talk to us.</span> Email{' '}
            <a className="font-semibold text-accent-2 hover:underline" href="mailto:support@terepay.co.nz">
              support@terepay.co.nz
            </a>{' '}
            if you have questions.
          </li>
        </ul>
      </SectionCard>
    </div>
  );
}
