export default function HowItWorksSection() {
  const steps = [
    {
      number: '01',
      title: 'Apply Online',
      body: 'Complete our quick and simple application form from any device. It only takes a few minutes.',
    },
    {
      number: '02',
      title: 'Get Approved',
      body: 'We assess your application as a responsible lender and provide a decision within 24 hours.',
    },
    {
      number: '03',
      title: 'Receive Funds',
      body: 'Once approved, funds are transferred directly into your bank account — fast and hassle-free.',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-semibold tracking-widest uppercase text-[#F5A523]">
            Simple Process
          </span>
          <h2 className="mt-2 text-3xl md:text-4xl font-extrabold text-[#0D1B2A]">How It Works</h2>
          <p className="mt-4 text-gray-500 max-w-xl mx-auto">
            Getting a TerePay loan is quick and straightforward — three steps stand between you and the
            funds you need.
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
