# Qippay branding in the payment flows

TerePay is a Qippay merchant. Qippay's **Merchant Brand Guidelines — Embedded
checkout (October 2026)** govern how Qippay appears wherever an applicant pays
or authorises payments through it. This page records which rules apply, how
they are implemented, and the one place each rule lives in code.

Everything below only renders while the `qippay_enabled` flag is on (see
[FEATURE_FLAGS.md §5.2](FEATURE_FLAGS.md)). Manual repayment mode shows none of it.

## Where it applies

| Flow | Surface | Component |
|---|---|---|
| SetPay repayment authorisation | `/applicant/applications/[id]` (status `awaiting_payment_consent`) | `src/app/applicant/applications/[id]/_components/InitiatePaymentConsentCard.tsx` |
| PayBy early repayment | `/applicant/applications/[id]` (live loan) | `src/app/applicant/applications/[id]/_components/EarlyRepaymentCard.tsx` |
| Return / confirmation pages | `.../consent/return`, `.../early-repayment/return` | `page.tsx` in each folder |
| Status copy | Approved / Active screens | `src/components/applicant/screens/Screen{Approved,Active}.tsx` |

Lender and admin screens are internal, not checkout: they may still say
"SetPay" / "PayBy" because that is the API product being operated.

## Single source of truth

- **Copy, colours, URLs, logo:** [`src/lib/qippay/brand.ts`](../src/lib/qippay/brand.ts)
- **Components:** [`src/components/qippay/`](../src/components/qippay/)
  - `QippayLockup` — logo + tagline + "Learn how Qippay works" (§3)
  - `QippayPayButton` — the dedicated orange button (§5)
  - `QippayCheckoutIntro` — title, short copy, four steps (§5)
  - `QippayBankPicker` — mobile number + vertical bank list (§6)
  - `QippayFaq` — the three recommended FAQ entries (§7)
- **Tokens:** `--qippay-orange`, `--qippay-text`, `--qippay-hover` in `globals.css`

Do not hard-code Qippay wording or colours anywhere else.

## Rules we follow

| § | Rule | How |
|---|---|---|
| 3 | Approved logo only, ≥ 24px high, primary colour on light backgrounds, no recolour / stretch / crop / effects | `QippayLockup` locks the aspect ratio and floors the height at 24px. Artwork: `public/partners/qippay.png` (`#F47B20` lockup, clear space built in). |
| 3 | Tagline "Pay by bank with Qippay" and "Learn how Qippay works" → qippay.com/consumers | Fixed in `QippayLockup`. |
| 4 | Use the product descriptor, never "SetPay" / "PayBy" / "AnyPay", in checkout; never abbreviate or re-capitalise | `QIPPAY_DESCRIPTOR`. Context "Open Banking Payments" given at first mention. |
| 5 | Dedicated button labelled "Pay by bank with Qippay"; `#F47820` background, `#F4F4F4` text, `#000000` hover | `QippayPayButton`. The only other labels it carries are "Continue to [Bank]" (§6) and a loading state. |
| 5 | Checkout copy (title + short version) and the four instructions shown as soon as the customer selects it | `QippayCheckoutIntro`; "[your store]" → TerePay. |
| 6 | Mobile number field with the fixed helper text, above the banks | `QippayBankPicker`. |
| 6 | "Choose your bank to pay securely"; vertical layout; same-size logos ≥ 90 × 54; alphabetical; no bank enlarged, highlighted or pre-selected | `QippayBankPicker` sorts and renders every logo in a 90 × 54 box; callers start with `providerId = ''`. |
| 6 | Select-and-confirm: "Continue to [Bank]" | Button label from `QIPPAY_BANK_SELECTION.continueTo`. |
| 6 | Bank logos exactly as supplied by the API; refresh daily/weekly, not per transaction | `logo_url` is rendered untouched; `listProviders()` caches the list for 24h per instance. |
| 7 | Payments FAQ with the three recommended questions | `QippayFaq`, shown on the authorisation card. |

## TerePay-side obligations that still apply

The Qippay copy is used verbatim, and TerePay's CCCFA lines sit beside it
rather than replacing it: the amount being authorised or paid is always
visible, "All loans are charged interest" stays next to the CTA, and
"Applications can be declined" stays on the bank-selection step.

The Qippay button colours are Qippay's, not ours. `#F4F4F4` on `#F47820` is
below WCAG AA for body text, which is why the button text is 16px semibold and
why these tokens must not be reused for TerePay controls.

## Assets

The guideline asset folder (Qippay SharePoint) carries the logo and bank-logo
SVGs. We currently ship the PNG lockup Qippay supplied for the partner strip.
If the SVG becomes available, drop it at `public/partners/` and update
`QIPPAY_LOGO` in `brand.ts` — nothing else needs to change.

Support: 09 300 1424 · support@qippay.com (`QIPPAY_SUPPORT`).
