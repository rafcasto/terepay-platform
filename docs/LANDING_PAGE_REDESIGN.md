# Landing Page — Implementation Notes

The public homepage (`/`) implements the **TerePay landing page redesign** handed off from Claude Design. It is built on the TerePay design system in [src/app/globals.css](../src/app/globals.css) (see the *Design System* section of [CLAUDE.md](../CLAUDE.md)) — warm orange identity on a navy-slate-and-white base, Poppins display headings, Lora for the editorial moments, Public Sans body, IBM Plex Mono for money.

---

## 1. Structure

```
src/app/
  page.tsx                      ← maintenance gate + one getContentSections() read + composition
  _landing/
    Navbar.tsx                  ← client: sticky dark header, anchor links, Sign in, "Join Now"
    HeroSection.tsx             ← navy hero, photo grid, orange tile, stats, wave divider
    PartnersSection.tsx         ← partner-logo marquee (CSS animation, pauses on hover)
    UsesSection.tsx             ← "What you can use it for" — four numbered purposes
    CalculatorSection.tsx       ← section copy (CMS) wrapping…
    LoanCalculator.tsx          ← client: slider + new/repeat toggle + live cost breakdown
    ApplySection.tsx            ← "How to apply" CTAs + identification checklist card
    TestimonialsSection.tsx     ← client: snap-scroll rail, prev/next, auto-advance
    CTABanner.tsx               ← orange "Borrowing power in your hands." band
    FAQSection.tsx              ← native <details> accordion (first item open)
    Footer.tsx                  ← navy footer: policy links, social, contact, FSP/NZBN line
    InterestDisclosure.tsx      ← the standing "All loans are charged interest." note
    icons.tsx                   ← inlined Lucide icons (no icon package in the stack)
```

Pages and sections are Server Components except the three that need browser state (`Navbar`, `LoanCalculator`, `TestimonialsSection`).

Shared CSS added to `globals.css` for this page: `.tp-btn` (+ `--accent`, `--secondary`, `--sm`, `--lg`, `--block`), mirroring the design-system Button, and the `.tp-marquee` keyframes. Both are generic DS utilities and may be reused elsewhere.

## 2. Editable copy

All prose comes from the content editor (`siteContent` collection) and falls back to the defaults in [src/types/content.ts](../src/types/content.ts). Sections, in page order:

| Key | What it drives |
|---|---|
| `landing.hero` | pill, headline (lead / highlighted / tail), subtitle, disclaimer, both CTAs, three stats, orange tile |
| `landing.uses` | eyebrow, heading, intro, four purposes, compliance footnote |
| `landing.calculator` | eyebrow, heading, intro, apply-button label, interest disclosure |
| `landing.apply` | eyebrow, heading, intro, body, both CTAs, disclosure, privacy note, checklist (title, intro, 4 items), help line + phone |
| `landing.cta` | headline (lead / end), subtitle, button, disclaimer |
| `landing.faq` | eyebrow, heading, six Q&As — line breaks are preserved (`whitespace-pre-line`) and `**bold**` is supported |

Partner logos and testimonials are static (`PartnersSection.tsx`, `TestimonialsSection.tsx`).

## 3. Loan figures — single source of truth

The calculator does **not** carry its own maths. It calls `computeRepayment()` from [src/lib/loan/status-display.ts](../src/lib/loan/status-display.ts) with `LOAN_MIN` / `LOAN_MAX`, exactly like the application form and the borrower dashboard, so every surface quotes the same numbers:

- 4 level fortnightly instalments on **principal + interest** (49% p.a., reducing balance; ≈ 4.74% of principal over the 8-week term);
- the application fee (`APPLICATION_FEE_NEW` / `APPLICATION_FEE_EXISTING` in [src/lib/constants/fees.ts](../src/lib/constants/fees.ts)) is **deducted from the amount paid out**, not added to repayments — the breakdown shows "Amount paid to you" to make that explicit.

If the product changes, change the constants — not the landing page. The prose in `landing.calculator` / `landing.hero` that quotes "4.74%", "$50", "$20" is editable copy and must be kept in step by whoever changes the product.

## 4. Compliance rules baked in

- Every borrow CTA sits next to an interest disclaimer or an `InterestDisclosure` note.
- FAQ 1 states plainly that applications can be declined and why.
- Hardship, dispute-resolution, fees, disclosure and privacy links are always reachable in the footer.
- CTAs are honest ("Ready To Borrow?", "See what you'll repay", "Apply for this amount").
- No emoji in product UI; customer quotes are user-generated and shown verbatim.

## 5. Assets

| Path | Notes |
|---|---|
| `public/landing/hero-family.png`, `hero-call.png` | Hero photography from the design handoff. Treat as placeholders — replace with licensed, higher-resolution images (these are ≈ 500 px wide). |
| `public/partners/*.png|jpg` | Partner / accreditation logos from the handoff. |
| `public/brand/terepay-logo-white.png` | Header and footer lockup. |

## 6. Known deviations from the prototype

- Loan range follows the product (`LOAN_MIN`–`LOAN_MAX`) rather than the prototype's $300–$2,000.
- The fee is shown as deducted from the payout (product behaviour) rather than added to the total, as the prototype's demo maths did.
- The header keeps a "Sign in" link and a mobile menu, which the prototype omitted.
- The "What you can use it for" heading is sticky only from the `md` breakpoint up.
