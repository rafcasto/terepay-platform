'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handle = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handle, { passive: true });
    return () => window.removeEventListener('scroll', handle);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 bg-[#0D1B2A] transition-shadow${
        scrolled ? ' shadow-xl shadow-black/40' : ''
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold text-[#00B3A4] tracking-tight">
          TerePay
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
          <a href="#how-it-works" className="text-sm text-gray-300 hover:text-white transition-colors">
            How It Works
          </a>
          <a href="#faq" className="text-sm text-gray-300 hover:text-white transition-colors">
            FAQs
          </a>
          <a href="#contact" className="text-sm text-gray-300 hover:text-white transition-colors">
            Contact
          </a>
        </nav>

        {/* Desktop auth buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/auth/login"
            className="text-sm font-medium text-gray-300 hover:text-white px-4 py-2 rounded-lg transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="text-sm font-semibold px-5 py-2.5 bg-[#00B3A4] text-white rounded-lg hover:bg-[#007F74] transition-colors"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-gray-300 hover:text-white"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/10 px-6 py-5 flex flex-col gap-5 bg-[#0D1B2A]">
          <a
            href="#how-it-works"
            className="text-sm text-gray-300 hover:text-white"
            onClick={() => setMenuOpen(false)}
          >
            How It Works
          </a>
          <a
            href="#faq"
            className="text-sm text-gray-300 hover:text-white"
            onClick={() => setMenuOpen(false)}
          >
            FAQs
          </a>
          <a
            href="#contact"
            className="text-sm text-gray-300 hover:text-white"
            onClick={() => setMenuOpen(false)}
          >
            Contact
          </a>
          <hr className="border-white/10" />
          <Link href="/auth/login" className="text-sm font-medium text-gray-300 hover:text-white">
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="text-sm font-semibold px-5 py-2.5 bg-[#00B3A4] text-white rounded-lg text-center hover:bg-[#007F74]"
          >
            Get Started
          </Link>
        </div>
      )}
    </header>
  );
}
