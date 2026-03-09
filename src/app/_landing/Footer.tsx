import Link from 'next/link';

const legalLinks = [
  { label: 'Annual Interest Rate', href: 'https://terepay.com/disclosure-statement/' },
  { label: 'Fees & Charges', href: 'https://terepay.com/rates-and-fees-policy/' },
  { label: 'Financial Difficulty Policy', href: 'https://terepay.com/unforeseen-financial-hardship-policy/' },
  { label: 'Complaints & Dispute Resolution', href: 'https://terepay.com/dispute-resolution-policy/' },
  { label: 'Terms & Conditions', href: 'https://terepay.com/terms-and-conditions/' },
  { label: 'Privacy Policy', href: 'https://terepay.com/privacy-policy/' },
  { label: 'Disclosure Statement', href: 'https://terepay.com/disclosure-statement/' },
];

export default function Footer() {
  return (
    <footer id="contact" className="bg-[#0D1B2A] border-t border-white/10 px-6">
      <div className="max-w-6xl mx-auto py-16 grid grid-cols-1 md:grid-cols-3 gap-12">
        {/* Brand column */}
        <div>
          <Link href="/" className="text-2xl font-bold text-[#F5A523] tracking-tight">
            TerePay
          </Link>
          <p className="mt-4 text-sm text-gray-400 leading-relaxed max-w-xs">
            TerePay Neophile Ltd — a responsible New Zealand lender helping people access funds when they
            need them most.
          </p>
          <div className="mt-6 flex gap-3">
            {/* Facebook */}
            <a
              href="https://www.facebook.com/NeophileFinance/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TerePay on Facebook"
              className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/20 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
            </a>
            {/* LinkedIn */}
            <a
              href="https://www.linkedin.com/company/terepay"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TerePay on LinkedIn"
              className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/20 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Important Information */}
        <div>
          <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-6">
            Important Information
          </h3>
          <ul className="flex flex-col gap-3">
            {legalLinks.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-400 hover:text-[#F5A523] transition-colors"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <a
              href="https://drive.google.com/file/d/1weraj0jfc1yPtet0bQV-fu332cpVTJG9/view?usp=share_link"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#F5A523] hover:underline"
            >
              Contract and Agreement →
            </a>
          </div>
        </div>

        {/* Contact */}
        <div>
          <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-6">Contact Us</h3>
          <address className="not-italic flex flex-col gap-5">
            <div className="flex gap-3">
              <svg
                className="w-4 h-4 text-[#F5A523] mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-sm text-gray-400 leading-relaxed">
                27 Henry Partington Place,
                <br />
                Greenhithe, Auckland
              </span>
            </div>
            <div className="flex gap-3 items-center">
              <svg
                className="w-4 h-4 text-[#F5A523] flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <a
                href="mailto:info@terepay.com"
                className="text-sm text-gray-400 hover:text-[#F5A523] transition-colors"
              >
                info@terepay.com
              </a>
            </div>
            <div className="flex gap-3 items-center">
              <svg
                className="w-4 h-4 text-[#F5A523] flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              <a
                href="tel:+6498867158"
                className="text-sm text-gray-400 hover:text-[#F5A523] transition-colors"
              >
                +64 9 886 7158
              </a>
            </div>
          </address>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-6xl mx-auto">
        <p className="text-xs text-gray-600 text-center sm:text-left">
          © {new Date().getFullYear()} TerePay Neophile Ltd. All rights reserved.
        </p>
        <p className="text-xs text-gray-600">
          A member of{' '}
          <a
            href="https://fintechnz.org.nz/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors"
          >
            FinTechNZ
          </a>
        </p>
      </div>
    </footer>
  );
}
