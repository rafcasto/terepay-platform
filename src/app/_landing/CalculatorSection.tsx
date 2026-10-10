import { DEFAULT_CONTENT, type ContentSectionValues } from '@/types/content';
import LoanCalculator from './LoanCalculator';

export default function CalculatorSection({ content }: { content?: ContentSectionValues }) {
  const c = { ...DEFAULT_CONTENT['landing.calculator'], ...(content ?? {}) };

  return (
    <section id="calculator" className="scroll-mt-20 bg-surface-card px-6 py-[clamp(56px,7vw,88px)]">
      <div className="mx-auto max-w-[1180px]">
        <div className="max-w-[620px]">
          <span className="tp-eyebrow mb-2.5 block">{c.eyebrow}</span>
          <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-bold tracking-[-0.02em] text-ink-strong">
            {c.heading}
          </h2>
          <div className="mt-3.5">
            <p className="text-[17px] leading-[1.55] text-ink-muted">{c.intro}</p>
          </div>
        </div>
        <LoanCalculator ctaLabel={c.cta} disclosure={c.disclosure} />
      </div>
    </section>
  );
}
