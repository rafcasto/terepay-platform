# Onboarding UX Requirements — TerePay Customer Signup

**Document version:** 1.0  
**Date:** 2026-03-11  
**Author:** Product / UX  
**Status:** Approved for implementation

---

## 1. Overview

This document defines the UX requirements and functional specification for the TerePay new-customer onboarding journey. The goal is to replace the existing single-page signup form with a guided, multi-step wizard that reduces cognitive load, builds trust incrementally, and mirrors best-in-class fintech onboarding flows.

The redesign also covers the login page, which adopts the same split-screen visual layout for brand consistency.

---

## 2. Business Goals

| Goal | Metric |
|---|---|
| Reduce form abandonment | Target < 20 % drop-off before Step 3 |
| Increase email deliverability confidence | Spam-folder guidance reduces missed verifications |
| Establish brand identity from first touch | Consistent navy/gold TerePay brand on every step |
| Lay groundwork for future identity checks | Phone + email collected at signup enables future KYC flows |

---

## 3. Design Language

### 3.1 Layout — Split Screen

Every auth page (signup and login) uses a **two-panel split-screen** layout:

| Panel | Breakpoint behaviour | Content |
|---|---|---|
| **Left — Brand Panel** | Hidden on mobile (`< md`), 42% width on desktop | Dark navy (`#0D1B2A`) background, abstract gold geometric SVG illustration, rotating value-proposition slides, TerePay wordmark |
| **Right — Form Panel** | Full width on mobile, 58% on desktop | White background, form content, progress/step indicators |

### 3.2 Colour Tokens

| Token | Hex | Usage |
|---|---|---|
| `brand-primary` | `#F5A523` | CTAs, active indicators, focus rings, links |
| `brand-primary-dark` | `#E08B00` | CTA hover state |
| `brand-navy` | `#0D1B2A` | Left panel background, headings |
| `brand-light` | `#FEF7E9` | Subtle gold-tinted backgrounds |
| `text-primary` | `#111827` | Form labels, headings |
| `text-secondary` | `#6B7280` | Helper text, placeholders |
| `error` | `#DC2626` | Inline validation errors |
| `success` | `#16A34A` | Password rule satisfied, verified icon |

### 3.3 Typography

- **Headings:** `font-bold` or `font-extrabold`, dark navy on left, dark gray on right
- **Body:** `text-sm`, gray-600 (`#4B5563`)
- **Links:** `text-[#F5A523]` with underline on hover

### 3.4 Interaction Patterns

- All inputs use `focus:ring-2 focus:ring-[#F5A523]`
- Disabled buttons are `opacity-50 cursor-not-allowed`
- Error states show a red border + inline message below the field
- Success states (OTP verified, password rule met) show a green check icon
- All transitions use `transition-all duration-200`

---

## 4. Signup Flow — Multi-Step Wizard

### 4.1 Progress Indicator

A horizontal three-segment progress bar sits at the top of the right panel.

```
[███████████] [███████████] [░░░░░░░░░░░]
   Step 1         Step 2        Step 3
```

- Completed segments: filled `#F5A523`
- Active segment: filled `#F5A523`
- Upcoming segments: `#E5E7EB` (gray-200)
- No step numbers or labels shown — the bar alone communicates progress
- Bar animates left-to-right on step advance

### 4.2 Step 1 — Personal Information

**Heading:** *(none — form is self-evident)*  
**Subheading:** `"Create your TerePay account"`

#### Fields

| Field | Type | Validation | Notes |
|---|---|---|---|
| First name | Text | Required, 1–50 chars | `autoComplete="given-name"` |
| Last name | Text | Required, 1–50 chars | `autoComplete="family-name"` |
| Email address | Email | Required, valid email format | `autoComplete="email"` |
| Phone number | Tel | Required, 7–20 digits | Includes country-code dial-code prefix selector |

#### Phone input

The phone field is a compound component:
- A `<select>` dropdown showing a flag emoji + dial code (e.g. 🇳🇿 +64)
- A `<input type="tel">` for the local number portion
- Dial code and number are joined before validation / storage: `+64 027XXXXXXX`
- Pre-selected default: NZ (+64). Common options: NZ, AU, US, GB, PH.

#### Actions

- **Continue** (primary button, full width) — validates all fields; on success calls `POST /api/auth/send-otp` and advances to Step 2
- **"Already have an account? Sign In"** — link to `/auth/login`

#### API call on Continue

```
POST /api/auth/send-otp
Body: { email: string }
Success: advances to Step 2; stores step-1 data in React state
Error: shows inline error message below the email field
```

---

### 4.3 Step 2 — Email Verification

**Heading:** `"Verify your email"`  
**Subheading:** `"We've sent a 6-digit code to {email}"`

#### OTP Input

- Six individual `<input maxLength={1}>` boxes arranged horizontally
- Auto-focus advances to the next box on digit entry
- Backspace moves focus to the previous box
- Paste support: distributes pasted 6-digit string across boxes
- Numeric input only (`inputMode="numeric" pattern="[0-9]*"`)
- Active box border: `border-[#F5A523]`

#### Spam Notice (important UX element)

> 📬 **Can't find the email?** Check your spam or junk folder — verification emails sometimes get filtered. If you still can't find it, use the button below to resend.

- Displayed below the OTP boxes at all times
- Background: `#FEF7E9` (brand-light), left border `#F5A523`
- Icon: mailbox or envelope emoji / Heroicon

#### Resend Button

- `"Resend code"` — disabled with countdown `"Resend in {n}s"` for 60 seconds after initial send or resend
- Calls `POST /api/auth/send-otp` again on click
- Shown as a subtle text link, not a full button

#### Actions

- **Verify** (primary, full width) — submits OTP; calls `POST /api/auth/verify-otp`; on success stores `verificationToken` in React state and advances to Step 3
- **Back** (ghost, half width) — returns to Step 1; OTP inputs reset

#### API call on Verify

```
POST /api/auth/verify-otp
Body: { email: string, code: string }
Success: { verificationToken: string } — advance to Step 3
Error 400 (expired): "Your code has expired. Please request a new one."
Error 400 (invalid): "Incorrect code. {n} attempts remaining."
Error 429: "Too many attempts. Please request a new code."
```

---

### 4.4 Step 3 — Password & Terms

**Heading:** `"You're almost done!"`

#### Fields

| Field | Type | Validation |
|---|---|---|
| Create password | Password | Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character |
| Re-enter password | Password | Must match password field |
| Terms & Privacy checkbox | Checkbox | Must be checked to enable Create button |

#### Password Strength Indicator

Below the password field, show five real-time requirement badges:

```
✓ 8 characters   ✓ 1 upper case   ✓ 1 lower case   ✓ 1 number   ✗ special character
```

- Unsatisfied: `text-gray-400` with unchecked circle icon
- Satisfied: `text-green-600` with filled check icon
- Evaluated on every keystroke (no debounce needed)

#### Terms Checkbox

```
☐ I agree to the [Terms of Service] and [Privacy Policy]
```

- Links open in a new tab
- `Create Account` button is disabled (`opacity-50`) until this is checked

#### Actions

- **Create Account** (primary, full width) — calls `POST /api/auth/signup`
- **Back** (ghost, half width) — returns to Step 2
- **"Do you have a referral code?"** — collapsible text input below the terms line (optional, lower priority)

#### API call on Create Account

```
POST /api/auth/signup
Body: {
  firstName, lastName, email, phone,
  password,
  verificationToken   ← from Step 2
}
Success (201): auto-login → send Firebase email-verification link → redirect /applicant/verify-email
Error 409 (email exists): surface error, let user go back to Step 1 and change email
Error 400: surface appropriate error
```

---

## 5. Login Page Redesign

The login page adopts the same split-screen layout as signup.

**Left panel:** Identical to signup — navy background, illustration, TerePay brand, value-prop slides.

**Right panel:**

- Heading: `"Welcome back"`  
- Subheading: `"Sign in to your account"`
- Email field
- Password field (with "Forgot password?" link right-aligned)
- Sign In button (full width, primary)
- `"Don't have an account? Sign up"` link at the bottom

No step indicator on the login page.

---

## 6. Left Brand Panel — Content

### Rotating Slides (auto-advance every 4 seconds)

| Slide | Heading | Body |
|---|---|---|
| 1 | "Getting funded starts here." | "Apply in minutes and receive a lending decision within 24 hours." |
| 2 | "Secure by design." | "End-to-end encryption and strict access controls protect your data at every step." |
| 3 | "Transparent terms." | "Clear repayment schedules. No hidden fees. Ever." |

### Illustration

- Abstract node-graph SVG in gold (`#F5A523`) on navy — communicates connectivity / networking / finance tech
- Opacity ~75% so it reads as a background element
- Responsive: smaller on tablet, full size on desktop

### Slide indicators

- Three dots at the bottom of the panel
- Active dot: `#F5A523` pill shape (wider)
- Inactive: `rgba(255,255,255,0.4)` circle

---

## 7. API Specification

### 7.1 `POST /api/auth/send-otp`

**Purpose:** Generate and deliver a 6-digit OTP to the given email address.

**Request body:**
```json
{ "email": "user@example.com" }
```

**Rate limiting:** 3 requests per email address per 15 minutes (uses Upstash Redis if available, falls back to Firestore-based counter).

**Server logic:**
1. Validate email format
2. Check rate limit
3. Generate `crypto.randomInt(100000, 999999)` → pad to 6 digits
4. Store in Firestore `pendingOtps/{emailHash}`:
   ```json
   {
     "email": "user@example.com",
     "code": "482937",
     "expiresAt": 1741000800000,
     "attempts": 0,
     "createdAt": "<Timestamp>"
   }
   ```
5. Send email via configured email transport (see §8)
6. In `NODE_ENV=development`: also return `{ code }` in response for local testing

**Response:**
```json
{ "success": true }
```
OR in development:
```json
{ "success": true, "code": "482937" }
```

---

### 7.2 `POST /api/auth/verify-otp`

**Purpose:** Validate a submitted OTP and return a short-lived verification token.

**Request body:**
```json
{ "email": "user@example.com", "code": "482937" }
```

**Server logic:**
1. Look up `pendingOtps/{emailHash}`
2. Check `expiresAt > Date.now()`; if expired → delete record → return 400
3. Increment `attempts`; if `attempts > 5` → delete record → return 429
4. Compare codes; if mismatch → persist incremented attempts → return 400 with remaining attempts
5. On match:
   - Delete `pendingOtps/{emailHash}`
   - Generate `crypto.randomUUID()` → `verificationToken`
   - Store in Firestore `verifiedTokens/{verificationToken}`:
     ```json
     { "email": "user@example.com", "expiresAt": "<+15 minutes>" }
     ```
   - Return `{ verificationToken }`

**Response:**
```json
{ "verificationToken": "uuid-v4" }
```

**Errors:**
- `400 OTP_EXPIRED` — code has expired
- `400 OTP_INVALID` — wrong code, returns `attemptsRemaining`
- `429 RATE_LIMITED` — too many failed attempts

---

### 7.3 `POST /api/auth/signup` (updated)

New fields accepted:
- `phone` — optional string (stored in Firestore user document)
- `verificationToken` — required UUID; verified against `verifiedTokens` collection before proceeding

On success: verification token document is deleted from Firestore.

---

## 8. Email Service Integration

> **⚠️ Action required before production deployment**

The OTP email sending requires a transactional email service. The send-otp route contains a placeholder; replace it with one of the following:

### Recommended: Resend

```bash
npm install resend
```

```ts
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'TerePay <noreply@terepay.com>',
  to: email,
  subject: 'Your TerePay verification code',
  html: `<p>Your verification code is: <strong>${code}</strong><br/>This code expires in 10 minutes.</p>`,
});
```

### Alternative: SendGrid / Nodemailer / Postmark

Any SMTP-compatible transactional service will work. Store credentials in `.env.local`:

```
EMAIL_SERVICE_API_KEY=...
EMAIL_FROM=noreply@terepay.com
```

### Development mode

When `NODE_ENV=development`, the OTP code is returned directly in the API response body so no email service is needed during local development. The UI displays the code in a yellow dev-only banner.

---

## 9. Accessibility Requirements

| Requirement | Implementation |
|---|---|
| WCAG 2.1 AA contrast | All text passes 4.5:1 against backgrounds |
| Keyboard navigation | Tab order follows visual order; OTP auto-advance preserves focus |
| Screen reader labels | All inputs have `<label htmlFor>` or `aria-label`; OTP boxes: `aria-label="Digit {n} of 6"` |
| Error announcement | Error messages use `role="alert"` or are associated via `aria-describedby` |
| Focus management | On step advance, focus moves to the step heading |

---

## 10. Security Considerations

| Risk | Mitigation |
|---|---|
| OTP brute-force | Max 5 attempts; account locked after; server-side enforcement |
| OTP replay | Token deleted immediately after first successful use |
| OTP enumeration | Response time is constant regardless of email existence |
| Bypass | `verificationToken` checked server-side before account creation |
| Injection | All inputs validated with Zod; parameterised Firestore queries |
| CSRF | Next.js API routes are same-origin; SameSite cookie on session |

---

## 11. Mobile Behaviour

- On `< md` breakpoints: left panel hides; form takes full width
- Phone input dial-code select uses native `<select>` for mobile compatibility
- OTP boxes are large enough for touch (`min-width: 44px`, `height: 52px`)
- Progress bar remains visible on mobile at the top of the form area

---

## 12. Future Enhancements (Out of scope for v1)

| Enhancement | Notes |
|---|---|
| Phone OTP (SMS) | Firebase Phone Auth or Twilio; replace email OTP in Step 2 |
| Social sign-in | Google / Apple OAuth via Firebase providers |
| Address autocomplete | Google Places API (already wired in the codebase) |
| KYC document upload | Separate onboarding module post-signup |
| Referral code system | Track referrer, apply discount; UI placeholder exists in Step 3 |
| Password manager integration | Already supported: correct `autoComplete` attributes throughout |
