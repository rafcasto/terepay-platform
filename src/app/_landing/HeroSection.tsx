import Link from 'next/link';

export default function HeroSection() {
  const badges = [
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="#00B3A4" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      label: 'Fast Approval',
      sub: 'Decisions in 24 hours',
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="#00B3A4" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
      label: 'Responsible Lending',
      sub: 'We lend what you can repay',
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="#00B3A4" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      ),
      label: 'Transparent Terms',
      sub: 'No hidden fees ever',
    },
  ];

  return (
    <section className="bg-gradient-to-br from-[#E6F9F8] via-white to-white py-20 md:py-32 px-6">
      <div className="max-w-6xl mx-auto text-center">
        <span className="inline-block mb-4 px-4 py-1.5 text-xs font-semibold tracking-widest uppercase text-[#00B3A4] bg-[#00B3A4]/10 rounded-full">
          New Zealand&apos;s Community Lender
        </span>
        <h1 className="text-4xl md:text-6xl font-extrabold text-[#0D1B2A] leading-tight max-w-3xl mx-auto">
          Borrow Now,{' '}
          <span className="text-[#00B3A4]">Pay Later</span>{' '}
          with TerePay
        </h1>
        <p className="mt-6 text-lg md:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
          Experience the flexibility of accessing funds when you need them the most while managing your finances.
        </p>
        <p className="mt-2 text-sm text-gray-400">All loans are charged interest — see our rates below.</p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/auth/signup"
            className="px-8 py-4 bg-[#00B3A4] text-white font-bold rounded-xl hover:bg-[#007F74] transition-colors shadow-lg shadow-[#00B3A4]/25 text-base"
          >
            Ready To Borrow?
          </Link>
          <Link
            href="/auth/login"
            className="px-8 py-4 border-2 border-[#0D1B2A] text-[#0D1B2A] font-bold rounded-xl hover:bg-[#0D1B2A] hover:text-white transition-colors text-base"
          >
            Sign In
          </Link>
        </div>

        {/* Trust badges */}
        <div className="mt-16 flex flex-col sm:flex-row justify-center gap-8 sm:gap-12">
          {badges.map((badge) => (
            <div key={badge.label} className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#00B3A4]/10 flex items-center justify-center flex-shrink-0">
                {badge.icon}
              </div>
              <div className="text-left">
                <p className="font-semibold text-[#0D1B2A] text-sm">{badge.label}</p>
                <p className="text-xs text-gray-500">{badge.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
