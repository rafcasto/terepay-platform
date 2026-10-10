import { renderEmphasis } from '@/lib/content/emphasis';
import { DEFAULT_CONTENT, type ContentSectionValues } from '@/types/content';
import { ChevronDownIcon } from './icons';

export default function FAQSection({ content }: { content?: ContentSectionValues }) {
  const c = { ...DEFAULT_CONTENT['landing.faq'], ...(content ?? {}) };

  const faqs = [
    { q: c.q1, a: c.a1 },
    { q: c.q2, a: c.a2 },
    { q: c.q3, a: c.a3 },
    { q: c.q4, a: c.a4 },
    { q: c.q5, a: c.a5 },
    { q: c.q6, a: c.a6 },
  ].filter((f) => f.q && f.q.trim().length > 0);

  return (
    <section id="faq" className="scroll-mt-20 bg-surface-card px-6 py-[clamp(56px,7vw,88px)]">
      <div className="mx-auto max-w-[860px]">
        <span className="tp-eyebrow mb-2.5 block">{c.eyebrow}</span>
        <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-bold tracking-[-0.02em] text-ink-strong">
          {c.heading}
        </h2>

        <div className="mt-8 flex flex-col gap-2.5">
          {faqs.map((faq, i) => (
            <details
              key={faq.q}
              open={i === 0}
              className="group rounded-card border border-border-default bg-surface-card p-1"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-[18px] font-display text-[17px] font-semibold text-ink-strong [&::-webkit-details-marker]:hidden">
                {faq.q}
                <span className="flex-none text-brand-text transition-transform duration-[180ms] group-open:rotate-180">
                  <ChevronDownIcon strokeWidth={2.2} />
                </span>
              </summary>
              <div className="whitespace-pre-line px-5 pb-5 text-[15px] leading-[1.6] text-[var(--ink-800)]">
                {renderEmphasis(faq.a)}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
