/**
 * Qippay Merchant Brand Guidelines — Embedded checkout (October 2026).
 *
 * Single source of truth for everything the guidelines mandate in the
 * customer-facing payment flows: product descriptor, approved copy, colours,
 * logo and link targets. Components in `src/components/qippay/*` read from
 * here; do not hard-code Qippay wording or colours elsewhere.
 *
 * See docs/QIPPAY_BRANDING.md for the full rule set and where it applies.
 */

/** Trading name substituted for "[your store]" in the guideline copy. */
export const MERCHANT_NAME = 'TerePay';

/**
 * §4 Product descriptors — in checkout use the descriptor, never the product
 * name (PayBy / SetPay / AnyPay). Never abbreviate or re-capitalise it.
 */
export const QIPPAY_DESCRIPTOR = 'Pay by bank with Qippay';

/** §4 "give context in first mentions". */
export const QIPPAY_CONTEXT = 'Open Banking Payments';

/** §4 "pair the name with a benefit where it fits". */
export const QIPPAY_DESCRIPTOR_WITH_BENEFIT = `${QIPPAY_DESCRIPTOR}. Secure and affordable.`;

/** §3 Learn more line — label and destination are both fixed by the guidelines. */
export const QIPPAY_LEARN_MORE_LABEL = 'Learn how Qippay works';
export const QIPPAY_CONSUMERS_URL = 'https://qippay.com/consumers';

/**
 * §3 Logo — approved artwork as supplied (orange `qip PAY` lockup, clear space
 * built in). Minimum 24px high on digital surfaces. Do not recolour, stretch,
 * crop or add effects.
 */
export const QIPPAY_LOGO = {
  src: '/partners/qippay.png',
  /** Intrinsic pixel size of the artwork — keeps the aspect ratio locked. */
  width: 244,
  height: 206,
  alt: 'Qippay',
  /** Guideline minimum for digital use. */
  minHeightPx: 24,
} as const;

/**
 * §5 Checkout colours — dedicated "Pay by bank with Qippay" button.
 * These are Qippay's brand values, not TerePay's, and are intentionally kept
 * separate from the TerePay orange scale. Mirrored as CSS tokens in
 * globals.css (`--qippay-orange`, `--qippay-text`, `--qippay-hover`).
 */
export const QIPPAY_COLOURS = {
  /** HEX #F47820 · RGB 244,123,32 — button background and logo colour. */
  orange: '#F47820',
  /** HEX #F4F4F4 · RGB 244,244,244 — text on the orange button. */
  text: '#F4F4F4',
  /** HEX #000000 — hover / secondary style. */
  hover: '#000000',
} as const;

/** §5 Checkout copy — verbatim from the guidelines. */
export const QIPPAY_CHECKOUT_COPY = {
  title: QIPPAY_DESCRIPTOR,
  short:
    "A secure way to pay directly from your bank account. Simply confirm the payment in your bank's app.",
  long:
    `${QIPPAY_DESCRIPTOR}, a secure account-to-account payment method. Instead of entering card details, ` +
    "you'll be redirected to your bank to approve the payment in your banking app or online banking. " +
    "Once confirmed, you'll return to complete your purchase.",
} as const;

/**
 * §5 Checkout instructions — shown as soon as the customer selects Pay by bank
 * with Qippay. "[your store]" is replaced with the trading name.
 */
export const QIPPAY_CHECKOUT_STEPS: readonly string[] = [
  'Enter your mobile number.',
  'Choose your bank.',
  'Approve the payment in your banking app or online banking (Open Banking).',
  `Come back to ${MERCHANT_NAME} for your confirmation.`,
];

/** §6 Bank selection — field labels and helper copy. */
export const QIPPAY_BANK_SELECTION = {
  guidance: 'Choose your bank to pay securely',
  mobileLabel: 'Mobile number',
  mobileHelper: 'Your bank can use this to send the payment request straight to your banking app.',
  /** Select-and-confirm pattern: "Continue to [Bank]". */
  continueTo: (bankName: string) => `Continue to ${bankName}`,
  /**
   * Minimum rendered logo size. Every bank logo is shown at least 90px wide:
   * 90 × 54 for the 5:3 rectangle format used in the vertical layout.
   */
  logoWidthPx: 90,
  logoHeightPx: 54,
} as const;

/** §7 Payments FAQ — recommended questions, verbatim. */
export const QIPPAY_FAQ: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: `What is ${QIPPAY_DESCRIPTOR}?`,
    a: 'A way to pay straight from your bank account, without entering card details. You enter your mobile number, choose your bank and approve the payment in your banking app.',
  },
  {
    q: 'Is it secure?',
    a: "Yes. You approve every payment in your own bank's app, and you never share your banking login or card details. Qippay is accredited by MBIE under New Zealand's Consumer Data Right and certified to ISO 27001:2022.",
  },
  {
    q: 'Want to know more?',
    a: 'Visit qippay.com/consumers for answers to common questions about paying with Qippay.',
  },
];

/** §8 Support — Qippay merchant support, for internal/admin surfaces. */
export const QIPPAY_SUPPORT = {
  phone: '09 300 1424',
  email: 'support@qippay.com',
} as const;

/** Sort banks alphabetically for the primary (vertical) layout — §6. */
export function sortBanksAlphabetically<T extends { name: string }>(banks: readonly T[]): T[] {
  return [...banks].sort((a, b) => a.name.localeCompare(b.name, 'en-NZ', { sensitivity: 'base' }));
}
