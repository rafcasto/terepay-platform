import type { Timestamp } from 'firebase-admin/firestore';

/**
 * Editable site content.
 *
 * Content is stored in Firestore (`siteContent` collection, one document per
 * section key). Public and borrower pages read it per-request, so content
 * editor saves are reflected immediately with no deploy.
 *
 * Everything here is plain text (no HTML) — values are rendered as text nodes,
 * so there is no XSS surface. To make more content editable, add a section to
 * `CONTENT_SECTIONS` + its defaults to `DEFAULT_CONTENT`, then read it in the
 * matching component via `getContentSection()`.
 */

export type ContentGroup = 'landing' | 'borrower';

export type ContentFieldType = 'text' | 'textarea';

export interface ContentFieldDef {
  key: string;
  label: string;
  type: ContentFieldType;
  /** Optional helper text shown under the field in the editor. */
  help?: string;
  /** Max length enforced client + server side. */
  maxLength: number;
}

export interface ContentSectionDef {
  key: string;
  group: ContentGroup;
  label: string;
  description: string;
  fields: ContentFieldDef[];
}

/** A saved section: a flat map of field key -> plain-text value. */
export type ContentSectionValues = Record<string, string>;

export interface ContentSectionDoc {
  values: ContentSectionValues;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

const t = (
  key: string,
  label: string,
  opts: Partial<Omit<ContentFieldDef, 'key' | 'label' | 'type'>> = {},
): ContentFieldDef => ({ key, label, type: 'text', maxLength: 160, ...opts });

const ta = (
  key: string,
  label: string,
  opts: Partial<Omit<ContentFieldDef, 'key' | 'label' | 'type'>> = {},
): ContentFieldDef => ({ key, label, type: 'textarea', maxLength: 1200, ...opts });

// ---------------------------------------------------------------------------
// Section definitions
// ---------------------------------------------------------------------------

export const CONTENT_SECTIONS: ContentSectionDef[] = [
  {
    key: 'landing.hero',
    group: 'landing',
    label: 'Homepage — Hero',
    description: 'The top section of the public homepage.',
    fields: [
      t('badge', 'Eyebrow badge'),
      t('titleLead', 'Headline (lead)'),
      t('titleHighlight', 'Headline (highlighted word)'),
      t('titleTail', 'Headline (tail)'),
      ta('subtitle', 'Subtitle'),
      t('disclaimer', 'Interest disclaimer', { help: 'Compliance: keep interest/fees visible.' }),
      t('primaryCta', 'Primary button label'),
      t('secondaryCta', 'Secondary button label'),
      t('badge1Label', 'Trust badge 1 — title'),
      t('badge1Sub', 'Trust badge 1 — subtitle'),
      t('badge2Label', 'Trust badge 2 — title'),
      t('badge2Sub', 'Trust badge 2 — subtitle'),
      t('badge3Label', 'Trust badge 3 — title'),
      t('badge3Sub', 'Trust badge 3 — subtitle'),
    ],
  },
  {
    key: 'landing.cta',
    group: 'landing',
    label: 'Homepage — Call-to-action banner',
    description: 'The dark banner near the bottom of the homepage.',
    fields: [
      t('titleLead', 'Headline (lead)'),
      t('titleHighlight', 'Headline (highlighted word)'),
      ta('subtitle', 'Subtitle'),
      t('primaryCta', 'Primary button label'),
      t('secondaryCta', 'Secondary button label'),
    ],
  },
  {
    key: 'landing.faq',
    group: 'landing',
    label: 'Homepage — FAQ',
    description: 'Frequently asked questions on the homepage.',
    fields: [
      t('eyebrow', 'Eyebrow label'),
      t('heading', 'Section heading'),
      t('q1', 'Question 1'),
      ta('a1', 'Answer 1'),
      t('q2', 'Question 2'),
      ta('a2', 'Answer 2'),
      t('q3', 'Question 3'),
      ta('a3', 'Answer 3'),
      t('q4', 'Question 4'),
      ta('a4', 'Answer 4'),
      t('q5', 'Question 5'),
      ta('a5', 'Answer 5'),
      t('q6', 'Question 6'),
      ta('a6', 'Answer 6'),
    ],
  },
  {
    key: 'borrower.dashboard',
    group: 'borrower',
    label: 'Borrower — Dashboard',
    description: 'Headings shown to borrowers with no active loan, plus the help line.',
    fields: [
      t('greetingSuffix', 'Greeting emoji/suffix', { help: 'Shown after "Good morning".' }),
      t('welcomeTitle', 'Welcome heading', { help: 'The borrower\'s first name is appended automatically.' }),
      t('newEyebrow', 'No-loan — eyebrow'),
      t('newTitle', 'No-loan — title'),
      ta('newSubtitle', 'No-loan — subtitle'),
      t('newCta', 'No-loan — button label'),
      ta('helpText', 'Help footer text', { help: 'Shown above the support email link.' }),
    ],
  },
];

export const CONTENT_SECTION_KEYS = CONTENT_SECTIONS.map((s) => s.key);

export function getSectionDef(key: string): ContentSectionDef | undefined {
  return CONTENT_SECTIONS.find((s) => s.key === key);
}

// ---------------------------------------------------------------------------
// Defaults — MUST match the copy currently hardcoded in the components so that
// an un-edited site renders identically.
// ---------------------------------------------------------------------------

export const DEFAULT_CONTENT: Record<string, ContentSectionValues> = {
  'landing.hero': {
    badge: "New Zealand's Community Lender",
    titleLead: 'Borrow Now,',
    titleHighlight: 'Pay Later',
    titleTail: 'with TerePay',
    subtitle:
      'Experience the flexibility of accessing funds when you need them the most while managing your finances.',
    disclaimer: 'All loans are charged interest — see our rates below.',
    primaryCta: 'Ready To Borrow?',
    secondaryCta: 'Sign In',
    badge1Label: 'Fast Approval',
    badge1Sub: 'Decisions in 24 hours',
    badge2Label: 'Responsible Lending',
    badge2Sub: 'We lend what you can repay',
    badge3Label: 'Transparent Terms',
    badge3Sub: 'No hidden fees ever',
  },
  'landing.cta': {
    titleLead: 'Borrowing power in',
    titleHighlight: 'your hands.',
    subtitle:
      'Apply now — complete a few questions to get started. Funds deposited directly to your bank account.',
    primaryCta: 'Apply for a Loan',
    secondaryCta: 'Existing Customer',
  },
  'landing.faq': {
    eyebrow: 'Questions',
    heading: 'Frequently Asked Questions',
    q1: 'Does TerePay decline applications?',
    a1: 'Yes, TerePay can decline applications if the applicant does not meet the minimum lending criteria. As a responsible lender, we make reasonable checks to confirm that the loan will meet your requirements and that you can repay without substantial hardship. Common reasons for decline include low credit scores, high existing debt, unstable income, or an incomplete application. You may reapply once your financial situation improves.',
    q2: 'What can you use a TerePay loan for?',
    a2: 'TerePay loans are personal loans that can be used for a range of everyday needs — from unexpected bills and medical expenses to covering living costs between pay cycles. We encourage responsible borrowing and ask that you only borrow what you genuinely need.',
    q3: 'How long does it take to get approved?',
    a3: 'Once you submit your application with all required documents, we aim to provide a decision within 24 hours on business days. Funds are transferred promptly after approval.',
    q4: 'What identification do I need to apply?',
    a4: "You will need a valid New Zealand driver's licence or passport, proof of your residential address, recent bank statements (last 3 months), and proof of income. Additional documents may be requested during assessment.",
    q5: 'Are there any hidden fees?',
    a5: 'No hidden fees. Our costs are clearly disclosed upfront: a $20 admin fee (new customers pay a $50 establishment fee), a 4.7% interest rate for the 8-week term, and a $25 prepayment fee if you repay early. Late payment fees apply only after a 3-day grace period. See our Fees & Charges policy for the full breakdown.',
    q6: 'What if I have a question or need help?',
    a6: 'Our team is here to help. You can reach us by phone at +64 9 886 7158 or by email at info@terepay.com. We are happy to assist you through every step of the application process.',
  },
  'borrower.dashboard': {
    greetingSuffix: '👋',
    welcomeTitle: 'Welcome back',
    newEyebrow: 'No active loan',
    newTitle: 'Start a TerePay loan',
    newSubtitle: 'Borrow $200 – $2,000 · 8 weeks · 4 fortnightly instalments.',
    newCta: 'Apply for a loan',
    helpText: 'Need help? Email',
  },
};

/** Merge a saved section's values over its defaults. */
export function withDefaults(key: string, values: ContentSectionValues | undefined): ContentSectionValues {
  return { ...(DEFAULT_CONTENT[key] ?? {}), ...(values ?? {}) };
}
