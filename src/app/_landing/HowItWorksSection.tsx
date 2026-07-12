import { DEFAULT_CONTENT, type ContentSectionValues } from '@/types/content';

export default function HowItWorksSection({ content }: { content?: ContentSectionValues }) {
  const c = { ...DEFAULT_CONTENT['landing.howItWorks'], ...(content ?? {}) };

  const steps = [
    { number: '01', title: c.step1Title, body: c.step1Body },
    { number: '02', title: c.step2Title, body: c.step2Body },
    { number: '03', title: c.step3Title, body: c.step3Body },
  ];

  return (
    <section id="how-it-works" className="py-20 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-semibold tracking-widest uppercase text-[#F5A523]">
            {c.eyebrow}
          </span>
          <h2 className="mt-2 text-3xl md:text-4xl font-extrabold text-[#0D1B2A]">{c.heading}</h2>
          <p className="mt-4 text-gray-500 max-w-xl mx-auto">
            {c.intro}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {steps.map((step, i) => (
            <div
              key={step.number}
              className="relative bg-white border border-gray-100 rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Dashed connector (desktop only) */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-14 -right-4 w-8 border-t-2 border-dashed border-[#F5A523]/40 z-10" />
              )}
              <span className="text-6xl font-black text-[#F5A523]/15 leading-none select-none">
                {step.number}
              </span>
              <h3 className="mt-3 text-lg font-bold text-[#0D1B2A]">{step.title}</h3>
              <p className="mt-2 text-sm text-gray-500 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
