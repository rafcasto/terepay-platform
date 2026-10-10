'use client';

import { useEffect, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, StarIcon } from './icons';

// Customer quotes are user-generated content and are kept verbatim.
const TESTIMONIALS = [
  { name: 'Shahara', quote: 'Thank you for helping during times of need.' },
  { name: 'Walter', quote: 'Your service is a great help to people.' },
  { name: 'Eric Arambulo', quote: 'Thank you so much TerePay. A big helped ..Thumbs up' },
  {
    name: 'Lyn',
    quote: "I want to thank TerePay for helping my friend and me. You're such a blessing to Us. God bless you",
  },
];

const AUTO_ADVANCE_MS = 4000;

function scrollRail(el: HTMLElement, dir: 1 | -1) {
  el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 640), behavior: 'smooth' });
}

const navBtnCls =
  'absolute top-1/2 z-[2] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--ink-900)] text-white shadow-md transition-colors duration-[120ms] hover:bg-[var(--orange-600)]';

export default function TestimonialsSection() {
  const railRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      const el = railRef.current;
      if (!el || pausedRef.current) return;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        scrollRail(el, 1);
      }
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, []);

  const pause = () => {
    pausedRef.current = true;
  };
  const resume = () => {
    pausedRef.current = false;
  };

  return (
    <section className="bg-surface-card px-6 py-[clamp(56px,7vw,88px)]" aria-labelledby="testimonials-heading">
      <div className="mx-auto max-w-[1180px]">
        <h2
          id="testimonials-heading"
          className="mb-8 font-display text-[clamp(28px,3.4vw,40px)] font-bold tracking-[-0.02em] text-ink-strong"
        >
          What people say about us...
        </h2>

        <div className="relative px-[52px]">
          <button
            type="button"
            aria-label="Previous testimonials"
            onClick={() => railRef.current && scrollRail(railRef.current, -1)}
            className={`${navBtnCls} left-0`}
          >
            <ChevronLeftIcon size={18} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            aria-label="Next testimonials"
            onClick={() => railRef.current && scrollRail(railRef.current, 1)}
            className={`${navBtnCls} right-0`}
          >
            <ChevronRightIcon size={18} strokeWidth={2.2} />
          </button>

          <div
            ref={railRef}
            onMouseEnter={pause}
            onMouseLeave={resume}
            onTouchStart={pause}
            onFocus={pause}
            onBlur={resume}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-0.5 pb-3.5 pt-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.name}
                className="flex w-[min(300px,78vw)] flex-none snap-start flex-col rounded-card bg-brand-soft p-6 shadow-md"
              >
                <figcaption className="font-display text-base font-bold text-ink-strong">{t.name}</figcaption>
                <div className="mt-3 flex gap-[3px] text-gold" aria-label="Rated 5 out of 5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <StarIcon key={i} />
                  ))}
                </div>
                <blockquote className="mt-3.5 text-base leading-[1.5] text-[var(--ink-800)]">{t.quote}</blockquote>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
