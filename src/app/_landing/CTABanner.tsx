import Link from 'next/link';
import { DEFAULT_CONTENT, type ContentSectionValues } from '@/types/content';

export default function CTABanner({ content }: { content?: ContentSectionValues }) {
  const c = { ...DEFAULT_CONTENT['landing.cta'], ...(content ?? {}) };

  return (
    <section className="bg-brand px-6 py-[clamp(48px,6vw,76px)] text-ink-strong">
      <div className="mx-auto max-w-[900px] text-center">
        <h2 className="font-serif text-[clamp(30px,4.4vw,52px)] font-semibold tracking-[-0.015em] text-ink-strong">
          {c.titleLead} {c.titleHighlight}
        </h2>
        <p className="mx-auto mt-4 max-w-[540px] text-[17px] leading-[1.5] text-[var(--ink-800)]">{c.subtitle}</p>
        <div className="mt-[26px] flex flex-wrap justify-center gap-3">
          <Link href="/auth/signup" className="tp-btn tp-btn--lg">
            {c.primaryCta}
          </Link>
        </div>
        <p className="mt-4 text-sm font-semibold text-ink-strong">{c.disclaimer}</p>
      </div>
    </section>
  );
}
