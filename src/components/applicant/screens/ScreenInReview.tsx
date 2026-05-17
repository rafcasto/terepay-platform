import { Hero, Pill, Stepper, type Step } from '@/components/ui';
import { fmtDate, fmtNZD } from '@/lib/loan/format';
import type { LoanApplication, AnyApplicationStatus, ApplicationDocument } from '@/types/application';
import { PROGRESS_STEPS, SectionCard, STATUS_COMPLETED_COUNT, Field } from './shared';
import DocumentUploadCard from './DocumentUploadCard';

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
  const showUpload = status === 'waiting_for_docs';
  const existingDocuments: ApplicationDocument[] = (app.documents as ApplicationDocument[] | undefined) ?? [];

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

      {showUpload && (
        <DocumentUploadCard
          applicationId={applicationId}
          requiredDocuments={docRequest?.requiredDocuments}
          message={docRequest?.message}
          existingDocuments={existingDocuments}
        />
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
