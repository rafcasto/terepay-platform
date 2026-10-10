import { DEFAULT_CONTENT, type ContentSectionValues } from '@/types/content';

export default function UsesSection({ content }: { content?: ContentSectionValues }) {
  const c = { ...DEFAULT_CONTENT['landing.uses'], ...(content ?? {}) };

  const uses = [
    { n: '01', title: c.use1Title, body: c.use1Body },
    { n: '02', title: c.use2Title, body: c.use2Body },
    { n: '03', title: c.use3Title, body: c.use3Body },
    { n: '04', title: c.use4Title, body: c.use4Body },
  ].filter((u) => u.title);

  return (
    <section id="uses" className="scroll-mt-20 bg-brand-soft px-6 py-[clamp(56px,7vw,88px)]">
      <div className="mx-auto grid max-w-[1180px] grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-start gap-[clamp(28px,5vw,64px)]">
        <div className="min-w-0 md:sticky md:top-[90px]">
          <span className="tp-eyebrow mb-3 block">{c.eyebrow}</span>
          <h2 className="font-serif text-[clamp(30px,3.8vw,46px)] font-semibold leading-[1.12] tracking-[-0.015em] text-ink-strong text-balance">
            {c.heading}
          </h2>
          <div className="mt-4 max-w-[420px]">
            <p className="text-[17px] leading-[1.6] text-ink-muted">{c.intro}</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <ol className="flex flex-col">
            {uses.map((u, i) => (
              <li
                key={u.n}
                className={`flex items-baseline gap-5 border-t border-border-default py-[22px]${
                  i === uses.length - 1 ? ' border-b' : ''
                }`}
              >
                <span className="flex-none font-tabular text-[13px] text-brand-text">{u.n}</span>
                <div className="flex min-w-0 flex-col gap-2">
                  <h3 className="font-display text-[clamp(19px,2.2vw,24px)] font-semibold text-ink-strong">
                    {u.title}
                  </h3>
                  <p className="text-[15px] leading-[1.55] text-ink-muted">{u.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-sm text-ink-muted">{c.footnote}</p>
        </div>
      </div>
    </section>
  );
}
