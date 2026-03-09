export default function FeaturesSection() {
  const features = [
    {
      title: 'Fast Approval',
      body: 'Submit your application and receive a lending decision in as little as 24 hours. We know time matters.',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      title: 'Transparent Terms',
      body: 'Interest rate of 4.7% for the 8-week term, plus a $20 admin fee. No hidden charges — ever.',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      title: 'Responsible Lending',
      body: 'We ensure every loan meets your needs and that you can repay comfortably without financial hardship.',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
    },
  ];

  return (
    <section className="py-20 px-6 bg-[#FEF7E9]/40">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-semibold tracking-widest uppercase text-[#F5A523]">
            Why TerePay
          </span>
          <h2 className="mt-2 text-3xl md:text-4xl font-extrabold text-[#0D1B2A]">Built Around You</h2>
          <p className="mt-4 text-gray-500 max-w-xl mx-auto">
            A lending experience designed with your needs in mind from start to finish.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="h-1.5 bg-[#F5A523]" />
              <div className="p-8">
                <div className="w-12 h-12 rounded-xl bg-[#F5A523]/10 flex items-center justify-center text-[#F5A523] mb-5">
                  {f.icon}
                </div>
                <h3 className="font-bold text-[#0D1B2A] text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
