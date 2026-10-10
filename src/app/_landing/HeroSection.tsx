import Image from 'next/image';
import Link from 'next/link';
import { DEFAULT_CONTENT, type ContentSectionValues } from '@/types/content';

export default function HeroSection({ content }: { content?: ContentSectionValues }) {
  const c = { ...DEFAULT_CONTENT['landing.hero'], ...(content ?? {}) };

  const stats = [
    { value: c.stat1Value, label: c.stat1Label },
    { value: c.stat2Value, label: c.stat2Label },
    { value: c.stat3Value, label: c.stat3Label },
  ].filter((s) => s.value);

  return (
    <section id="top" className="relative overflow-hidden bg-[var(--ink-950)] text-[var(--text-on-inverse)]">
      {/* Warm radial glow, top-right */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[160px] -top-[220px] h-[620px] w-[620px] rounded-full bg-[radial-gradient(circle,rgba(240,128,0,0.30),rgba(240,128,0,0)_66%)]"
      />

      <div className="relative mx-auto flex max-w-[1180px] flex-wrap items-center gap-[clamp(32px,5vw,56px)] px-6 pb-[clamp(88px,10vw,132px)] pt-[clamp(56px,8vw,104px)]">
        {/* Copy */}
        <div className="min-w-0 flex-[1_1_320px]">
          <span className="inline-block rounded-pill border border-[rgba(251,199,141,0.35)] px-3.5 py-[7px] font-display text-xs font-semibold uppercase tracking-[.14em] text-gold-light">
            {c.badge}
          </span>
          <h1 className="mt-[22px] font-display text-[clamp(38px,5.6vw,66px)] font-bold leading-[1.02] tracking-[-0.025em] text-white text-balance">
            {c.titleLead}{' '}
            <span className="font-serif font-semibold text-gold-light">{c.titleHighlight}</span>
            {c.titleTail ? ` ${c.titleTail}` : null}
          </h1>
          <p className="mt-5 max-w-[520px] text-[clamp(17px,1.6vw,20px)] leading-[1.55] text-[rgba(234,240,247,0.78)] text-pretty">
            {c.subtitle}
          </p>
          <p className="mt-4 text-sm font-semibold text-gold-light">{c.disclaimer}</p>

          <div className="mt-[30px] flex flex-wrap gap-3">
            <Link href="/auth/signup" className="tp-btn tp-btn--accent tp-btn--lg">
              {c.primaryCta}
            </Link>
            <a
              href="#calculator"
              className="inline-flex h-[52px] items-center rounded-md border border-white/[0.28] px-6 font-display text-[15px] font-semibold text-white transition-colors duration-[120ms] hover:bg-white/[0.08]"
            >
              {c.secondaryCta}
            </a>
          </div>

          {stats.length > 0 && (
            <dl className="mt-10 flex flex-wrap gap-7">
              {stats.map((s) => (
                <div key={s.label} className="min-w-0">
                  <dd className="font-tabular text-[26px] font-semibold text-white">{s.value}</dd>
                  <dt className="mt-0.5 text-[13px] text-[rgba(234,240,247,0.6)]">{s.label}</dt>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* Photo grid */}
        <div className="relative grid min-w-0 flex-[1.45_1_380px] grid-cols-[1.35fr_1fr] grid-rows-[auto_auto] gap-4">
          <div className="relative row-span-2 aspect-[3/4] overflow-hidden rounded-xl">
            <Image
              src="/landing/hero-family.png"
              alt="A family sitting together at home, smiling"
              fill
              priority
              sizes="(min-width: 1024px) 400px, 55vw"
              className="object-cover"
            />
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl">
            <Image
              src="/landing/hero-call.png"
              alt="A woman smiling while on a phone call"
              fill
              sizes="(min-width: 1024px) 300px, 40vw"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col justify-center rounded-xl bg-brand p-5 text-ink-strong">
            <div className="font-display text-[15px] font-bold leading-[1.3]">{c.tileTitle}</div>
            <div className="mt-2 text-[13px] leading-[1.4]">{c.tileBody}</div>
          </div>
        </div>
      </div>

      <div className="tp-wave absolute -bottom-px left-0 text-surface-card" aria-hidden="true" />
    </section>
  );
}
