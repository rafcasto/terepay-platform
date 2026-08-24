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
    key: 'landing.howItWorks',
    group: 'landing',
    label: 'Homepage — How it works',
    description: 'The three-step "How It Works" section.',
    fields: [
      t('eyebrow', 'Eyebrow label'),
      t('heading', 'Section heading'),
      ta('intro', 'Intro paragraph'),
      t('step1Title', 'Step 1 — title'),
      ta('step1Body', 'Step 1 — description'),
      t('step2Title', 'Step 2 — title'),
      ta('step2Body', 'Step 2 — description'),
      t('step3Title', 'Step 3 — title'),
      ta('step3Body', 'Step 3 — description'),
    ],
  },
  {
    key: 'landing.features',
    group: 'landing',
    label: 'Homepage — Why TerePay',
    description: 'The three feature cards ("Built Around You").',
    fields: [
      t('eyebrow', 'Eyebrow label'),
      t('heading', 'Section heading'),
      ta('intro', 'Intro paragraph'),
      t('feature1Title', 'Feature 1 — title'),
      ta('feature1Body', 'Feature 1 — description'),
      t('feature2Title', 'Feature 2 — title'),
      ta('feature2Body', 'Feature 2 — description'),
      t('feature3Title', 'Feature 3 — title'),
      ta('feature3Body', 'Feature 3 — description'),
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
      ta('draftDisclaimer', 'Unsubmitted-application disclaimer', {
        help: 'Compliance line shown when a borrower has an unsubmitted application.',
      }),
      ta('calculatorDisclaimer', 'Loan calculator disclaimer', {
        help: 'Compliance line under the quick-estimate calculator.',
      }),
      ta('helpText', 'Help footer text', { help: 'Shown above the support email link.' }),
    ],
  },
  {
    key: 'borrower.compliance',
    group: 'borrower',
    label: 'Compliance — Shared privacy note',
    description: 'Privacy/security line shown in the onboarding and application side panels.',
    fields: [
      ta('privacyNote', 'Privacy & security note', {
        help: 'Compliance: reflects NZ Privacy Act 2020. Shown during onboarding and application.',
      }),
    ],
  },
  {
    key: 'onboarding.disclaimers',
    group: 'borrower',
    label: 'Onboarding — Disclaimer',
    description: 'The disclaimer shown on the account-setup screen.',
    fields: [
      ta('approvalDisclaimer', 'Approval & interest disclaimer', {
        help: 'Compliance: keep approval/affordability + interest visible.',
      }),
    ],
  },
  {
    key: 'apply.disclaimers',
    group: 'borrower',
    label: 'Application — Disclaimer',
    description: 'Compliance line shown with the repayment estimate in the loan application.',
    fields: [
      ta('chargedInterestNote', 'Charged-interest note', {
        help: 'Compliance line under the repayment estimate. Loan figures stay computed automatically.',
      }),
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
    a5: 'No hidden fees. Our costs are clearly disclosed upfront: a $20 admin fee (new customers pay a $50 establishment fee), interest at 49% p.a. charged on the reducing balance over the 8-week term, and a $25 prepayment fee if you repay early. Late payment fees apply only after a 3-day grace period. See our Fees & Charges policy for the full breakdown.',
    q6: 'What if I have a question or need help?',
    a6: 'Our team is here to help. You can reach us by phone at +64 9 886 7158 or by email at info@terepay.com. We are happy to assist you through every step of the application process.',
  },
  'landing.howItWorks': {
    eyebrow: 'Simple Process',
    heading: 'How It Works',
    intro:
      'Getting a TerePay loan is quick and straightforward — three steps stand between you and the funds you need.',
    step1Title: 'Apply Online',
    step1Body: 'Complete our quick and simple application form from any device. It only takes a few minutes.',
    step2Title: 'Get Approved',
    step2Body: 'We assess your application as a responsible lender and provide a decision within 24 hours.',
    step3Title: 'Receive Funds',
    step3Body: 'Once approved, funds are transferred directly into your bank account — fast and hassle-free.',
  },
  'landing.features': {
    eyebrow: 'Why TerePay',
    heading: 'Built Around You',
    intro: 'A lending experience designed with your needs in mind from start to finish.',
    feature1Title: 'Fast Approval',
    feature1Body:
      'Submit your application and receive a lending decision in as little as 24 hours. We know time matters.',
    feature2Title: 'Transparent Terms',
    feature2Body: 'Interest at 49% p.a., charged only on what you still owe, over the 8-week term, plus a $20 admin fee. No hidden charges — ever.',
    feature3Title: 'Responsible Lending',
    feature3Body:
      'We ensure every loan meets your needs and that you can repay comfortably without financial hardship.',
  },
  'borrower.dashboard': {
    greetingSuffix: '👋',
    welcomeTitle: 'Welcome back',
    newEyebrow: 'No active loan',
    newTitle: 'Start a TerePay loan',
    newSubtitle: 'Borrow $200 – $2,000 · 8 weeks · 4 fortnightly instalments.',
    newCta: 'Apply for a loan',
    draftDisclaimer: 'All loans are charged interest and fees. Applications can be declined.',
    calculatorDisclaimer:
      'Applications are subject to approval and affordability checks — final terms confirmed after assessment.',
    helpText: 'Need help? Email',
  },
  'borrower.compliance': {
    privacyNote: 'Your information is encrypted and stored securely. We comply with the NZ Privacy Act 2020.',
  },
  'onboarding.disclaimers': {
    approvalDisclaimer:
      'Applications are subject to approval and affordability checks. All loans are charged interest — see full terms before you apply.',
  },
  'apply.disclaimers': {
    chargedInterestNote: 'All loans are charged interest and fees.',
  },
};

/** Merge a saved section's values over its defaults. */
export function withDefaults(key: string, values: ContentSectionValues | undefined): ContentSectionValues {
  return { ...(DEFAULT_CONTENT[key] ?? {}), ...(values ?? {}) };
}
