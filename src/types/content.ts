import type { Timestamp } from 'firebase-admin/firestore';

/**
 * Editable site content.
 *
 * Content is stored in Firestore (`siteContent` collection, one document per
 * section key). Public and borrower pages read it per-request, so content
 * editor saves are reflected immediately with no deploy.
 *
 * Everything here is plain text (no HTML) — values are rendered as text nodes,
 * so there is no XSS surface. The only markup supported is `**bold**`, which
 * is rendered via `renderEmphasis()` (React nodes, never `innerHTML`).
 *
 * To make more content editable:
 *   1. add a section to `CONTENT_SECTIONS` + its defaults to `DEFAULT_CONTENT`
 *   2. list the section on a page in `src/lib/content/pages.ts`
 *   3. read it in the matching component — `getContentSection()` on the server,
 *      or `useSiteContent()` inside a `'use client'` tree wrapped by
 *      `SiteContentProvider`.
 */

export type ContentGroup = 'landing' | 'auth' | 'onboarding' | 'borrower' | 'apply';

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

const COMPLIANCE = 'Compliance: keep interest/fees and the possibility of decline visible.';
const BOLD_HELP = 'Wrap words in **double asterisks** to make them bold.';

// ---------------------------------------------------------------------------
// Section definitions
// ---------------------------------------------------------------------------

export const CONTENT_SECTIONS: ContentSectionDef[] = [
  // ── Landing ──────────────────────────────────────────────────────────────
  {
    key: 'landing.hero',
    group: 'landing',
    label: 'Homepage — Hero',
    description: 'The top section of the public homepage.',
    fields: [
      t('badge', 'Eyebrow pill'),
      t('titleLead', 'Headline (lead)'),
      t('titleHighlight', 'Headline (highlighted word)'),
      t('titleTail', 'Headline (tail)'),
      ta('subtitle', 'Subtitle'),
      t('disclaimer', 'Interest disclaimer', { help: 'Compliance: keep interest/fees visible.' }),
      t('primaryCta', 'Primary button label'),
      t('secondaryCta', 'Secondary button label (scrolls to the calculator)'),
      t('stat1Value', 'Stat 1 — value'),
      t('stat1Label', 'Stat 1 — label'),
      t('stat2Value', 'Stat 2 — value'),
      t('stat2Label', 'Stat 2 — label'),
      t('stat3Value', 'Stat 3 — value'),
      t('stat3Label', 'Stat 3 — label'),
      t('tileTitle', 'Orange tile — title'),
      ta('tileBody', 'Orange tile — body', { help: 'Compliance: keep interest/fees visible.' }),
    ],
  },
  {
    key: 'landing.uses',
    group: 'landing',
    label: 'Homepage — What you can use it for',
    description: 'The four numbered loan purposes.',
    fields: [
      t('eyebrow', 'Eyebrow label'),
      t('heading', 'Section heading'),
      ta('intro', 'Intro paragraph'),
      t('use1Title', 'Use 1 — title'),
      ta('use1Body', 'Use 1 — description'),
      t('use2Title', 'Use 2 — title'),
      ta('use2Body', 'Use 2 — description'),
      t('use3Title', 'Use 3 — title'),
      ta('use3Body', 'Use 3 — description'),
      t('use4Title', 'Use 4 — title'),
      ta('use4Body', 'Use 4 — description'),
      ta('footnote', 'Footnote', { help: COMPLIANCE }),
    ],
  },
  {
    key: 'landing.calculator',
    group: 'landing',
    label: 'Homepage — Loan calculator',
    description:
      'Copy around the repayment calculator. The figures themselves come from the loan product settings, not from here.',
    fields: [
      t('eyebrow', 'Eyebrow label'),
      t('heading', 'Section heading'),
      ta('intro', 'Intro paragraph', { help: COMPLIANCE }),
      t('cta', 'Apply button label'),
      ta('disclosure', 'Interest disclosure (shown under the apply button)', { help: COMPLIANCE }),
    ],
  },
  {
    key: 'landing.apply',
    group: 'landing',
    label: 'Homepage — How to apply',
    description: 'The apply call-to-action and the identification checklist beside it.',
    fields: [
      t('eyebrow', 'Eyebrow label'),
      t('heading', 'Section heading'),
      t('intro', 'Intro line'),
      ta('body', 'Body paragraph'),
      t('primaryCta', 'Primary button label'),
      t('secondaryCta', 'Secondary button label (existing customers)'),
      ta('disclosure', 'Interest disclosure', { help: COMPLIANCE }),
      ta('privacyNote', 'Privacy note', { help: 'The words "Privacy Policy" are added as a link after this text.' }),
      t('checklistTitle', 'Checklist — title'),
      t('checklistIntro', 'Checklist — intro'),
      t('item1', 'Checklist — item 1'),
      t('item2', 'Checklist — item 2'),
      t('item3', 'Checklist — item 3'),
      t('item4', 'Checklist — item 4'),
      t('helpLine', 'Help line (shown before the phone number)'),
      t('helpPhone', 'Help phone number'),
    ],
  },
  {
    key: 'landing.faq',
    group: 'landing',
    label: 'Homepage — FAQ',
    description: 'Frequently asked questions on the homepage. Line breaks are kept; use **bold** for emphasis.',
    fields: [
      t('eyebrow', 'Eyebrow label'),
      t('heading', 'Section heading'),
      t('q1', 'Question 1'),
      ta('a1', 'Answer 1', { maxLength: 2000, help: `${COMPLIANCE} ${BOLD_HELP}` }),
      t('q2', 'Question 2'),
      ta('a2', 'Answer 2', { help: BOLD_HELP }),
      t('q3', 'Question 3'),
      ta('a3', 'Answer 3', { help: BOLD_HELP }),
      t('q4', 'Question 4'),
      ta('a4', 'Answer 4', { help: BOLD_HELP }),
      t('q5', 'Question 5'),
      ta('a5', 'Answer 5', { help: `${COMPLIANCE} ${BOLD_HELP}` }),
      t('q6', 'Question 6'),
      ta('a6', 'Answer 6', { help: BOLD_HELP }),
    ],
  },
  {
    key: 'landing.cta',
    group: 'landing',
    label: 'Homepage — Call-to-action banner',
    description: 'The orange banner near the bottom of the homepage.',
    fields: [
      t('titleLead', 'Headline (lead)'),
      t('titleHighlight', 'Headline (end)'),
      ta('subtitle', 'Subtitle'),
      t('primaryCta', 'Button label'),
      t('disclaimer', 'Interest disclaimer', { help: 'Compliance: keep interest/fees visible.' }),
    ],
  },

  // ── Auth (login / registration) ──────────────────────────────────────────
  {
    key: 'auth.shared',
    group: 'auth',
    label: 'Sign-in & registration — shared panel',
    description:
      'The navy brand panel and responsible-lending notice. Shown on both the login and registration pages.',
    fields: [
      t('tagline', 'Tagline under the logo'),
      t('panelEyebrow', 'Panel eyebrow'),
      t('tick1', 'Trust point 1'),
      t('tick2', 'Trust point 2'),
      t('tick3', 'Trust point 3', { help: COMPLIANCE }),
      ta('panelFooter', 'Panel footer (privacy line)', { help: 'Compliance: NZ Privacy Act 2020 + interest disclosure.' }),
      t('toggleSignIn', 'Mode toggle — sign in'),
      t('toggleCreate', 'Mode toggle — create account'),
      ta('disclosure', 'Responsible-lending notice', { help: `${COMPLIANCE} ${BOLD_HELP}` }),
    ],
  },
  {
    key: 'auth.login',
    group: 'auth',
    label: 'Login page',
    description: 'Headings, buttons and the brand-panel copy shown when signing in.',
    fields: [
      t('eyebrow', 'Eyebrow'),
      t('title', 'Heading'),
      ta('subtitle', 'Subtitle'),
      t('submitCta', 'Submit button'),
      t('submittingCta', 'Submit button (busy)'),
      t('forgotPassword', 'Forgot-password link'),
      t('divider', 'Divider text'),
      t('createAccountCta', 'Create-account button'),
      t('panelTitleLead', 'Brand panel heading (lead)'),
      t('panelTitleHighlight', 'Brand panel heading (highlighted word)'),
      ta('panelBody', 'Brand panel paragraph'),
    ],
  },
  {
    key: 'auth.signup',
    group: 'auth',
    label: 'Registration page',
    description: 'Headings, buttons and the brand-panel copy shown when creating an account.',
    fields: [
      t('eyebrow', 'Eyebrow'),
      t('title', 'Heading'),
      ta('subtitle', 'Subtitle'),
      t('passwordHint', 'Password hint'),
      ta('termsDisclosure', 'Terms checkbox — disclosure sentence', {
        help: `Follows the “I agree to the loan agreement terms and privacy policy.” links. ${COMPLIANCE}`,
      }),
      t('submitCta', 'Submit button'),
      t('submittingCta', 'Submit button (busy)'),
      t('haveAccountText', 'Already-have-account text'),
      t('signInLink', 'Sign-in link label'),
      t('panelTitleLead', 'Brand panel heading (lead)'),
      t('panelTitleHighlight', 'Brand panel heading (highlighted word)'),
      ta('panelBody', 'Brand panel paragraph'),
    ],
  },

  // ── Onboarding ───────────────────────────────────────────────────────────
  {
    key: 'onboarding.layout',
    group: 'onboarding',
    label: 'Onboarding — sidebar & step names',
    description: 'The side-panel label and the step names shown in the progress tracker across every onboarding step.',
    fields: [
      t('sidebarLabel', 'Sidebar label'),
      t('step1Label', 'Step 1 name'),
      t('step2Label', 'Step 2 name'),
      t('step3Label', 'Step 3 name'),
      t('step4Label', 'Step 4 name'),
      t('step5Label', 'Step 5 name'),
    ],
  },
  {
    key: 'borrower.compliance',
    group: 'borrower',
    label: 'Compliance — Shared privacy note',
    description: 'Privacy/security line shown in the onboarding and loan-application side panels.',
    fields: [
      ta('privacyNote', 'Privacy & security note', {
        help: 'Compliance: reflects NZ Privacy Act 2020. Shown during onboarding and application.',
      }),
    ],
  },
  {
    key: 'onboarding.intro',
    group: 'onboarding',
    label: 'Onboarding — Quick intro',
    description: 'The account-setup overview screen listing the four verification steps.',
    fields: [
      t('eyebrow', 'Eyebrow'),
      t('title', 'Heading'),
      ta('subtitle', 'Subtitle'),
      t('step1Title', 'Email verification — title'),
      ta('step1Body', 'Email verification — description'),
      t('step2Title', 'Mobile verification — title'),
      ta('step2Body', 'Mobile verification — description'),
      t('step3Title', 'Complete profile — title'),
      ta('step3Body', 'Complete profile — description'),
      t('step4Title', 'Identity verification — title'),
      ta('step4Body', 'Identity verification — description'),
      t('cta', 'Continue button'),
    ],
  },
  {
    key: 'onboarding.disclaimers',
    group: 'onboarding',
    label: 'Onboarding — Disclaimer',
    description: 'The disclaimer shown under the Continue button on the account-setup screen.',
    fields: [
      ta('approvalDisclaimer', 'Approval & interest disclaimer', {
        help: 'Compliance: keep approval/affordability + interest visible.',
      }),
    ],
  },
  {
    key: 'onboarding.verifyEmail',
    group: 'onboarding',
    label: 'Onboarding — Verify email',
    description: 'The "check your inbox" screen and the wrong-email form.',
    fields: [
      t('title', 'Heading'),
      t('sendingText', 'Status line while sending', { help: 'The email address is shown underneath.' }),
      t('sentText', 'Status line once sent'),
      ta('instructions', 'Instructions', { help: 'Line breaks are kept.' }),
      t('waitingText', 'Waiting indicator'),
      t('resendCta', 'Resend link'),
      t('spamHint', 'Spam-folder hint'),
      t('wrongEmailCta', 'Wrong-email link'),
      t('updateTitle', 'Update-email form — title'),
      ta('updateBody', 'Update-email form — description'),
      t('updateCta', 'Update-email button'),
      t('cancelCta', 'Cancel button'),
      t('verifiedTitle', 'Verified — heading'),
      t('verifiedBody', 'Verified — subtitle'),
    ],
  },
  {
    key: 'onboarding.verifyMobile',
    group: 'onboarding',
    label: 'Onboarding — Verify mobile',
    description: 'The phone-number screen and the 6-digit code screen.',
    fields: [
      t('phoneTitle', 'Phone screen — heading'),
      ta('phoneSubtitle', 'Phone screen — subtitle'),
      t('phoneLabel', 'Phone field label'),
      t('sendCta', 'Send-code button'),
      t('otpTitle', 'Code screen — heading'),
      t('otpSubtitleLead', 'Code screen — subtitle lead', { help: 'The phone number is appended.' }),
      t('verifyCta', 'Verify button'),
      t('noCodeText', 'No-code text'),
      t('resendCta', 'Resend link'),
    ],
  },
  {
    key: 'onboarding.profile',
    group: 'onboarding',
    label: 'Onboarding — Complete profile',
    description: 'Headings and helper copy on the profile form. Field labels stay fixed.',
    fields: [
      t('title', 'Heading'),
      ta('subtitle', 'Subtitle'),
      t('existingClientQuestion', 'Existing-client question'),
      ta('customerIdHelp', 'Customer ID helper text'),
      t('submitCta', 'Continue button'),
    ],
  },
  {
    key: 'onboarding.identity',
    group: 'onboarding',
    label: 'Onboarding — Verify identity',
    description: 'Headings, document descriptions and the footnote on the ID upload screen.',
    fields: [
      t('title', 'Heading'),
      ta('subtitle', 'Subtitle'),
      t('primaryDocLabel', 'Primary ID selector label'),
      ta('nzLicenceDesc', "NZ Driver's Licence — description"),
      ta('nzPassportDesc', 'NZ Passport — description'),
      t('foreignPassportLabel', 'Overseas passport — label'),
      ta('foreignPassportDesc', 'Overseas passport — description'),
      t('nzVisaLabel', 'NZ visa — label'),
      ta('nzVisaDesc', 'NZ visa — description'),
      t('proofOfAddressLabel', 'Proof of address — label'),
      ta('proofOfAddressDesc', 'Proof of address — description'),
      t('uploadCta', 'Upload button'),
      t('submitCta', 'Submit button'),
      ta('footnote', 'Footnote under the button'),
    ],
  },

  // ── Borrower dashboard ───────────────────────────────────────────────────
  {
    key: 'borrower.dashboard',
    group: 'borrower',
    label: 'Borrower — Dashboard (all statuses)',
    description: 'Greeting, quick-estimate calculator and help line shown regardless of loan status.',
    fields: [
      t('greetingSuffix', 'Greeting suffix', { help: 'Shown after "Good morning".' }),
      t('welcomeTitle', 'Welcome heading', { help: "The borrower's first name is appended automatically." }),
      t('calculatorEyebrow', 'Calculator — eyebrow'),
      ta('calculatorDisclaimer', 'Calculator — disclaimer', {
        help: 'Compliance line under the quick-estimate calculator.',
      }),
      t('calculatorCta', 'Calculator — button'),
      t('quickActionsHeading', 'Quick actions heading'),
      ta('helpText', 'Help footer text', { help: 'Shown above the support email link.' }),
    ],
  },
  {
    key: 'borrower.status.new',
    group: 'borrower',
    label: 'Borrower — No active loan',
    description: 'Shown to borrowers who have never applied or have no open application.',
    fields: [
      t('eyebrow', 'Hero eyebrow'),
      t('title', 'Hero heading'),
      ta('subtitle', 'Hero subtitle', { help: COMPLIANCE }),
      t('cta', 'Hero button'),
      t('action1Title', 'Quick action 1 — title'),
      t('action1Subtitle', 'Quick action 1 — subtitle'),
      t('action2Title', 'Quick action 2 — title'),
      t('action2Subtitle', 'Quick action 2 — subtitle'),
    ],
  },
  {
    key: 'borrower.status.draft',
    group: 'borrower',
    label: 'Borrower — Application in progress',
    description: 'Shown when a borrower has started but not submitted an application.',
    fields: [
      t('eyebrow', 'Hero eyebrow'),
      t('title', 'Hero heading'),
      ta('subtitle', 'Hero subtitle'),
      t('pill', 'Status pill'),
      t('cta', 'Hero button'),
      ta('disclaimer', 'Disclaimer under the button', { help: COMPLIANCE }),
    ],
  },
  {
    key: 'borrower.status.review',
    group: 'borrower',
    label: 'Borrower — Application in review',
    description: 'Shown while a submitted application is being assessed.',
    fields: [
      t('eyebrow', 'Hero eyebrow'),
      t('title', 'Hero heading'),
      ta('subtitle', 'Hero subtitle'),
      t('pill', 'Status pill'),
      t('cta', 'Hero button'),
      t('actionTitle', 'Quick action — title'),
      t('actionSubtitle', 'Quick action — subtitle'),
    ],
  },
  {
    key: 'borrower.status.approved',
    group: 'borrower',
    label: 'Borrower — Loan approved',
    description: 'Shown once an offer is made and awaiting acceptance / bank authorisation.',
    fields: [
      t('eyebrow', 'Hero eyebrow'),
      t('title', 'Hero heading'),
      ta('subtitle', 'Hero subtitle'),
      t('pill', 'Status pill'),
      t('cta', 'Hero button'),
      t('actionTitle', 'Quick action — title'),
      t('actionSubtitle', 'Quick action — subtitle'),
    ],
  },
  {
    key: 'borrower.status.rejected',
    group: 'borrower',
    label: 'Borrower — Application declined',
    description: 'Shown when an application or offer was declined, withdrawn or expired.',
    fields: [
      t('eyebrow', 'Hero eyebrow'),
      t('title', 'Hero heading'),
      ta('subtitle', 'Hero subtitle'),
      t('pill', 'Status pill'),
      t('detailsCta', 'See-details button'),
      t('applyAgainCta', 'Apply-again button'),
      t('actionTitle', 'Quick action — title'),
      t('actionSubtitle', 'Quick action — subtitle'),
    ],
  },
  {
    key: 'borrower.status.active',
    group: 'borrower',
    label: 'Borrower — Active loan',
    description: 'Shown while a disbursed loan is being repaid, including the missed-payment variant.',
    fields: [
      t('eyebrow', 'Hero eyebrow (on track)'),
      t('delinquentEyebrow', 'Hero eyebrow (payment missed)'),
      ta('delinquentSubtitle', 'Subtitle (payment missed)'),
      t('pillOnTrack', 'Status pill (on track)'),
      t('pillLate', 'Status pill (late)'),
      t('progressLabel', 'Progress bar label'),
      t('cta', 'Hero button'),
      t('actionTitle', 'Quick action — title'),
      t('actionSubtitle', 'Quick action — subtitle'),
    ],
  },
  {
    key: 'borrower.status.paid',
    group: 'borrower',
    label: 'Borrower — Loan repaid',
    description: 'Shown once a loan is fully repaid and closed.',
    fields: [
      t('eyebrow', 'Hero eyebrow'),
      t('title', 'Hero heading', { help: "The borrower's first name is appended automatically." }),
      ta('subtitle', 'Hero subtitle'),
      t('pill', 'Status pill'),
      t('actionTitle', 'Quick action — title'),
      t('actionSubtitle', 'Quick action — subtitle'),
    ],
  },

  // ── Loan application ─────────────────────────────────────────────────────
  {
    key: 'apply.layout',
    group: 'apply',
    label: 'Loan request — sidebar, step names & navigation',
    description: 'The side-panel label, step names in the progress tracker and the Continue / Back / Submit controls shared by every step.',
    fields: [
      t('sidebarLabel', 'Sidebar label'),
      t('backToDashboard', 'Back-to-dashboard link'),
      t('step1Label', 'Step 1 name'),
      t('step2Label', 'Step 2 name'),
      t('step3Label', 'Step 3 name'),
      t('step4Label', 'Step 4 name'),
      t('step5Label', 'Step 5 name'),
      t('step6Label', 'Step 6 name'),
      t('step7Label', 'Step 7 name'),
      t('step8Label', 'Step 8 name'),
      t('continueCta', 'Continue button'),
      t('backCta', 'Back button'),
      t('submitCta', 'Submit button'),
      t('submittingCta', 'Submit button (busy)'),
      t('draftSaved', 'Draft-saved indicator'),
      ta('autosaveNote', 'Autosave note'),
      t('loadingText', 'Loading text'),
      t('emailRequiredTitle', 'Email-required — heading'),
      ta('emailRequiredBody', 'Email-required — body'),
      t('emailRequiredCta', 'Email-required — button'),
    ],
  },
  {
    key: 'apply.step1',
    group: 'apply',
    label: 'Step 1 — Personal information',
    description: 'Heading and intro. Field labels stay fixed.',
    fields: [t('title', 'Heading'), ta('intro', 'Intro')],
  },
  {
    key: 'apply.step2',
    group: 'apply',
    label: 'Step 2 — Employment & income',
    description: 'Heading, intro and the previous-employer / income sub-headings.',
    fields: [
      t('title', 'Heading'),
      ta('intro', 'Intro'),
      t('previousEmployerTitle', 'Previous employer — title'),
      ta('previousEmployerBody', 'Previous employer — description'),
      t('incomeHeading', 'Income table heading'),
      t('totalLabel', 'Total row label'),
    ],
  },
  {
    key: 'apply.step3',
    group: 'apply',
    label: 'Step 3 — Living expenses',
    description: 'Heading, intro and the expense-group titles.',
    fields: [
      t('title', 'Heading'),
      ta('intro', 'Intro', { help: BOLD_HELP }),
      t('essentialsTitle', 'Essential costs — title'),
      t('essentialsHint', 'Essential costs — hint'),
      t('lifestyleTitle', 'Lifestyle & extras — title'),
      t('lifestyleHint', 'Lifestyle & extras — hint'),
      t('subsLabel', 'Subscriptions toggle — label'),
      t('subsDesc', 'Subscriptions toggle — description'),
      t('bnplLabel', 'Buy Now Pay Later toggle — label'),
      t('bnplDesc', 'Buy Now Pay Later toggle — description'),
      t('totalLabel', 'Grand total label'),
    ],
  },
  {
    key: 'apply.step4',
    group: 'apply',
    label: 'Step 4 — Existing debts',
    description: 'Heading, intro, the debts toggle and the free-text prompt.',
    fields: [
      t('title', 'Heading'),
      ta('intro', 'Intro'),
      t('toggleLabel', 'Debts toggle — label'),
      t('toggleDesc', 'Debts toggle — description'),
      t('situationLabel', 'Situation prompt — label'),
      t('situationHint', 'Situation prompt — hint'),
    ],
  },
  {
    key: 'apply.step5',
    group: 'apply',
    label: 'Step 5 — Loan request',
    description: 'Heading, intro, the amount / estimate labels, PEP statement and remittance copy. Loan figures stay computed automatically.',
    fields: [
      t('title', 'Heading'),
      ta('intro', 'Intro'),
      t('amountLabel', 'Amount question'),
      t('estimateHeading', 'Repayment estimate — heading'),
      t('termsHeading', 'Loan terms — heading'),
      ta('pepText', 'Politically Exposed Person statement', { help: `AML/CFT requirement. ${BOLD_HELP}` }),
      t('remittanceTitle', 'Remittance — title'),
      ta('remittanceBody', 'Remittance — description'),
    ],
  },
  {
    key: 'apply.disclaimers',
    group: 'apply',
    label: 'Step 5 — Compliance disclaimer',
    description: 'Compliance line shown with the repayment estimate.',
    fields: [
      ta('chargedInterestNote', 'Charged-interest note', {
        help: 'Compliance line under the repayment estimate. Loan figures stay computed automatically.',
      }),
    ],
  },
  {
    key: 'apply.step6',
    group: 'apply',
    label: 'Step 6 — Bank account',
    description: 'Heading, intro, the security note and the account-format hint.',
    fields: [
      t('title', 'Heading'),
      ta('intro', 'Intro'),
      ta('securityNote', 'Security note'),
      t('accountFormatHint', 'Account number format hint'),
    ],
  },
  {
    key: 'apply.step7',
    group: 'apply',
    label: 'Step 7 — References',
    description: 'Heading, intro and the eligibility note.',
    fields: [t('title', 'Heading'), ta('intro', 'Intro'), ta('note', 'Eligibility note')],
  },
  {
    key: 'apply.step8',
    group: 'apply',
    label: 'Step 8 — Declarations & consent',
    description: 'Heading, intro, summary copy and every declaration the borrower must tick.',
    fields: [
      t('title', 'Heading'),
      ta('intro', 'Intro'),
      t('summaryHeading', 'Fees summary — heading'),
      ta('summaryNote', 'Fees summary — note', { help: COMPLIANCE }),
      t('declarationsHeading', 'Declarations — heading'),
      ta('decl1', 'Declaration 1', { help: 'Legal wording — check with compliance before changing.' }),
      ta('decl2', 'Declaration 2'),
      ta('decl3', 'Declaration 3'),
      ta('decl4', 'Declaration 4', { help: 'Compliance: must reflect the current APR, term and fees.' }),
      ta('decl5', 'Declaration 5'),
      ta('decl6', 'Declaration 6'),
      ta('decl7', 'Declaration 7'),
      t('privacyHeading', 'Privacy & credit reporting — heading'),
      ta('privacy1', 'Privacy declaration'),
      ta('privacy2', 'Credit reporting consent'),
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
    badge: 'Short-term loans · Aotearoa New Zealand',
    titleLead: 'Borrow Now, Pay Later with',
    titleHighlight: 'TerePay',
    titleTail: '',
    subtitle:
      'Experience the flexibility of accessing funds when you need them the most while managing your finances.',
    disclaimer: '* All loans are charged interest (see below). Terms and conditions apply.',
    primaryCta: 'Ready To Borrow?',
    secondaryCta: "See what you'll repay",
    stat1Value: '24–48h',
    stat1Label: 'Typical review time',
    stat2Value: 'Same day',
    stat2Label: 'Funds once signed',
    stat3Value: 'Fortnightly',
    stat3Label: 'Repayment rhythm',
    tileTitle: 'Borrowing power in your hands.',
    tileBody: 'Interest of 4.74% applies over an eight week term — 49% APR. Fees apply.',
  },
  'landing.uses': {
    eyebrow: 'What you can use it for',
    heading: "Life doesn't wait—and neither should you.",
    intro:
      'With TerePay, you can borrow for what matters most. Our loan amounts are flexible and designed to fit your objectives.',
    use1Title: 'Covering unexpected expenses',
    use1Body: 'A car repair, a broken appliance, a bill that landed early.',
    use2Title: 'Sending support back home',
    use2Body: 'When family overseas need help before your next payday.',
    use3Title: 'Managing medical or family needs',
    use3Body: 'Appointments, treatment and the costs that come with them.',
    use4Title: 'Handling travel or urgent bills',
    use4Body: 'Getting somewhere you need to be, without delay.',
    footnote:
      'Every loan is charged interest and is subject to a credit and affordability assessment. Terms and conditions apply.',
  },
  'landing.calculator': {
    eyebrow: 'Loan calculator',
    heading: "See exactly what you'll repay",
    intro:
      'Interest is 4.74% of the amount borrowed over an eight week loan term, equal to an annual percentage rate of 49%. New customers pay a $50 establishment fee (once only); repeat customers pay a $20 application fee. The fee is deducted from the amount paid to you.',
    cta: 'Apply for this amount',
    disclosure:
      'Interest of 4.74% applies over an eight week term (49% APR), plus a $50 establishment fee for new customers (once only) or a $20 application fee for repeat customers, deducted from the amount paid to you. All loans are subject to a credit and affordability assessment and our responsible lending checks. Terms and conditions apply.',
  },
  'landing.apply': {
    eyebrow: 'How to apply',
    heading: 'Apply now!',
    intro: 'Complete the following questions to get started.',
    body:
      'At TerePay, we know time matters. Most applications are reviewed within 24–48 hours. Once approved and your contract is signed, the money will be in your account the same day.',
    primaryCta: 'Ready to Apply?',
    secondaryCta: 'Existing customer',
    disclosure:
      'Interest of 4.74% applies over an eight week term (49% APR), plus a $50 establishment fee for new customers (once only) or a $20 application fee for repeat customers. Every application is subject to a credit and affordability assessment and our responsible lending checks. Terms and conditions apply.',
    privacyNote:
      'For information on how we collect, use, disclose, store and protect your personal information, see our',
    checklistTitle: 'What identification do I need to apply for a loan?',
    checklistIntro: "To keep things simple, you'll just need:",
    item1: 'A valid photo ID (Passport, NZ Driver Licence, or 18+ Card)',
    item2: 'Your most recent 3 months of bank statements with your current address noted',
    item3: 'Your most recent 3 months of payslips with your current address noted',
    item4: 'A valid visa',
    helpLine: 'Need help? Call us on',
    helpPhone: '+64 0221358538',
  },
  'landing.faq': {
    eyebrow: 'Frequently asked questions',
    heading: 'Everything, before you borrow',
    q1: 'Does TerePay decline applications?',
    a1: 'Yes, TerePay can decline applications if the applicant does not meet the minimum lending criteria. As a responsible lender, TerePay makes reasonable checks to confirm that, based on the information you provide, it is likely that the loan will meet your requirements and objectives, and that you can repay without suffering substantial hardship.\n\nTerePay may decline an application for a number of reasons, including:\n1. Low credit score / active defaults – if you have an active credit default or a history of missed payments.\n2. High loan commitments – if you already have existing debts, and adding another loan may cause substantial hardship.\n3. Persistent overdraft or negative bank balances – if bank statements show continuous overdraft usage with high interest rates.\n4. Unstable income / irregular earnings – if your income is inconsistent or does not support loan repayments.\n5. Incomplete or fraudulent application – if documents are missing, incorrect, or if required identity checks cannot be completed.\n6. Recent loan restructuring – if your previous loan had to be restructured, indicating difficulty in repayment.\n\n**However, you may reapply once your financial situation has improved and meets our lending criteria. If you have any questions, feel free to contact us.**',
    q2: 'What can you use a TerePay loan for?',
    a2: "Life doesn't wait—and neither should you. With TerePay, you can borrow for what matters most:\n• Covering unexpected expenses\n• Sending support back home\n• Managing medical or family needs\n• Handling travel or urgent bills\n\nOur loan amounts are flexible and designed to fit your objectives.",
    q3: 'How long does it take to get approved?',
    a3: 'At TerePay, we know time matters. Most applications are reviewed within 24–48 hours. Once approved and your contract is signed, the money will be in your account the same day.',
    q4: 'What identification do I need to apply for a loan?',
    a4: "To keep things simple, you'll just need:\n• A valid photo ID (Passport, NZ Driver Licence, or 18+ Card)\n• Your most recent 3 months of bank statements with your current address noted\n• Your most recent 3 months of payslips with your current address noted\n• A valid visa",
    q5: 'Are there any hidden fees?',
    a5: 'No, we believe in transparent lending.\n\nThere are no hidden fees — everything is clearly outlined in your loan agreement, so you know exactly what to expect. You can find full details in our Fees & Charges policy, linked in the footer.',
    q6: 'What if I have a question or need help during the application process?',
    a6: 'Call us on +64 0221358538 or email info@terepay.com.',
  },
  'landing.cta': {
    titleLead: 'Borrowing power in',
    titleHighlight: 'your hands.',
    subtitle:
      'Complete the following questions to get started. Applications are reviewed within 24–48 hours.',
    primaryCta: 'Ready To Borrow?',
    disclaimer: '* All loans are charged interest (see below). Terms and conditions apply.',
  },

  'auth.shared': {
    tagline: 'Borrowing power in your hands',
    panelEyebrow: 'Borrow now, pay later',
    tick1: 'Decisions in 24–48 hours — same-day funds once your contract is signed.',
    tick2: 'A responsible lender: we make reasonable checks the loan suits you.',
    tick3: 'No hidden fees — interest and the admin fee are shown before you sign.',
    panelFooter:
      'Your information is encrypted and stored securely. We comply with the NZ Privacy Act 2020. All loans are charged interest.',
    toggleSignIn: 'Sign in',
    toggleCreate: 'Create account',
    disclosure:
      'TerePay is a responsible lender. Applications can be **declined**. All loans are charged interest — see the Disclosure statement and Rates & fees for the full cost.',
  },
  'auth.login': {
    eyebrow: 'Welcome back',
    title: 'Sign in to your account',
    subtitle: 'Enter your details to access your TerePay account.',
    submitCta: 'Sign in',
    submittingCta: 'Signing in…',
    forgotPassword: 'Forgot password?',
    divider: 'New to TerePay?',
    createAccountCta: 'Create an account',
    panelTitleLead: 'Welcome back to',
    panelTitleHighlight: 'TerePay',
    panelBody:
      'Sign in to check your application, track repayments and manage your loan. We’re here when life can’t wait.',
  },
  'auth.signup': {
    eyebrow: 'Get started',
    title: 'Create your account',
    subtitle: 'A few details to get going. You’ll complete your full loan application after signing in.',
    passwordHint: 'At least 8 characters. Use a mix of letters, numbers and symbols.',
    termsDisclosure: 'All loans are charged interest and an admin fee, shown in full before you sign.',
    submitCta: 'Create account',
    submittingCta: 'Creating account…',
    haveAccountText: 'Already have an account?',
    signInLink: 'Sign in',
    panelTitleLead: 'Open your account in',
    panelTitleHighlight: 'minutes',
    panelBody:
      'Join thousands of families across Aotearoa who use TerePay for support back home, urgent bills and life’s surprises — while staying in control.',
  },

  'onboarding.layout': {
    sidebarLabel: 'Account setup',
    step1Label: 'Quick intro',
    step2Label: 'Verify email',
    step3Label: 'Verify mobile',
    step4Label: 'Complete profile',
    step5Label: 'Verify government ID',
  },
  'borrower.compliance': {
    privacyNote: 'Your information is encrypted and stored securely. We comply with the NZ Privacy Act 2020.',
  },
  'onboarding.intro': {
    eyebrow: 'Welcome to TerePay',
    title: "Let's set up your account",
    subtitle: 'It takes a couple of minutes. Have your government-issued ID handy before you start.',
    step1Title: 'Email verification',
    step1Body: "We'll send a link to your email address to confirm it belongs to you.",
    step2Title: 'Mobile verification',
    step2Body: 'This helps us confirm your identity and prevent unauthorised access.',
    step3Title: 'Complete profile',
    step3Body: 'We take security seriously, so we need to get to know you a little better before you can start.',
    step4Title: 'Identity verification',
    step4Body: "As a final security measure, you'll upload a government-issued ID to complete this step.",
    cta: 'Continue',
  },
  'onboarding.disclaimers': {
    approvalDisclaimer:
      'Applications are subject to approval and affordability checks. All loans are charged interest — see full terms before you apply.',
  },
  'onboarding.verifyEmail': {
    title: 'Check your inbox',
    sendingText: 'Sending a verification link to',
    sentText: 'We sent a verification link to',
    instructions: 'Click the link in the email to verify your address.\nThis page will automatically move forward once you do.',
    waitingText: 'Waiting for verification…',
    resendCta: 'Resend verification email',
    spamHint: "Can't find it? Check your spam or junk folder.",
    wrongEmailCta: 'Wrong email address?',
    updateTitle: 'Update your email address',
    updateBody:
      "Enter the correct email address. We'll send a new verification link there, and it will also become your login email.",
    updateCta: 'Update email',
    cancelCta: 'Cancel',
    verifiedTitle: 'Email verified',
    verifiedBody: 'Redirecting you to the next step…',
  },
  'onboarding.verifyMobile': {
    phoneTitle: 'Verify your mobile',
    phoneSubtitle: "We'll send a 6-digit code to your New Zealand mobile number.",
    phoneLabel: 'Mobile number',
    sendCta: 'Send code',
    otpTitle: 'Enter the code',
    otpSubtitleLead: 'We sent a 6-digit code to',
    verifyCta: 'Verify code',
    noCodeText: "Didn't receive a code?",
    resendCta: 'Resend',
  },
  'onboarding.profile': {
    title: 'Complete your profile',
    subtitle: 'We need a few more details to verify your identity and process your application.',
    existingClientQuestion: 'Are you an existing TerePay client?',
    customerIdHelp: 'Your Customer ID was provided by TerePay. Enter it here to link your existing records.',
    submitCta: 'Continue',
  },
  'onboarding.identity': {
    title: 'Verify your identity',
    subtitle:
      'Upload clear photos or scans of the required documents. Files must be JPEG, PNG, WebP, or PDF — max 10 MB each.',
    primaryDocLabel: 'Primary ID document',
    nzLicenceDesc: "Upload the front and back of your NZ Driver's Licence.",
    nzPassportDesc: 'Upload the photo page of your NZ Passport.',
    foreignPassportLabel: 'Passport (country of origin)',
    foreignPassportDesc: 'Upload the photo page of your passport.',
    nzVisaLabel: 'NZ Visa',
    nzVisaDesc: 'Upload your current NZ visa (e.g. student visa, work visa permit).',
    proofOfAddressLabel: 'Proof of Address',
    proofOfAddressDesc:
      'Bank statement or utility bill showing your name and address — dated within the last 3 months.',
    uploadCta: 'Choose file or tap to browse',
    submitCta: 'Submit & continue',
    footnote: "Your documents are reviewed by our compliance team. You'll receive an update within 1–2 business days.",
  },

  'borrower.dashboard': {
    greetingSuffix: '👋',
    welcomeTitle: 'Welcome back',
    calculatorEyebrow: 'Quick estimate',
    calculatorDisclaimer:
      'Applications are subject to approval and affordability checks — final terms confirmed after assessment.',
    calculatorCta: 'Continue to application',
    quickActionsHeading: 'Quick actions',
    helpText: 'Need help? Email',
  },
  'borrower.status.new': {
    eyebrow: 'No active loan',
    title: 'Start a TerePay loan',
    subtitle: 'Borrow $200 – $2,000 · 8 weeks · 4 fortnightly instalments.',
    cta: 'Apply for a loan',
    action1Title: 'Apply for a loan',
    action1Subtitle: 'Quick application · decision in 1–2 business days',
    action2Title: 'Update your profile',
    action2Subtitle: 'Keep your details current for faster approvals',
  },
  'borrower.status.draft': {
    eyebrow: 'Application in progress',
    title: 'Finish your application',
    subtitle:
      "You've started a loan application but haven't submitted it yet. Pick up right where you left off — it only takes a few minutes.",
    pill: 'Not submitted',
    cta: 'Continue your application',
    disclaimer: 'All loans are charged interest and fees. Applications can be declined.',
  },
  'borrower.status.review': {
    eyebrow: 'Application in review',
    title: "We're processing your loan",
    subtitle: "A lender is reviewing your application. We'll notify you when there's an update.",
    pill: 'In review',
    cta: 'Track progress',
    actionTitle: 'Track application',
    actionSubtitle: 'See the current step and estimated timing',
  },
  'borrower.status.approved': {
    eyebrow: 'Loan approved',
    title: 'Your loan is approved',
    subtitle: 'Review your offer and one-tap accept on the loan tracker.',
    pill: 'Approved',
    cta: 'Review offer',
    actionTitle: 'Review your offer',
    actionSubtitle: 'Accept or decline your loan offer',
  },
  'borrower.status.rejected': {
    eyebrow: 'Application outcome',
    title: "We couldn't approve this time",
    subtitle: "Don't worry — you can review the details and try again when you're ready.",
    pill: 'Declined',
    detailsCta: 'See details',
    applyAgainCta: 'Apply again',
    actionTitle: 'Apply again',
    actionSubtitle: 'Start a fresh application',
  },
  'borrower.status.active': {
    eyebrow: 'Active loan balance',
    delinquentEyebrow: 'Payment missed',
    delinquentSubtitle:
      "Your last instalment didn't go through. We'll keep retrying — make sure funds are available in your account.",
    pillOnTrack: 'On track',
    pillLate: 'Late',
    progressLabel: 'Repayment progress',
    cta: 'View repayment schedule',
    actionTitle: 'View repayment schedule',
    actionSubtitle: 'Each instalment is auto-debited on its due date',
  },
  'borrower.status.paid': {
    eyebrow: 'Loan complete',
    title: 'Loan repaid',
    subtitle: "Thanks for repaying on time. You're all set.",
    pill: 'Repaid',
    actionTitle: 'Start a new loan',
    actionSubtitle: 'Your repayment history is on your side',
  },

  'apply.layout': {
    sidebarLabel: 'Loan application',
    backToDashboard: 'Back to dashboard',
    step1Label: 'Personal information',
    step2Label: 'Employment & income',
    step3Label: 'Living expenses',
    step4Label: 'Existing debts',
    step5Label: 'Loan request',
    step6Label: 'Bank account',
    step7Label: 'References',
    step8Label: 'Declarations',
    continueCta: 'Continue',
    backCta: 'Back',
    submitCta: 'Submit application',
    submittingCta: 'Submitting…',
    draftSaved: 'Draft saved',
    autosaveNote: 'Your progress is saved automatically — you can leave and come back anytime.',
    loadingText: 'Loading your application...',
    emailRequiredTitle: 'Email verification required',
    emailRequiredBody: 'You must verify your email address before you can submit a loan application.',
    emailRequiredCta: 'Verify my email',
  },
  'apply.step1': {
    title: 'Personal Information',
    intro: 'Please provide your legal personal details.',
  },
  'apply.step2': {
    title: 'Employment & Income',
    intro: 'Tell us about your current employment and fortnightly earnings.',
    previousEmployerTitle: 'Previous employer',
    previousEmployerBody: "You've been at your current job under 6 months — tell us where you worked before.",
    incomeHeading: 'Fortnightly Income (NZD)',
    totalLabel: 'Total Fortnightly Income',
  },
  'apply.step3': {
    title: 'Living Expenses',
    intro: "Enter your regular **fortnightly** costs. Tap a section to open it, and skip anything that doesn't apply.",
    essentialsTitle: 'Essential costs',
    essentialsHint: 'Rent, food, power, transport, insurance…',
    lifestyleTitle: 'Lifestyle & extras',
    lifestyleHint: 'Eating out, entertainment, travel…',
    subsLabel: 'Do you pay for subscriptions?',
    subsDesc: 'Gym, streaming, sports and similar memberships.',
    bnplLabel: 'Do you use Buy Now, Pay Later?',
    bnplDesc: 'Afterpay, Klarna, Zip and similar.',
    totalLabel: 'Total fortnightly expenses',
  },
  'apply.step4': {
    title: 'Existing Debts & Commitments',
    intro: 'Tell us about loans or repayments you already have, so we can check this loan is affordable.',
    toggleLabel: 'Do you have any existing debts or repayments?',
    toggleDesc: 'Mortgage, personal or car loans, credit cards, overdrafts, BNPL, etc.',
    situationLabel: 'Help us understand your situation',
    situationHint: 'What are these loans for, and when will they finish?',
  },
  'apply.step5': {
    title: 'Loan Request',
    intro: 'Tell us about the loan you need.',
    amountLabel: 'How much do you need?',
    estimateHeading: 'Estimated repayments',
    termsHeading: 'Loan terms',
    pepText:
      'I, or an immediate family member, am a **Politically Exposed Person (PEP)** — someone who holds a senior public role — or a close associate of one.',
    remittanceTitle: 'Money you send overseas',
    remittanceBody: 'Regular transfers abroad (remittances) help us understand your financial commitments.',
  },
  'apply.disclaimers': {
    chargedInterestNote: 'All loans are charged interest and fees.',
  },
  'apply.step6': {
    title: 'Bank Account',
    intro: "Provide the account where you'd like your loan funds deposited.",
    securityNote:
      'Your bank details are stored securely and used solely to deposit your loan funds. We never share this information with third parties.',
    accountFormatHint: 'NZ format: 02-0100-0000000-00',
  },
  'apply.step7': {
    title: 'References',
    intro: 'Provide at least one reference (not a family member). A second reference is optional.',
    note: 'References must not be family members. They may be colleagues, employers, or friends. We need at least one reference with a name and a phone number or email.',
  },
  'apply.step8': {
    title: 'Declarations & Consent',
    intro:
      'Please read and confirm each declaration before submitting your application. For legal compliance, your consent must be confirmed fresh each time you submit.',
    summaryHeading: 'Fees & Repayment Summary',
    summaryNote:
      'Estimate based on your customer status at the time of submission. The application fee will be confirmed at approval.',
    declarationsHeading: 'Declarations',
    decl1: 'I confirm that all information provided in this application is true, accurate, and complete.',
    decl2: 'I understand that TerePay will verify the information I have provided.',
    decl3: 'I authorise TerePay to contact my employer, references, and financial institutions to verify information.',
    decl4: 'I understand the loan terms: 49% APR, 8-week period, 4 fortnightly payments, and applicable fees.',
    decl5: 'I confirm I can afford the loan repayments without suffering substantial hardship.',
    decl6: 'I have received and read the TerePay Disclosure Statement and Terms & Conditions.',
    decl7: 'I understand that failure to repay may result in additional fees, credit reporting, and collection action.',
    privacyHeading: 'Privacy Policy & Credit Reporting Consent',
    privacy1: 'I have read and agree to the TerePay Privacy Policy.',
    privacy2:
      'I authorise TerePay to collect personal information about me from credit reporting agencies (CRA) in connection with my application, disclose my information to CRAs, and allow CRAs to hold and share my information for credit reporting purposes.',
  },
};

/** Merge a saved section's values over its defaults. */
export function withDefaults(key: string, values: ContentSectionValues | undefined): ContentSectionValues {
  return { ...(DEFAULT_CONTENT[key] ?? {}), ...(values ?? {}) };
}
