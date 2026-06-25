import { Hero, Pill, ButtonLink } from '@/components/ui';
import { fmtNZD } from '@/lib/loan/format';
import type { LoanApplication } from '@/types/application';
import SubmitButton from '@/app/applicant/applications/[id]/SubmitButton';
import { SectionCard, Field } from './shared';

interface Props {
  app: LoanApplication & Record<string, unknown>;
  applicationId: string;
}

export default function ScreenDraft({ app, applicationId }: Props) {
  const ld = app.loanDetails;
  const refNum = (app.referenceNumber as string | undefined) ?? `#${applicationId.slice(0, 8)}`;

  return (
    <div className="space-y-5">
      <Hero
        eyebrow={`Application ${refNum}`}
        title="Your draft is saved"
        subtitle="Pick up where you left off, or submit when you're ready."
        pill={
          <Pill tone="muted" onInk>
            Draft
          </Pill>
        }
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/applicant/apply">Continue application</ButtonLink>
        </div>
      </Hero>

      <SectionCard eyebrow="Draft" title="What you've entered">
        <dl className="grid grid-cols-2 gap-4">
          <Field label="Requested amount" value={fmtNZD(ld?.requestedAmount)} />
          <Field label="Purpose" value={(ld?.loanPurpose as string)?.replace(/_/g, ' ')} />
        </dl>
        <div className="mt-5">
          <SubmitButton id={applicationId} />
        </div>
      </SectionCard>
    </div>
  );
}
