import { QIPPAY_CONSUMERS_URL, QIPPAY_DESCRIPTOR, QIPPAY_FAQ } from '@/lib/qippay/brand';
import { ChevronDownIcon } from '@/app/_landing/icons';

type Props = { className?: string };

/**
 * Payments FAQ per Merchant Brand Guidelines §7 — the three recommended
 * questions, verbatim, rendered as collapsible rows so customers can read
 * about Pay by bank with Qippay before they choose it.
 */
export function QippayFaq({ className = '' }: Props) {
  return (
    <section aria-label={`About ${QIPPAY_DESCRIPTOR}`} className={className}>
      <p className="mb-2 text-[11.5px] font-display font-semibold uppercase tracking-[0.08em] text-brand-text">
        About {QIPPAY_DESCRIPTOR}
      </p>
      <div className="flex flex-col gap-2">
        {QIPPAY_FAQ.map((f, i) => {
          const isLink = i === QIPPAY_FAQ.length - 1;
          return (
            <details key={f.q} className="group rounded-xl border border-border-default bg-surface-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 text-sm font-semibold text-ink-strong [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="flex-none text-brand-text transition-transform duration-[180ms] group-open:rotate-180">
                  <ChevronDownIcon strokeWidth={2.2} />
                </span>
              </summary>
              <p className="px-3.5 pb-3.5 text-sm leading-relaxed text-[var(--text-body)]">
                {isLink ? (
                  <>
                    Visit{' '}
                    <a
                      href={QIPPAY_CONSUMERS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-brand-text underline underline-offset-2"
                    >
                      qippay.com/consumers
                    </a>{' '}
                    for answers to common questions about paying with Qippay.
                  </>
                ) : (
                  f.a
                )}
              </p>
            </details>
          );
        })}
      </div>
    </section>
  );
}
