# Handoff: TerePay loan tracking & application

## Overview

The complete user-facing flow for TerePay, a New Zealand short-term personal-loan product. This handoff covers two top-level views — a state-aware **Dashboard** (home) and a **Loan progress detail** screen — driven by a single `loanStatus` field on the user. The same user model can be in six different states; every screen and component below adapts its content accordingly.

Loan product rules:
- Amount: **NZ$200 – NZ$2,000** (steps of $50)
- Term: **8 weeks, fixed**
- Repayment: **4 fortnightly instalments** (every 2 weeks)
- APR: **49%**
- Currency: NZD

## About the Design Files

The files in this bundle are **design references created in HTML** — high-fidelity prototypes showing intended look and behavior, not production code to copy directly. The task is to **recreate these designs in the target Next.js + TypeScript codebase** using its established patterns and libraries (component primitives, styling approach, routing, state, API conventions).

`Loan Tracking.html` is the canonical source of truth. Open it in a browser, toggle the **Tweaks** panel (bottom-right), and scrub through every value of "Application status" + "View" to see every state of every screen. Match spacing, type, color, motion, and copy exactly.

## Fidelity

**High-fidelity (hifi).** Pixel-perfect mockups with final colors, typography, spacing, motion, and interactions. Recreate the UI pixel-perfectly using the codebase's existing primitives where they map cleanly; only add new components when the mockup needs something the codebase doesn't have.

## Loan states

A user's loan goes through (at most) these states. Both the Dashboard and the Detail screen reshape themselves per state.

| id | label | description |
|---|---|---|
| `new` | New user (no loan) | First-time user or returning user with no active loan |
| `review` | In review | Application submitted, awaiting credit decision |
| `approved` | Approved | Offer issued, awaiting acceptance + direct-debit setup |
| `rejected` | Rejected | Application declined |
| `active` | Active loan | Loan disbursed, repayments in progress |
| `paid` | Paid off | Loan fully repaid |

## Screens / Views

### Dashboard (every state)

Layout is identical across states; content varies.

- **Top bar** — dark navy (`--ink`) sticky bar, 16px vertical padding, 20px horizontal. Left: TerePay wordmark in amber (`--accent`), 20px / 800-weight, -0.01em tracking. Right: hamburger icon in amber. No back arrow on dashboard.
- **Content column** — centered, `max-width: 540px`, `padding: 24px 20px 80px` (20px → 16px horizontal on screens ≤480px).
- **Greeting block** — small eyebrow text + bold h1 ("Welcome back, Rafael" for returning users, "Hi Rafael, let's get started" for new). Eyebrow varies per state ("Good morning 👋", "Big news 🎉", "Hello again", "Nicely done 🎊").
- **Hero card** — dark navy (`--ink`) rounded card, 24px padding, `border-radius: 20px`, subtle radial accent glow from top-right. Approved/Paid heroes use linear gradient toward state-tinted dark color (green-dark / red-dark / amber-dark for new). Contains eyebrow, optional status pill (top-right), title, subtitle, state-specific content, and a primary CTA button.
- **Quick actions section** — uppercase section heading (varies: "Quick actions", "Next steps", "What you can do", "What's next", "Get started") + a vertical stack of action rows. Each row: 44×44 rounded-12 icon tile (amber-tinted for primary, neutral surface-2 for secondary), title + subtitle, right chevron. Primary action gets an amber border accent + amber-soft background. Optional "ACTION NEEDED" amber pill badge next to title.
- **Footer note** — small muted text with a tiny icon — trust/legal/help blurb that varies per state.

#### Per-state hero content

- **new** — eyebrow "Personal loans · NZ", title "Borrow up to $2,000, fast.", body about same-day decisions, trust strip (FMA-licensed / 5-min application / Funds same day) above the CTA. CTA: "Apply for a loan".
- **review** — eyebrow "Loan application", title "Application in review", body about SMS notification. Mini-progress bar (40% filled, gold→amber gradient) + meta row ("Step 2 of 4 · Credit check" + amber "Action needed" pill). CTA: "Track loan progress".
- **approved** — eyebrow "You're approved", title "$1,500 is ready for you" (uses approved amount, not requested), body shows approved-vs-requested delta inline. Meta row with payment summary + offer-expiry. Confetti animation overlay (24-piece, 1.6s fall, delayed 700ms after mount). CTA: "Accept your offer".
- **rejected** — eyebrow "Application update", title "We can't offer you a loan right now", empathetic body mentioning $X request, 30-day retry. CTA: "See what you can do".
- **active** — eyebrow "Active loan · TP-29481" + "Active" pill. Large balance display (40px, -0.03em tracking, currency prefix at 18px elevated 6px). Outstanding balance label above. Progress bar (gold→amber gradient on white-12 track) + meta row (paid count + remaining amount). Next-payment inline box: white-6 background, eyebrow + amount + relative due time, with inline "Pay now" amber button.
- **paid** — eyebrow "Loan paid in full", title "You're loan-free 🎊", body with stats and Tier 2 unlock teaser. Confetti (28-piece). CTA: "Apply for next loan".

#### Per-state quick actions

- **new** — Apply for a loan (amber primary) · Loan calculator · Check your eligibility · How it works
- **review** — Track application · Upload documents (ACTION NEEDED badge) · Talk to support
- **approved** — Accept your offer (amber primary) · Compare to your request · Read the agreement · Talk to support
- **rejected** — See your $1,200 offer (amber primary) · Improve your credit · Reapply on 14 Jun · Talk to support
- **active** — Make a payment (amber primary) · Track repayment · Loan history · Manage auto-pay
- **paid** — Apply for a loan (amber primary) · Loan history · Closure letter · Refer a friend

### Apply (state `new` → tracking detail)

Interactive loan calculator. Single page, no multi-step form.

- **Page header** — eyebrow "New application" + h1 "How much do you need?"
- **Calculator hero** — dark navy card. "You'd like to borrow" small label + big amount display ("NZ$ 1,000", currency prefix smaller and elevated). Range input slider $200–$2,000 step $50 — track is white-10, thumb is 24px amber circle with 4px white border + drop shadow. Slider meta row shows "$200" / "$2,000" at ends. Below: 2-column white-6 stat grid showing "Per instalment" + "Total repayable", live-computed.
- **Repayment plan card** — white card listing Instalments (4 fortnightly payments), Term (8 weeks), Per instalment, First payment (In 2 weeks).
- **Purpose chips** — pill-shaped buttons: Bills, Car, Medical, Travel, Something else. Icon + label. Selected state: amber border, amber-soft bg, amber-2 text bold.
- **Offer summary card** — white card with dashed dividers between rows: Loan principal, Establishment fee (tiered: $65 < $500, $95 < $1,000, $125 ≥ $1,000), Interest (49% APR), Total repayable in bold larger.
- **Info banner** — light-blue ("info" tone) "This is an estimate" disclaimer.
- **Footer CTA** — large amber "Continue application" button (block), followed by centered small "Soft credit check only" reassurance.

Submitting flips status from `new` to `review` and toasts "Application submitted!"

#### Repayment math (use exactly this formula in the calculator)

```
fee = amount < 500 ? 65 : amount < 1000 ? 95 : 125
interest = amount * 0.49 * (8 / 52)
totalRepayable = amount + fee + interest
instalmentAmount = totalRepayable / 4
```

### In review (tracking detail)

- **Page header** — "Loan progress" eyebrow + "We're reviewing your application" h1.
- **Hero card** — dark navy, eyebrow "Application TP-29481", "In review" pill (amber, pulsing dot), title "$X personal loan", subtitle about SMS notification. Hero meta row: "4 instalments · fortnightly · $X/payment · 49% APR".
- **Action Required card** — important. White card with **amber border** + amber-soft top gradient, amber-tinted box-shadow. Contains:
  - "ACTION NEEDED" amber pill + meta count
  - Title "Upload your last 3 months of bank statements"
  - Subtitle explaining why + "Why is this needed?" link
  - **Drop zone** — dashed border surface-2 background, 24px padding, center-aligned upload icon + "Drop files here or click to upload" + "PDF, CSV, or images · up to 10 MB each". Becomes amber bordered on hover/drag-over.
  - **Doc list** (when files added) — each item shows icon tile + filename (ellipsized) + meta line. Two statuses:
    - `uploading` — neutral background, 3px progress bar + "Uploading… X%" meta
    - `done` — success-soft background, success-colored icon and meta "Uploaded"
  - When uploaded: "Submit X documents" amber button appears below
  - When card has uploads: border becomes success-green instead of amber, badge becomes "X uploaded" success pill
- **Progress stepper** — vertical timeline in a white card. 4 steps: Submitted (done, time), Credit check (active, "Now"), Final decision (pending), Funds disbursed (pending). Each step: 28px circle (success-green check / amber pulsing dot / numbered gray ring) + title + meta + optional right-aligned time. Connecting line in success-green between done steps, gradient between active and pending.
- **What's next info banner** — blue info banner about SMS decision delivery.
- **Chat with support** secondary button + tiny "Cancel request" link footer.

### Approved (tracking detail)

- **Page header** — "Great news" eyebrow + "You're approved 🎉" h1.
- **Hero card** — green-tinted gradient. Eyebrow + "Approved" success pill. Title "$X is ready for you" (uses approved amount). Subtitle changes copy when approved < requested (explains the reduction). Confetti overlay.
- **Amount delta block** (only when approved < requested) — white-6 box inside hero. Two rows:
  - "You requested" + struck-through $X requested
  - "We approved" + bold amber $X approved at 22px
- **Stat grid** — Per instalment + Total repayable.
- **Offer summary card** — Loan principal, Establishment fee, Interest, Term ("4 instalments · fortnightly"), First payment, Total repayable (bold).
- **What happens next card** — 3 numbered rows (amber circle): "Accept the offer" / "Set up your fortnightly direct debit" / "Funds land in your account".
- **Agreement banner** — info banner with shield icon, links to Loan agreement + Credit disclosure.
- **Agreement checkbox** — disables the CTA until ticked.
- **CTA** — amber "Accept & set up direct debit" (gated on checkbox) + secondary "Decline offer".
- **Footer note** — offer-valid-until + early-repayment fee waiver.

#### Direct Debit modal (opens from "Accept & set up direct debit")

3-step bottom sheet (mobile) / centered modal (desktop ≥600px). Header has title that changes per step; close button always present. Top of body: step-indicator strip in surface-2 pill with 3 dots ("Account / Details / Authorise") with done-state checkmarks and connecting lines.

- **Step 1 — Account.** Body intro paragraph "We'll debit $X every 2 weeks for 4 instalments, starting [date]." Two radio-card options: "Westpac •• 4421 (Linked during application · recommended)" and "Use a different account". Selecting one styles its card amber. Continue button → step 2.
- **Step 2 — Details.** Form fields: Account holder name (pre-filled "Rafael Tere"), Bank, BSB (validate regex `^\d{2}-?\d{4}$`), Account number. If "Westpac" was selected on step 1, all fields except name are pre-filled and disabled with "Use a different account" link to switch. "Review & authorise" button → step 3 (disabled until valid).
- **Step 3 — Authorise.** Summary card listing Amount per fortnight, Total payments, Starts, From, Account name. Then two consent checkboxes (Direct Debit Service Agreement + Privacy notice). Info banner about pause/change/cancel. "Authorise & release funds" button (disabled until both checked).
- **Submitting state** — button label becomes "Setting up…" for ~1.1s.
- **Success state** — replaces the modal body with a centered green checkmark circle + "You're all set." + "Your direct debit is active. Releasing funds to your account now…" Auto-dismisses after 1.1s; loan status transitions to `active` with success toast.

### Rejected (tracking detail)

- **Page header** — "Decision received" eyebrow + "We can't offer you a loan right now" h1.
- **Hero card** — red-tinted gradient. Eyebrow "Reference TP-2509-RX", "Declined" red pill. Title "Application unsuccessful", subtitle explains decline + no credit score impact + retry timeline. White-6 inner box showing reason ("Credit profile below current threshold").
- **What you can do card** — 3 rows: "Try a smaller amount" (amber icon, "See offer" link), "Build your credit" ("Learn more"), "Reapply on 14 Jun" ("Set reminder").
- **Info banner** — info tone, "Want a detailed reason?" + Request reasons link.
- **CTAs** — amber "See your $1,200 offer" + secondary "Talk to support".

### Active loan (tracking detail)

- **Page header** — "Personal loan · TP-29481" eyebrow + "Your loan, right on track" h1.
- **Hero card** — dark navy. Eyebrow "Outstanding balance" + "Active" info pill. Big balance display ("NZ$ 869.04"). Balance meta line ("of $1,738.08 total · 2 of 4 payments made"). Progress bar. Next-payment inline box (eyebrow + amount + due-relative + inline Pay now button).
- **Repayment schedule card** — vertical list of 4 rows. Each row: 44×44 date tile (month abbr + day, colored per status: success-soft for paid, amber-soft for next, surface-2 for upcoming), title ("Payment X of 4" / "Next payment" / "Scheduled") + sub ("Paid via direct debit" / "Auto-pay scheduled" / "Will be auto-debited"), amount (struck-through grey for paid). "View full schedule" link in section header.
- **Settings card** — two toggle rows: Auto-pay (Direct debit your fortnightly payment automatically), Payment reminders (SMS 2 days before each payment). Both default to on (amber-on, gray-off).
- **Footer actions** — 2-column secondary buttons: Statement / Pay off early.

#### Pay-now sheet (opens from any "Pay now" CTA)

Bottom-sheet modal. Fields:
- Amount input with "NZ$" prefix, accepts decimals.
- Three preset chips: "1 instalment · $X", "2 instalments · $X", "Pay off · $balance". Selecting one fills the amount field.
- Pay-from radio cards: "Westpac •• 4421 · Direct debit · free" / "Visa •• 8821 · Card payment · $1.50 fee".
- Summary card: payment amount + remaining balance after.
- "Pay $X now" amber CTA, disabled when amount ≤ 0 or > balance.

Successful payment closes the sheet, toasts "Payment of $X scheduled".

### Paid off (tracking detail)

- **Page header** — "All done" eyebrow + "You paid off your loan 🎊" h1.
- **Hero card** — paid-green gradient. Eyebrow "Personal loan · TP-29481", "Paid in full" success pill. Title "Nicely done, Rafael.", subtitle with stats. Confetti (36 pieces). 4-cell stat grid: Repaid, On-time payments (4/4), Finished date, Days early.
- **Tier 2 unlock banner** — success-tone banner: "You've unlocked Tier 2. Next time, you'll qualify for a lower rate and instant approval."
- **Summary card** — Principal, Fees, Interest paid, Opened-Closed range, Total repaid.
- **CTA** — amber "Apply for next loan", then 2-column secondary: "Closure letter" / "Refer a friend".

## Interactions & Behavior

### Navigation
- Dashboard → Tracking detail via any in-state CTA (Track loan progress / Accept your offer / etc.).
- Tracking detail → Dashboard via back arrow in top bar (only shown when not on dashboard).
- Cross-state transitions:
  - Apply submit → `new` → `review`
  - Direct-debit authorisation success → `approved` → `active`
  - All transitions navigate user back to the dashboard view.

### Animations
- Screen transitions: `contentFade` keyframe, 0.25s ease-out, opacity .35→1 + translateY 4→0.
- Confetti: per-piece 1.6s cubic-bezier(.3,.7,.6,1) forwards, random delay 0–400ms, random translate-x ±120px, random rotate, falls 240px. **Render delayed 700ms after mount** so it doesn't fire on screenshot/server render.
- Stepper active dot: 2s infinite pulse on box-shadow.
- Pill "amber" tone dot: 1.8s infinite pulse (opacity + scale).
- Progress bar fill: width transitions 1s cubic-bezier(.4,0,.2,1).
- Buttons: translateY -1px on hover, amber box-shadow on hover.
- Action cards: translateY -1px + amber border + glow shadow on hover.
- Toast: slide up + fade, 0.25s cubic-bezier(.2,.9,.3,1.1), auto-dismisses in 2400ms.
- Modal: scrim fade 0.2s, sheet slide-up 0.25s.
- Dropzone: 0.15s color/background transition on drag-over.

### Form validation
- BSB regex: `^\d{2}-?\d{4}$` (e.g., "03-0518" or "030518").
- Account number: ≥6 digits after stripping non-digits.
- Direct-debit authorise step requires both consent checkboxes ticked.
- Approved accept gated on agreement checkbox.
- Payment amount must be > 0 and ≤ outstanding balance.

### File upload
- Accepts: PDF, CSV, images.
- Max 10 MB per file (enforce on the client even if backend re-validates).
- Per-file simulated progress in mockup (8–20% per 120ms tick) — replace with real progress in implementation.
- Allow remove (X button) on uploaded files. Uploading items can't be removed.

### Tweakable theme (live in the mockup, drop in real product)
- Brand palette swap: amber (`#f5a623`) / indigo (`#7c8bff`) / emerald (`#22c581`) / magenta (`#ec4899`). Each palette has accent, accent-2, accent-soft (light + dark variants).
- Dark mode toggle (`html[data-dark="true"]`).

Wire these as CSS custom properties from day one — themes ship cleanly later even if the MVP is amber + light only.

## State Management

A single `loanStatus` field on the user determines almost every view. Recommended Context (or Zustand/Jotai — whatever your project uses):

```ts
type LoanStatus = 'new' | 'review' | 'approved' | 'rejected' | 'active' | 'paid';

interface LoanContext {
  status: LoanStatus;
  loan: Loan | null;          // null when status === 'new'
  application: LoanApplication | null;  // present from 'review' onward
  // ...
}
```

State transitions happen on:
- Application submit (`new` → `review`)
- Backend decision (`review` → `approved` | `rejected`)
- Direct-debit setup success (`approved` → `active`)
- Final instalment paid (`active` → `paid`)
- User dismisses paid summary / reapplies (`paid` → `new`)

Direct-debit setup wizard is a self-contained 3-step machine inside its modal — manage with local component state (`step`, form fields, submitting, done).

Apply screen calculator is purely local state — `amount`, `purpose`. Submit hits the application endpoint.

In-review upload card manages two local lists (`uploadedDocs`, `uploadingDocs`) — replace simulated progress with real upload calls.

## Data Model

```ts
type LoanStatus = 'new' | 'review' | 'approved' | 'rejected' | 'active' | 'paid';

interface Loan {
  id: string;                    // e.g. "TP-29481"
  requested: number;             // What user asked for
  amount: number;                // What was approved (may be lower)
  fee: number;
  interestPercent: number;       // APR
  termWeeks: 8;                  // Fixed
  totalPayments: 4;              // Fixed
  instalmentEveryWeeks: 2;       // Fortnightly
  instalmentAmount: number;
  totalRepayable: number;
  applied: Date;
  firstPayment: Date;
  // Active state only:
  paidSoFar: number;
  paidPayments: number;
  nextPaymentDate: Date;
  // Paid state only:
  paidOnDate?: Date;
  // Rejected state only:
  rejectionReason?: string;
  rejectionRef?: string;
}

interface LoanApplication {
  loanId: string;
  status: LoanStatus;
  steps: ApplicationStep[];     // Submitted / Credit check / Decision / Disbursement
  documents: UploadedDoc[];
}

interface ApplicationStep {
  id: 'submitted' | 'credit-check' | 'decision' | 'disbursement';
  status: 'done' | 'active' | 'pending';
  completedAt?: Date;
  meta?: string;
}

interface Instalment {
  index: number;                 // 1..4
  dueDate: Date;
  amount: number;
  status: 'paid' | 'next' | 'upcoming' | 'overdue';
  paidAt?: Date;
  method?: 'direct-debit' | 'card' | 'bank-transfer';
}

interface DirectDebitMandate {
  bankName: string;
  bsb: string;                   // 03-0518 format
  accountNumber: string;
  accountHolderName: string;
  authorisedAt: Date;
}

interface UploadedDoc {
  id: string;
  name: string;
  size: number;                  // bytes
  status: 'uploading' | 'done' | 'error';
  progress?: number;             // 0-100 when uploading
  uploadedAt?: Date;
}
```

## Design Tokens

Extract these from the `:root` block in `Loan Tracking.html`. Define them as CSS custom properties (or your project's token system).

### Colors (light)

| Token | Hex |
|---|---|
| `--ink` | `#0c1620` |
| `--ink-2` | `#131f2c` |
| `--ink-3` | `#1d2a39` |
| `--accent` | `#f5a623` |
| `--accent-2` | `#f59412` |
| `--accent-soft` | `#fef4e0` |
| `--bg` | `#f6f7f9` |
| `--surface` | `#ffffff` |
| `--surface-2` | `#f3f4f6` |
| `--text` | `#0c1620` |
| `--muted` | `#6b7280` |
| `--muted-2` | `#9aa3af` |
| `--border` | `#e8eaee` |
| `--border-2` | `#eef0f3` |
| `--info` | `#2563eb` |
| `--info-soft` | `#e8efff` |
| `--success` | `#16a34a` |
| `--success-soft` | `#e3f6e9` |
| `--danger` | `#dc2626` |
| `--danger-soft` | `#fde7e7` |
| `--warn` | `#d97706` |
| `--warn-soft` | `#fdf0d9` |

### Colors (dark — `html[data-dark="true"]`)

| Token | Hex |
|---|---|
| `--ink` | `#050a10` |
| `--ink-2` | `#0a1218` |
| `--ink-3` | `#131e2a` |
| `--bg` | `#07101a` |
| `--surface` | `#111c28` |
| `--surface-2` | `#1a2533` |
| `--text` | `#f1f5f9` |
| `--muted` | `#94a3b8` |
| `--muted-2` | `#64748b` |
| `--border` | `#1f2c3b` |
| `--border-2` | `#1a2532` |
| `--accent-soft` | `#2a200d` |
| `--info-soft` | `#122244` |
| `--success-soft` | `#0e2a1a` |
| `--danger-soft` | `#3a1414` |
| `--warn-soft` | `#2a1d09` |

### Brand palette swap (themeable)

| Palette | accent | accent-2 | accent-soft (light) | accent-soft (dark) |
|---|---|---|---|---|
| amber (default) | `#f5a623` | `#f59412` | `#fef4e0` | `#2a200d` |
| indigo | `#7c8bff` | `#5b6bff` | `#eef0ff` | `#171c3a` |
| emerald | `#22c581` | `#16a36a` | `#e2f7ec` | `#0e2a1a` |
| magenta | `#ec4899` | `#db2777` | `#fde6f0` | `#3a1024` |

### Hero state gradient overlays

| State | background |
|---|---|
| review / active | `var(--ink)` (flat) |
| approved | `linear-gradient(135deg, #0c1620 0%, #15301f 100%)` |
| rejected | `linear-gradient(135deg, #0c1620 0%, #2a1414 100%)` |
| paid | `linear-gradient(135deg, #0c1620 0%, #143126 100%)` |
| new | `linear-gradient(135deg, #0c1620 0%, #2a2010 100%)` |

### Typography

- Font family: **Inter**, weights 400 / 500 / 600 / 700 / 800.
- Monospace (rare, for numeric runs only): **JetBrains Mono** 400 / 500. Or use `font-variant-numeric: tabular-nums` instead.
- Featured CSS settings: `font-feature-settings: 'cv11', 'ss01', 'ss03'`.

| Use | Size | Weight | Tracking | Line-height |
|---|---|---|---|---|
| Page H1 | 26px | 700 | -0.02em | 1.15 |
| Hero title | 20px | 700 | -0.01em | — |
| Hero subtitle | 14.5px | 400 | — | 1.5 |
| Section heading | 12px | 600 | 0.08em | — (uppercase) |
| Eyebrow | 12px | 600 | 0.08em | — (uppercase) |
| Balance amount | 40px | 700 | -0.03em | 1.05 |
| Balance currency prefix | 18px | 600 | — | (vertical-align: 6px) |
| Card title | 17px | 700 | -0.01em | — |
| Action title | 14.5px | 600 | — | — |
| Body small | 13.5px | 400 | — | 1.5 |
| Meta | 12.5px | 400 | — | — |
| Pill | 11.5px | 600 | 0.02em | — |
| Stat label | 11.5px | 400 | 0.02em | — |
| Stat value | 18px | 700 | -0.01em | — |

### Spacing & radii

| Token | Value |
|---|---|
| `--radius-sm` | 10px |
| `--radius` | 14px |
| `--radius-lg` | 20px |
| Card padding | 18–20px |
| Hero padding | 24px |
| Page side padding | 20px (mobile 16px) |
| Page top padding | 24px (mobile 20px) |
| Page bottom padding | 80px (mobile 60px) |
| Content max-width | 540px |

### Shadows

| Token | Value |
|---|---|
| `--shadow-sm` | `0 1px 2px rgba(15,23,32,.04), 0 1px 0 rgba(15,23,32,.02)` |
| `--shadow` | `0 1px 2px rgba(15,23,32,.04), 0 8px 24px rgba(15,23,32,.06)` |
| `--shadow-lg` | `0 4px 12px rgba(15,23,32,.06), 0 24px 48px rgba(15,23,32,.12)` |

Dark mode shadows are stronger blacks — see the `html[data-dark="true"]` block.

## Assets

- **Fonts** — Inter and JetBrains Mono loaded from Google Fonts. Self-host in production via `next/font` to avoid the CDN dependency.
- **Icons** — small custom Lucide-style stroke icon set inlined as SVG in the mockup. Replace with **lucide-react** in implementation (every icon used has a Lucide equivalent):
  - `IconArrowLeft` → ArrowLeft, `IconArrowRight` → ArrowRight, `IconMenu` → Menu, `IconX` → X, `IconCheck` → Check, `IconCheckCircle` → CheckCircle2, `IconInfo` → Info, `IconWarning` → AlertTriangle, `IconShield` → ShieldCheck, `IconHelpCircle` → HelpCircle, `IconCard` → CreditCard, `IconBank` → Landmark, `IconWallet` → Wallet, `IconReceipt` → Receipt, `IconCalendar` → Calendar, `IconHistory` → History, `IconClock` → Clock, `IconSparkle` → Sparkles, `IconChevR` → ChevronRight, `IconChevD` → ChevronDown, `IconDownload` → Download, `IconRefresh` → RefreshCw, `IconBell` → Bell, `IconUser` → User, `IconChat` → MessageCircle, `IconShare` → Share2.
- **Stroke width** for all icons: 1.75. Round line caps + joins.
- **Confetti** — pure CSS keyframe animation, no asset. See `.confetti` rules.
- **Logo** — TerePay wordmark is text-only (Inter 800, amber). No image asset.

## Backend integration

The mockup is fully client-side with mocked data. For each interaction below, add a service function in `lib/api/loan/` (or your project's API conventions) and flag with a `// TODO: backend` if no endpoint exists yet.

| Action | Suggested endpoint | Method | Payload | Response |
|---|---|---|---|---|
| Submit loan application | `/api/loans/applications` | POST | `{ amount, purpose }` | `{ applicationId, status: 'review' }` |
| Upload bank statement | `/api/loans/applications/:id/documents` | POST (multipart) | file | `{ docId, name, size, uploadedAt }` |
| Remove uploaded document | `/api/loans/applications/:id/documents/:docId` | DELETE | — | `{ ok: true }` |
| Submit documents (finalise) | `/api/loans/applications/:id/documents/submit` | POST | — | `{ ok: true }` |
| Get application status | `/api/loans/applications/:id` | GET | — | `LoanApplication` |
| Accept offer & set up DD | `/api/loans/:id/accept` | POST | `DirectDebitMandate` | `{ status: 'active', loan }` |
| Decline offer | `/api/loans/:id/decline` | POST | — | `{ ok: true }` |
| Get active loan | `/api/loans/:id` | GET | — | `Loan` |
| Make a payment | `/api/loans/:id/payments` | POST | `{ amount, methodId }` | `{ paymentId, scheduledFor, newBalance }` |
| Update auto-pay setting | `/api/loans/:id/auto-pay` | PATCH | `{ enabled }` | `{ ok: true }` |
| Update reminders setting | `/api/loans/:id/reminders` | PATCH | `{ enabled }` | `{ ok: true }` |
| Pay off early | `/api/loans/:id/payoff` | POST | `{ methodId }` | `{ paymentId, paidOff: true }` |
| Download closure letter | `/api/loans/:id/closure-letter` | GET | — | binary PDF |
| Download statement | `/api/loans/:id/statement` | GET | — | binary PDF |

Stub each as a function that waits ~600–800ms and returns the success shape. Tag each with the real endpoint spec.

## Out of scope

- Real KYC / identity verification (no NZ DIA integration)
- Real credit-check provider integration (no Centrix / Equifax / Illion integration)
- Real direct-debit gateway (no bank-side DD authority API)
- Real document OCR or storage (stub file upload with progress + opaque IDs)
- Push notifications / SMS sending (assume an SMS service exists)
- Auth / login (assume user is already authenticated)
- Admin / lender-facing screens

## Files in this bundle

- `README.md` — this document (start here)
- `Loan Tracking.html` — the canonical hi-fi prototype; open in a browser, use the Tweaks panel to switch states and views

## Implementation suggestions

- **Routing.** Two Next.js App Router segments: `/loan` (dashboard) and `/loan/progress` (detail). Use a shared layout for the top bar.
- **Server vs client.** Make the page components server components that fetch loan state, and lift interactive bits (apply calculator, modals, toggles, upload) into client components.
- **Forms.** Use your existing form library (React Hook Form / Conform / native). Keep validation rules in sync with the regexes above.
- **File upload.** Use your existing upload primitive if you have one. Otherwise: `<input type="file" multiple accept=".pdf,.csv,image/*">` + a manual `fetch` with `XMLHttpRequest` for progress events.
- **Animation.** `framer-motion` for state transitions if not already in the project; CSS keyframes are also fine — match the durations and easings listed under Interactions.
- **Theming.** Define light/dark + palette swaps as CSS custom properties at the root. Don't bake colors into component code.
- **Match the mockup before improvising.** If the mockup feels wrong, raise it as a question rather than diverging.

