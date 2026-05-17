import { Hero, Pill, Stepper, type Step } from '@/components/ui';
import { fmtDate, fmtNZD } from '@/lib/loan/format';
import type { LoanApplication, AnyApplicationStatus } from '@/types/application';
import { PROGRESS_STEPS, SectionCard, STATUS_COMPLETED_COUNT, Field } from './shared';

interface Props {
  app: LoanApplication & Record<string, unknown>;
  status: AnyApplicationStatus;
  applicationId: string;
}

export default function ScreenInReview({ app, status, applicationId }: Props) {
  const completed = STATUS_COMPLETED_COUNT[status as string] ?? 1;
  const steps: Step[] = PROGRESS_STEPS.map((s, i) => ({
    label: s.label,
    description: s.description,
    status: i < completed ? 'done' : i === completed ? 'active' : 'pending',
  }));

  const ld = app.loanDetails;
  const submitted = (app.timeline as { submittedAt?: unknown } | undefined)?.submittedAt ?? null;
  const refNum = (app.referenceNumber as string | undefined) ?? `#${applicationId.slice(0, 8)}`;
  const docRequest = app.documentRequest as { requiredDocuments?: string[]; message?: string } | undefined;
  const showDocBanner = status === 'waiting_for_docs' && docRequest?.requiredDocuments?.length;

  return (
    <div className="space-y-5">
      <Hero
        eyebrow={`Application ${refNum}`}
        emoji="🔎"
        title="Your application is being reviewed"
        subtitle={
          status === 'credit_check'
            ? 'Your credit and income are being verified. This usually takes 1–2 business days.'
            : 'A lender will review your details and let you know the outcome shortly.'
        }
        pill={
          <Pill tone="amber" pulse onInk>
            In review
          </Pill>
        }
      />

      <SectionCard eyebrow="Loan progress" title="Where your application is">
        <Stepper steps={steps} />
      </SectionCard>

      {showDocBanner && (
        <SectionCard
          eyebrow="Action needed"
          title="Documents requested"
          action={<Pill tone="warn">{docRequest.requiredDocuments?.length} required</Pill>}
        >
          <p className="text-sm text-muted mb-3">
            Your lender has requested the following documents:
          </p>
          <ul className="space-y-1.5 text-sm text-text">
            {docRequest.requiredDocuments!.map((d) => (
              <li key={d} className="flex items-start gap-2">
                <span className="mt-2 h-1 w-1 rounded-full bg-accent shrink-0" />
                {d}
              </li>
            ))}
          </ul>
          {docRequest.message && (
            <p className="mt-3 text-sm text-warn">{docRequest.message}</p>
          )}
          <p className="mt-4 text-xs text-muted">
            Please contact your lender or upload documents through the TerePay portal.
          </p>
        </SectionCard>
      )}

      <SectionCard eyebrow="Your application" title="Loan details">
        <dl className="grid grid-cols-2 gap-4">
          <Field label="Requested amount" value={fmtNZD(ld?.requestedAmount)} />
          <Field label="Purpose" value={(ld?.loanPurpose as string)?.replace(/_/g, ' ')} />
          <Field label="Submitted" value={fmtDate(submitted as Parameters<typeof fmtDate>[0])} />
          <Field label="Reference" value={refNum} />
        </dl>
      </SectionCard>
    </div>
  );
}
