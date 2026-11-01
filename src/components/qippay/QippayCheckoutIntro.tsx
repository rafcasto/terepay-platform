import type { ReactNode } from 'react';
import { QIPPAY_CHECKOUT_COPY, QIPPAY_CHECKOUT_STEPS } from '@/lib/qippay/brand';

type Props = {
  /** Override the guideline steps (defaults to §5 "Checkout instructions"). */
  steps?: readonly string[];
  /** Merchant-side line rendered after the steps (e.g. CCCFA cost / consent note). */
  note?: ReactNode;
  className?: string;
};

/**
 * Checkout copy + instructions per Merchant Brand Guidelines §5: the title is
 * the product descriptor, followed by the short description and the four
 * numbered steps so the customer knows what to expect before they start.
 */
export function QippayCheckoutIntro({ steps = QIPPAY_CHECKOUT_STEPS, note, className = '' }: Props) {
  return (
    <div className={`rounded-xl border border-border-default bg-surface-card p-4 ${className}`}>
      <p className="text-[15px] font-semibold text-ink-strong">{QIPPAY_CHECKOUT_COPY.title}</p>
      <p className="mt-1 text-sm text-[var(--text-body)]">{QIPPAY_CHECKOUT_COPY.short}</p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-[var(--text-body)]">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {note && <p className="mt-3 text-xs text-muted">{note}</p>}
    </div>
  );
}
