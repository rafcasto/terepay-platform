import Link from 'next/link';

export default function CTABanner() {
  return (
    <section className="py-20 px-6 bg-[#0D1B2A]">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-tight">
          Borrowing power in{' '}
          <span className="text-[#00B3A4]">your hands.</span>
        </h2>
        <p className="mt-6 text-gray-400 text-lg max-w-xl mx-auto">
          Apply now — complete a few questions to get started. Funds deposited directly to your bank
          account.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/auth/signup"
            className="px-8 py-4 bg-[#00B3A4] text-white font-bold rounded-xl hover:bg-[#007F74] transition-colors text-base shadow-lg shadow-[#00B3A4]/20"
          >
            Apply for a Loan
          </Link>
          <Link
            href="/auth/login"
            className="px-8 py-4 border-2 border-white/20 text-white font-bold rounded-xl hover:border-white/40 hover:bg-white/5 transition-colors text-base"
          >
            Existing Customer
          </Link>
        </div>
      </div>
    </section>
  );
}
