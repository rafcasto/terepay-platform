import Link from 'next/link';
import { DEFAULT_CONTENT, type ContentSectionValues } from '@/types/content';
import InterestDisclosure from './InterestDisclosure';
import { CheckIcon, PhoneIcon } from './icons';

export default function ApplySection({ content }: { content?: ContentSectionValues }) {
  const c = { ...DEFAULT_CONTENT['landing.apply'], ...(content ?? {}) };
  const items = [c.item1, c.item2, c.item3, c.item4].filter((s) => s && s.trim().length > 0);
  const telHref = `tel:${c.helpPhone.replace(/[^\d+]/g, '')}`;

  return (
    <section id="apply" className="scroll-mt-20 bg-[var(--surface-page)] px-6 py-[clamp(56px,7vw,88px)]">
      <div className="mx-auto grid max-w-[1180px] grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-start gap-[clamp(28px,4vw,56px)]">
        <div className="min-w-0">
          <span className="tp-eyebrow mb-2.5 block">{c.eyebrow}</span>
          <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-bold tracking-[-0.02em] text-ink-strong">
            {c.heading}
          </h2>
          <div className="mt-3.5">
            <p className="text-[17px] leading-[1.55] text-ink-muted">{c.intro}</p>
          </div>
          <div className="mt-[18px]">
            <p className="text-base leading-[1.6] text-[var(--ink-800)]">{c.body}</p>
          </div>

          <div className="mt-[26px] flex flex-wrap gap-3">
            <Link href="/auth/signup" className="tp-btn tp-btn--accent tp-btn--lg">
              {c.primaryCta}
            </Link>
            <Link href="/auth/login" className="tp-btn tp-btn--secondary tp-btn--lg">
              {c.secondaryCta}
            </Link>
          </div>

          <InterestDisclosure className="mt-[18px] max-w-[460px]">{c.disclosure}</InterestDisclosure>

          <p className="block max-w-[460px] pt-3.5 text-[13px] leading-[1.5] text-ink-muted">
            {c.privacyNote}{' '}
            <a
              href="https://terepay.com/privacy-policy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-link)] underline-offset-2 hover:text-[var(--text-link-hover)] hover:underline"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>

        <div className="min-w-0 rounded-xl border border-border-default bg-surface-card p-[clamp(24px,3vw,34px)] shadow-md">
          <h3 className="font-display text-xl font-bold text-ink-strong">{c.checklistTitle}</h3>
          <div className="mb-5 mt-2.5">
            <p className="text-[15px] text-ink-muted">{c.checklistIntro}</p>
          </div>
          <ul className="flex flex-col gap-3.5">
            {items.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-success-soft-ds text-success-text">
                  <CheckIcon size={13} strokeWidth={3} />
                </span>
                <span className="text-[15px] leading-[1.5] text-[var(--ink-800)]">{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-center gap-2.5 border-t border-border-subtle pt-5">
            <PhoneIcon size={18} className="flex-none text-brand-text" />
            <span className="text-sm text-[var(--ink-800)]">
              {c.helpLine}{' '}
              <a
                href={telHref}
                className="text-[var(--text-link)] underline-offset-2 hover:text-[var(--text-link-hover)] hover:underline"
              >
                {c.helpPhone}
              </a>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
