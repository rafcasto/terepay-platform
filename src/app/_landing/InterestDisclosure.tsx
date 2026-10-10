import type { ReactNode } from 'react';
import { InfoIcon } from './icons';

/**
 * The standing "all loans are charged interest" notice. Compliance: place one
 * beside every borrowing CTA or amount — never imply a loan is free.
 */
export default function InterestDisclosure({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="note"
      className={`flex items-start gap-2 rounded-md border border-[var(--orange-200)] bg-brand-soft px-4 py-3 text-sm leading-relaxed text-[var(--text-body)] ${className}`}
    >
      <InfoIcon size={18} strokeWidth={2.2} className="mt-px flex-none text-brand-text" />
      <span>
        <b className="font-semibold text-ink-strong">All loans are charged interest.</b> {children}
      </span>
    </div>
  );
}
