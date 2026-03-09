import Link from 'next/link';

const loanRows = [
  { label: 'Interest Rate', value: '4.7%', sub: 'for the 8-week term' },
  { label: 'Admin Fee', value: '$20', sub: 'one-time (new customers $50)' },
  { label: 'Total Repayable', value: '$1,067', sub: 'over 8 weeks' },
  { label: 'Fortnightly Payment', value: '$266.75', sub: '× 4 payments' },
];

export default function LoanSummaryCard() {
  return (
    <section className="py-20 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-semibold tracking-widest uppercase text-[#00B3A4]">
            Loan Details
          </span>
          <h2 className="mt-2 text-3xl md:text-4xl font-extrabold text-[#0D1B2A]">
            What Does a TerePay Loan Cost?
          </h2>
          <p className="mt-4 text-gray-500 max-w-xl mx-auto">
            Here&apos;s a clear example of our loan terms. No surprises.
          </p>
        </div>

        <div className="bg-gradient-to-br from-[#0D1B2A] to-[#1a2f45] rounded-3xl p-8 md:p-12 text-white max-w-3xl mx-auto shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
            {/* Amount */}
            <div className="flex-shrink-0">
              <p className="text-[#00B3A4] text-sm font-semibold uppercase tracking-widest mb-1">
                Example Loan
              </p>
              <p className="text-6xl font-black leading-none">$1,000</p>
              <p className="text-gray-400 text-sm mt-2">Loan amount (max $2,000)</p>
            </div>

            {/* Breakdown */}
            <div className="flex-1 flex flex-col gap-0 divide-y divide-white/10">
              {loanRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between py-3">
                  <span className="text-gray-400 text-sm">{row.label}</span>
                  <div className="text-right">
                    <span className="font-bold text-white">{row.value}</span>
                    <span className="text-xs text-gray-500 ml-2">{row.sub}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-8 text-xs text-gray-500 text-center">
            Loan amounts range from $1,000 – $2,000. All figures are illustrative. See our{' '}
            <a
              href="https://terepay.com/rates-and-fees-policy/"
              className="underline hover:text-white transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              Fees &amp; Charges policy
            </a>{' '}
            for full details.
          </p>

          <div className="mt-8 text-center">
            <Link
              href="/auth/signup"
              className="inline-block px-8 py-4 bg-[#00B3A4] text-white font-bold rounded-xl hover:bg-[#007F74] transition-colors shadow-lg shadow-[#00B3A4]/20"
            >
              Ready to Apply?
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
