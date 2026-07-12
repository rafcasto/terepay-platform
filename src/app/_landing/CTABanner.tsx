import Link from 'next/link';
import { DEFAULT_CONTENT, type ContentSectionValues } from '@/types/content';

export default function CTABanner({ content }: { content?: ContentSectionValues }) {
  const c = { ...DEFAULT_CONTENT['landing.cta'], ...(content ?? {}) };

  return (
    <section className="py-20 px-6 bg-[#0D1B2A]">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-tight">
          {c.titleLead}{' '}
          <span className="text-[#F5A523]">{c.titleHighlight}</span>
        </h2>
        <p className="mt-6 text-gray-400 text-lg max-w-xl mx-auto">
          {c.subtitle}
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/auth/signup"
            className="px-8 py-4 bg-[#F5A523] text-white font-bold rounded-xl hover:bg-[#E08B00] transition-colors text-base shadow-lg shadow-[#F5A523]/20"
          >
            {c.primaryCta}
          </Link>
          <Link
            href="/auth/login"
            className="px-8 py-4 border-2 border-white/20 text-white font-bold rounded-xl hover:border-white/40 hover:bg-white/5 transition-colors text-base"
          >
            {c.secondaryCta}
          </Link>
        </div>
      </div>
    </section>
  );
}
