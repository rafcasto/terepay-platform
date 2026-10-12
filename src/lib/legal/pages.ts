/**
 * Public legal / compliance pages.
 *
 * Single source of truth for the slugs, titles and descriptions of the
 * policy pages linked from the landing-page footer. Each slug is served by
 * `src/app/(legal)/<slug>/page.tsx`. Pure data — safe to import anywhere.
 *
 * Slugs intentionally match the previous terepay.com (WordPress) URLs so
 * existing external links and search results keep resolving.
 */

export interface LegalPageDef {
  slug: string;
  /** Page <h1> and <title>. */
  title: string;
  /** Short label used in the footer "Important Information" list. */
  footerLabel: string;
  /** Meta description. */
  description: string;
}

export const LEGAL_PAGES: readonly LegalPageDef[] = [
  {
    slug: 'annual-interest-rate',
    title: 'Annual Interest Rate',
    footerLabel: 'Annual Interest Rate',
    description: 'The annual interest rate that applies to TerePay loans.',
  },
  {
    slug: 'rates-and-fees-policy',
    title: 'Rates and Fees Policy',
    footerLabel: 'Fees & Charges',
    description:
      'Credit, default and enforcement fees and charges that apply to TerePay loans, including establishment, early repayment and late payment fees.',
  },
  {
    slug: 'unforeseen-financial-hardship-policy',
    title: 'Unforeseen Hardship & Financial Difficulty',
    footerLabel: 'Unforeseen Financial Hardship & Financial Difficulty',
    description:
      'What to do if you are experiencing unforeseen hardship or financial difficulty with your TerePay loan, and how to apply for a hardship variation.',
  },
  {
    slug: 'dispute-resolution-policy',
    title: 'Complaints & Dispute Resolution',
    footerLabel: 'Complaints & Dispute Resolution',
    description:
      'How to make a complaint to TerePay and how to escalate it to our independent dispute resolution scheme, Financial Services Complaints Ltd (FSCL).',
  },
  {
    slug: 'terms-and-conditions',
    title: 'Consumer Credit Contract Terms and Conditions',
    footerLabel: 'Loan Agreement Terms and Conditions',
    description:
      'The terms and conditions that apply to every TerePay consumer credit contract, including payments, interest, fees, default and your rights.',
  },
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    footerLabel: 'Privacy Policy',
    description:
      'How TerePay Neophile Limited collects, uses, discloses, stores and protects your personal information under the Privacy Act 2020.',
  },
  {
    slug: 'website-terms-of-use',
    title: 'Website Terms of Use',
    footerLabel: 'Website Terms of Use',
    description: 'The terms that apply to your access to and use of the TerePay website.',
  },
  {
    slug: 'disclosure-statement',
    title: 'Disclosure Statement',
    footerLabel: 'Disclosure Statement',
    description:
      'Advice about your TerePay credit contract is not regulated financial advice. You are protected by responsible lending laws.',
  },
] as const;

/** Content section key that holds a legal page's editable document. */
export function legalSectionKey(slug: string): string {
  return `legal.${slug}`;
}

/**
 * A legal page is published unless its content section's `published` flag
 * has been switched off. Unpublished pages 404 and are hidden from the footer
 * and "Related documents" lists until an editor publishes them.
 */
export function isLegalPublished(values: Record<string, string> | undefined): boolean {
  return values?.published !== 'false';
}

export function findLegalPage(slug: string): LegalPageDef | undefined {
  return LEGAL_PAGES.find((p) => p.slug === slug);
}

/** Absolute path for a legal page, e.g. `/privacy-policy`. */
export function legalHref(slug: LegalPageDef['slug']): string {
  return `/${slug}`;
}
