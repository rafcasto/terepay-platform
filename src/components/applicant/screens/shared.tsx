import type { ReactNode } from 'react';
import { Card, CardHeader } from '@/components/ui';

export const PROGRESS_STEPS: Array<{ label: string; description: string }> = [
  { label: 'Application submitted', description: 'Your application has been received and queued for review.' },
  { label: 'Lender review', description: 'A lender picks up your application and begins the assessment.' },
  { label: 'Credit & income check', description: 'Income, expenses, and credit are verified before a decision.' },
  { label: 'Decision', description: 'You are notified of the loan outcome, typically within 1–2 business days.' },
  { label: 'Funds disbursed', description: 'Funds are transferred directly to your bank account.' },
];

// Number of completed steps for a given LMS status.
export const STATUS_COMPLETED_COUNT: Record<string, number> = {
  draft: 0,
  pending_review: 1,
  under_assessment: 1,
  waiting_for_docs: 1,
  credit_check: 2,
  approved: 4,
  loan_accepted: 4,
  awaiting_payment_consent: 4,
  offer_declined: 4,
  disbursed: 5,
  active: 5,
  closed_repaid: 5,
  declined: 3,
  withdrawn: 1,
  expired: 1,
  // legacy
  submitted: 1,
  under_review: 1,
  funded: 5,
  completed: 5,
  rejected: 3,
};

export function Field({ label, value }: { label: ReactNode; value?: ReactNode }) {
  return (
    <div>
      <dt className="text-[11.5px] font-semibold tracking-[0.06em] uppercase text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-text break-words">{value ?? '—'}</dd>
    </div>
  );
}

interface SectionCardProps {
  eyebrow?: string;
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

export function SectionCard({ eyebrow, title, action, children }: SectionCardProps) {
  return (
    <Card>
      {(eyebrow || title || action) && <CardHeader eyebrow={eyebrow} title={title} action={action} />}
      <div className={eyebrow || title ? 'mt-4' : ''}>{children}</div>
    </Card>
  );
}
