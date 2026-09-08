/**
 * Content editor page + navigation registry.
 *
 * One source of truth for what the content editor's sidebar shows and which
 * content sections each editor page edits. Every page is served by the
 * `/content-editor/[...slug]` route; `findContentPage(slug)` resolves it.
 *
 * Pure data — safe to import from both server and client components.
 */

export interface ContentPageDef {
  /** URL path under /content-editor/, e.g. `onboarding/verify-email`. */
  slug: string;
  title: string;
  description: string;
  /** Section keys (from `CONTENT_SECTIONS`) edited on this page, in order. */
  sectionKeys: string[];
  /** Optional link to the live page so editors can check their changes. */
  previewHref?: string;
}

export interface ContentNavLeaf {
  label: string;
  /** Slug under /content-editor/ — either a registry page or a static route. */
  slug: string;
}

export interface ContentNavItem extends Partial<ContentNavLeaf> {
  label: string;
  children?: ContentNavLeaf[];
}

export interface ContentNavGroup {
  label: string;
  items: ContentNavItem[];
}

const ONBOARDING_STEPS: ContentPageDef[] = [
  {
    slug: 'onboarding/intro',
    title: 'Onboarding — Quick intro',
    description:
      'The account-setup overview screen. Also holds the sidebar label, step names and the privacy note shared by every onboarding step.',
    sectionKeys: ['onboarding.intro', 'onboarding.disclaimers', 'onboarding.layout', 'borrower.compliance'],
    previewHref: '/applicant/onboarding',
  },
  {
    slug: 'onboarding/verify-email',
    title: 'Onboarding — Verify email',
    description: 'Copy on the "check your inbox" screen.',
    sectionKeys: ['onboarding.verifyEmail'],
    previewHref: '/applicant/onboarding/verify-email',
  },
  {
    slug: 'onboarding/verify-mobile',
    title: 'Onboarding — Verify mobile',
    description: 'Copy on the phone-number and 6-digit code screens.',
    sectionKeys: ['onboarding.verifyMobile'],
    previewHref: '/applicant/onboarding/verify-mobile',
  },
  {
    slug: 'onboarding/profile',
    title: 'Onboarding — Complete profile',
    description: 'Headings and helper copy on the profile form.',
    sectionKeys: ['onboarding.profile'],
    previewHref: '/applicant/onboarding/profile',
  },
  {
    slug: 'onboarding/identity',
    title: 'Onboarding — Verify identity',
    description: 'Headings, document descriptions and the footnote on the ID upload screen.',
    sectionKeys: ['onboarding.identity'],
    previewHref: '/applicant/onboarding/identity',
  },
];

const BORROWER_STATUS_PAGES: Array<ContentPageDef & { navLabel: string }> = [
  {
    slug: 'borrower/status/new',
    navLabel: 'No active loan',
    title: 'Borrower — No active loan',
    description: 'What a borrower sees when they have no open application or loan.',
    sectionKeys: ['borrower.status.new'],
  },
  {
    slug: 'borrower/status/draft',
    navLabel: 'Application in progress',
    title: 'Borrower — Application in progress',
    description: 'What a borrower sees when they have an unsubmitted application.',
    sectionKeys: ['borrower.status.draft'],
  },
  {
    slug: 'borrower/status/review',
    navLabel: 'In review',
    title: 'Borrower — Application in review',
    description: 'What a borrower sees while their application is being assessed.',
    sectionKeys: ['borrower.status.review'],
  },
  {
    slug: 'borrower/status/approved',
    navLabel: 'Approved',
    title: 'Borrower — Loan approved',
    description: 'What a borrower sees once an offer is made.',
    sectionKeys: ['borrower.status.approved'],
  },
  {
    slug: 'borrower/status/rejected',
    navLabel: 'Declined',
    title: 'Borrower — Application declined',
    description: 'What a borrower sees when an application or offer was declined, withdrawn or expired.',
    sectionKeys: ['borrower.status.rejected'],
  },
  {
    slug: 'borrower/status/active',
    navLabel: 'Active loan',
    title: 'Borrower — Active loan',
    description: 'What a borrower sees while repaying, including the missed-payment variant.',
    sectionKeys: ['borrower.status.active'],
  },
  {
    slug: 'borrower/status/paid',
    navLabel: 'Repaid',
    title: 'Borrower — Loan repaid',
    description: 'What a borrower sees once their loan is fully repaid.',
    sectionKeys: ['borrower.status.paid'],
  },
];

const LOAN_REQUEST_STEPS: Array<ContentPageDef & { navLabel: string }> = [
  {
    slug: 'loan-request/step-1',
    navLabel: 'Step 1 — Personal information',
    title: 'Loan request — Step 1: Personal information',
    description:
      'Heading and intro for step 1. Also holds the sidebar label, step names, navigation buttons and the privacy note shared by every step.',
    sectionKeys: ['apply.step1', 'apply.layout', 'borrower.compliance'],
    previewHref: '/applicant/apply?step=0',
  },
  {
    slug: 'loan-request/step-2',
    navLabel: 'Step 2 — Employment & income',
    title: 'Loan request — Step 2: Employment & income',
    description: 'Heading, intro and sub-headings for the employment step.',
    sectionKeys: ['apply.step2'],
    previewHref: '/applicant/apply?step=1',
  },
  {
    slug: 'loan-request/step-3',
    navLabel: 'Step 3 — Living expenses',
    title: 'Loan request — Step 3: Living expenses',
    description: 'Heading, intro and expense-group titles.',
    sectionKeys: ['apply.step3'],
    previewHref: '/applicant/apply?step=2',
  },
  {
    slug: 'loan-request/step-4',
    navLabel: 'Step 4 — Existing debts',
    title: 'Loan request — Step 4: Existing debts',
    description: 'Heading, intro, the debts toggle and the free-text prompt.',
    sectionKeys: ['apply.step4'],
    previewHref: '/applicant/apply?step=3',
  },
  {
    slug: 'loan-request/step-5',
    navLabel: 'Step 5 — Loan request',
    title: 'Loan request — Step 5: Loan request',
    description: 'Heading, intro, estimate labels, PEP statement, remittance copy and the compliance disclaimer.',
    sectionKeys: ['apply.step5', 'apply.disclaimers'],
    previewHref: '/applicant/apply?step=4',
  },
  {
    slug: 'loan-request/step-6',
    navLabel: 'Step 6 — Bank account',
    title: 'Loan request — Step 6: Bank account',
    description: 'Heading, intro, security note and the account-format hint.',
    sectionKeys: ['apply.step6'],
    previewHref: '/applicant/apply?step=5',
  },
  {
    slug: 'loan-request/step-7',
    navLabel: 'Step 7 — References',
    title: 'Loan request — Step 7: References',
    description: 'Heading, intro and the eligibility note.',
    sectionKeys: ['apply.step7'],
    previewHref: '/applicant/apply?step=6',
  },
  {
    slug: 'loan-request/step-8',
    navLabel: 'Step 8 — Declarations & consent',
    title: 'Loan request — Step 8: Declarations & consent',
    description: 'Heading, intro, fee-summary copy and every declaration the borrower must tick.',
    sectionKeys: ['apply.step8'],
    previewHref: '/applicant/apply?step=7',
  },
];

export const CONTENT_PAGES: ContentPageDef[] = [
  {
    slug: 'landing',
    title: 'Landing page',
    description: 'Homepage copy shown to everyone.',
    sectionKeys: ['landing.hero', 'landing.howItWorks', 'landing.features', 'landing.faq', 'landing.cta'],
    previewHref: '/',
  },
  {
    slug: 'login',
    title: 'Login page',
    description: 'Copy on the sign-in screen and its brand panel.',
    sectionKeys: ['auth.login', 'auth.shared'],
    previewHref: '/auth/login',
  },
  {
    slug: 'registration',
    title: 'Registration page',
    description: 'Copy on the create-account screen and its brand panel.',
    sectionKeys: ['auth.signup', 'auth.shared'],
    previewHref: '/auth/signup',
  },
  ...ONBOARDING_STEPS,
  {
    slug: 'borrower/dashboard',
    title: 'Borrower landing page',
    description:
      'Greeting, quick-estimate calculator and help line shown to every signed-in borrower. Status-specific copy lives on the status pages.',
    sectionKeys: ['borrower.dashboard'],
    previewHref: '/applicant/dashboard',
  },
  ...BORROWER_STATUS_PAGES,
  ...LOAN_REQUEST_STEPS,
];

export function findContentPage(slug: string): ContentPageDef | undefined {
  return CONTENT_PAGES.find((p) => p.slug === slug);
}

export const CONTENT_NAV: ContentNavGroup[] = [
  {
    label: 'Top of funnel',
    items: [
      { label: 'Landing CMS', slug: 'landing' },
      { label: 'Login', slug: 'login' },
      { label: 'Registration', slug: 'registration' },
      {
        label: 'Onboarding',
        children: [
          { label: 'Quick intro', slug: 'onboarding/intro' },
          { label: 'Verify email', slug: 'onboarding/verify-email' },
          { label: 'Verify mobile', slug: 'onboarding/verify-mobile' },
          { label: 'Complete profile', slug: 'onboarding/profile' },
          { label: 'Verify identity', slug: 'onboarding/identity' },
        ],
      },
    ],
  },
  {
    label: 'Borrower views',
    items: [
      {
        label: 'Borrower landing page',
        children: [
          { label: 'Shared (all statuses)', slug: 'borrower/dashboard' },
          ...BORROWER_STATUS_PAGES.map((p) => ({ label: p.navLabel, slug: p.slug })),
        ],
      },
      {
        label: 'Loan request',
        children: LOAN_REQUEST_STEPS.map((p) => ({ label: p.navLabel, slug: p.slug })),
      },
    ],
  },
  {
    label: 'Communications',
    items: [{ label: 'Email sequences', slug: 'emails' }],
  },
];
