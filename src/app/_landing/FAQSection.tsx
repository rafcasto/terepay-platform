'use client';

import { useState } from 'react';

const faqs = [
  {
    q: 'Does TerePay decline applications?',
    a: 'Yes, TerePay can decline applications if the applicant does not meet the minimum lending criteria. As a responsible lender, we make reasonable checks to confirm that the loan will meet your requirements and that you can repay without substantial hardship. Common reasons for decline include low credit scores, high existing debt, unstable income, or an incomplete application. You may reapply once your financial situation improves.',
  },
  {
    q: 'What can you use a TerePay loan for?',
    a: 'TerePay loans are personal loans that can be used for a range of everyday needs — from unexpected bills and medical expenses to covering living costs between pay cycles. We encourage responsible borrowing and ask that you only borrow what you genuinely need.',
  },
  {
    q: 'How long does it take to get approved?',
    a: 'Once you submit your application with all required documents, we aim to provide a decision within 24 hours on business days. Funds are transferred promptly after approval.',
  },
  {
    q: 'What identification do I need to apply?',
    a: "You will need a valid New Zealand driver's licence or passport, proof of your residential address, recent bank statements (last 3 months), and proof of income. Additional documents may be requested during assessment.",
  },
  {
    q: 'Are there any hidden fees?',
    a: 'No hidden fees. Our costs are clearly disclosed upfront: a $20 admin fee (new customers pay a $50 establishment fee), a 4.7% interest rate for the 8-week term, and a $25 prepayment fee if you repay early. Late payment fees apply only after a 3-day grace period. See our Fees & Charges policy for the full breakdown.',
  },
  {
    q: 'What if I have a question or need help?',
    a: 'Our team is here to help. You can reach us by phone at +64 9 886 7158 or by email at info@terepay.com. We are happy to assist you through every step of the application process.',
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-20 px-6 bg-white">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs font-semibold tracking-widest uppercase text-[#00B3A4]">
            Questions
          </span>
          <h2 className="mt-2 text-3xl md:text-4xl font-extrabold text-[#0D1B2A]">
            Frequently Asked Questions
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
                  className={`w-5 h-5 text-[#00B3A4] flex-shrink-0 ml-4 transition-transform duration-200${
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
