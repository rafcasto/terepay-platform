'use client';

import { useState } from 'react';
import { DEFAULT_CONTENT, type ContentSectionValues } from '@/types/content';

export default function FAQSection({ content }: { content?: ContentSectionValues }) {
  const c = { ...DEFAULT_CONTENT['landing.faq'], ...(content ?? {}) };
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    { q: c.q1, a: c.a1 },
    { q: c.q2, a: c.a2 },
    { q: c.q3, a: c.a3 },
    { q: c.q4, a: c.a4 },
    { q: c.q5, a: c.a5 },
    { q: c.q6, a: c.a6 },
  ].filter((f) => f.q && f.q.trim().length > 0);

  return (
    <section id="faq" className="py-20 px-6 bg-white">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-semibold tracking-widest uppercase text-[#F5A523]">
            {c.eyebrow}
          </span>
          <h2 className="mt-2 text-3xl md:text-4xl font-extrabold text-[#0D1B2A]">
            {c.heading}
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-6 py-5 text-left text-[#0D1B2A] font-semibold hover:bg-gray-50 transition-colors"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                aria-expanded={openIndex === i}
              >
                <span>{faq.q}</span>
                <svg
                  className={`w-5 h-5 text-[#F5A523] flex-shrink-0 ml-4 transition-transform duration-200${
                    openIndex === i ? ' rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openIndex === i && (
                <div className="px-6 pb-5 border-t border-gray-100">
                  <p className="pt-4 text-sm text-gray-500 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
