# Landing Page Redesign — Implementation Plan

**Goal:** Replicate and improve the terepay.com landing page for unauthenticated users, using the same brand colours and content.

---

## 1. Brand Colours & Design Tokens

The live terepay.com site uses a teal/dark navy palette. The current app uses indigo (Tailwind default). We need to align with the real brand.

| Token         | Hex       | Usage                                      |
|---------------|-----------|--------------------------------------------|
| Primary       | `#00B3A4` | CTAs, highlights, links, nav accent        |
| Primary Dark  | `#007F74` | Hover states, footer background            |
| Navy          | `#0D1B2A` | Navbar background, section dark bg         |
| Light Teal    | `#E6F9F8` | Hero section background tint               |
| White         | `#FFFFFF` | Card backgrounds, main body                |
| Gray text     | `#6B7280` | Body / secondary text (Tailwind gray-500)  |
| Dark text     | `#111827` | Headings (Tailwind gray-900)               |

Update `globals.css` to define CSS custom properties for brand primary colours and extend the Tailwind theme via `tailwind.config.ts` (or inline via `@theme` in the CSS).

---

## 2. Page Structure

The new `src/app/page.tsx` will be split into clearly named components inside `src/app/(landing)/` or kept as a single file if complexity is low enough. Given the section count, use **one server component file** (`src/app/page.tsx`) referencing small extracted sub-components under `src/app/_landing/`.

```
src/app/
  page.tsx                    ← root layout import + section composition
  _landing/
    Navbar.tsx                ← sticky nav with logo + Sign In / Get Started
    HeroSection.tsx           ← headline, subtext, loan calculator CTA, trust badges
    HowItWorksSection.tsx     ← 3-step process
    FeaturesSection.tsx       ← 3 feature cards
    PartnersSection.tsx       ← partner logo strip
    TestimonialsSection.tsx   ← customer quotes carousel / grid
    FAQSection.tsx            ← accordion FAQ
    CTABanner.tsx             ← "Ready To Borrow?" full-width CTA strip
    Footer.tsx                ← links, contact info, legal, social icons
```

---

## 3. Sections & Content

### 3.1 Navbar
- Logo: "TerePay" wordmark in brand primary teal on dark navy background.
- Links: Home (anchor), How It Works (anchor), FAQs (anchor).
- Right side: **Sign In** (ghost) | **Get Started** (filled teal) → `/auth/signup`.
- Sticky, with a subtle shadow on scroll (CSS class toggled via a small `"use client"` wrapper).

### 3.2 Hero Section
- **Headline:** "Borrow Now, Pay Later with TerePay"
- **Subtext:** "Experience the flexibility of accessing funds when you need them the most while managing your finances."
- **Primary CTA:** "Ready To Borrow?" → scrolls to loan calculator or `/auth/signup`.
- **Trust badges row (icon + label):**
  - Fast Approval
  - Responsible Lending
  - Transparent Fees
- Background: soft teal gradient (`#E6F9F8` → white).
- Mobile: stack vertically, full-width buttons.

### 3.3 How It Works (3 steps)
1. **Apply Online** — Complete the quick application form in minutes.
2. **Get Approved** — We assess your application and respond within 24 hours.
3. **Receive Funds** — Approved funds are transferred directly to your bank account.

Visual: numbered step cards in a horizontal row (3-column grid on desktop, stacked on mobile).

### 3.4 Features / Why TerePay
| Title               | Body                                                                 |
|---------------------|----------------------------------------------------------------------|
| Fast Approval       | Submit your application and receive a decision in as little as 24 hours. |
| Transparent Terms   | No hidden fees. Interest rate 4.7% for the 8-week term. Admin fee $20. |
| Responsible Lending | We ensure loans meet your needs and you can repay without hardship. |

Cards: white bg, teal top-border accent, icon + heading + body.

### 3.5 Loan Summary (Static calculator display)
Show a read-only summary card with example loan terms pulled from the live site rates:
- Loan amount: $1,000 – $2,000
- Interest rate: 4.7% (8-week term)
- Admin fee: $20
- Example: $1,000 loan → Total $1,067 → $266.75 fortnightly

This is purely static/illustrative; no interactive slider needed in v1. Pair with a "Ready to Apply?" CTA button.

### 3.6 Partners Strip
Display partner logos as `<Image>` tags with `alt` text. Use locally saved SVG/PNG placeholders or `next/image` referencing the public CDN URLs if available. Partners shown on live site: OFX, OrbitRemit, DataZoo, FinTechNZ.

> **Note:** Download partner logos to `/public/partners/` before implementation to avoid external image dependencies.

### 3.7 Testimonials
Grid of 4 quote cards (Shahara, Walter, Eric Arambulo, Lyn). Each card: avatar placeholder circle, name, star rating (5 stars), quote text. Light teal card background.

### 3.8 FAQ Accordion
Questions from the live site:
1. Does TerePay decline applications?
2. What can you use a TerePay loan for?
3. How long does it take to get approved?
4. What identification do I need?
5. Are there any hidden fees?
6. What if I have a question or need help?

Implementation: `"use client"` component using React `useState` to toggle open/close per item. No third-party library needed. Chevron icon rotates 180° when open.

### 3.9 CTA Banner
Full-width teal strip:
> **"Borrowing power in your hands."**
> "Apply now — complete a few questions to get started."
> Button: "Apply for a Loan" → `/auth/signup`

### 3.10 Footer
Three columns + social row:
- **Important Information:** Annual Interest Rate, Fees & Charges, Terms & Conditions, Privacy Policy, Disclosure Statement — all as static `<a>` tags pointing to public terepay.com pages or future internal pages.
- **Important Links:** Contract and Agreement (Google Drive link).
- **Contact Us:** 27 Henry Partington Place, Greenhithe, Auckland | info@terepay.com | +64 9 886 7158
- **Social:** Facebook, LinkedIn icon links.
- Bottom bar: © 2026 TerePay. All rights reserved.

Background: dark navy (`#0D1B2A`), text: white/gray-400.

---

## 4. Responsiveness

| Breakpoint | Adjustments                                                        |
|------------|--------------------------------------------------------------------|
| `sm` (<640px) | Single-column layout everywhere, full-width buttons              |
| `md` (640–1024px) | 2-column grids for features/steps                           |
| `lg` (>1024px) | 3-column grids, side-by-side hero layout                      |

Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`). No custom breakpoints needed.

---

## 5. Global CSS / Tailwind Updates

In `globals.css`, add brand CSS variables:

```css
:root {
  --brand-primary: #00B3A4;
  --brand-primary-dark: #007F74;
  --brand-navy: #0D1B2A;
  --brand-light: #E6F9F8;
}
```

In `tailwind.config.ts` (create if missing from `next.config.ts` setup) or via `@theme` block in `globals.css`, extend to expose `bg-brand-primary`, `text-brand-primary`, etc.

---

## 6. Assets

| Asset               | Source                           | Local Path                   |
|---------------------|----------------------------------|------------------------------|
| TerePay logo        | Text wordmark (no image needed)  | n/a                          |
| Partner logos       | Download from terepay.com WP CDN | `/public/partners/`          |
| Hero illustration   | Use CSS gradient / abstract SVG  | `/public/hero-bg.svg` (opt.) |
| Favicon             | Current public/favicon.ico       | existing                     |

---

## 7. SEO / Meta

Update `src/app/layout.tsx` (or add a `metadata` export to `page.tsx`) with:
```ts
export const metadata = {
  title: 'TerePay — Borrow Now, Pay Later',
  description: 'Experience the flexibility of accessing funds when you need them the most. Fast approval, transparent fees, responsible lending.',
  openGraph: { ... }
}
```

---

## 8. Accessibility

- All images must have descriptive `alt` text.
- Interactive elements (FAQ accordion, nav links) must be keyboard-navigable.
- Colour contrast: teal `#00B3A4` on white passes WCAG AA for large text; use dark navy `#0D1B2A` for body text to ensure contrast ratios ≥ 4.5:1.
- Use semantic HTML: `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`, `<h1>`–`<h3>`, `<blockquote>` for testimonials.

---

## 9. Implementation Steps (Sequenced)

1. **Extend Tailwind / CSS** — add brand colour tokens to `globals.css` and expose via `@theme`.
2. **Create `_landing/` directory** and stub all component files.
3. **Navbar** — implement sticky nav with brand colours and auth buttons.
4. **HeroSection** — headline, subtext, trust badges, primary CTA.
5. **HowItWorksSection** — numbered 3-step cards.
6. **FeaturesSection** — 3 feature cards with teal accent.
7. **LoanSummaryCard** — static loan example with CTA.
8. **PartnersSection** — logo strip (placeholders acceptable for v1).
9. **TestimonialsSection** — 4 quote cards.
10. **FAQSection** — client-side accordion.
11. **CTABanner** — full-width teal.
12. **Footer** — dark navy with columns and social links.
13. **Compose `page.tsx`** — import all sections, update metadata.
14. **QA** — test across sm/md/lg breakpoints, keyboard navigation, contrast.

---

## 10. Out of Scope (v1)

- Interactive loan calculator (slider/inputs) — content is static only.
- Dark mode overrides for landing page (existing dark mode in `globals.css` may need to be scoped away from the landing page).
- Animation/micro-interactions beyond CSS transitions.
- Downloading and hosting partner logos (placeholders acceptable).
