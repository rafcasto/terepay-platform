# TerePay Loan Application Form — Implementation Plan

## Overview

Replace the existing simple two-section apply form with a full **8-step wizard** that mirrors
the official TerePay paper application form. The wizard is mobile-first, validates each step
before advancing, and saves as _draft_ in Firestore on final submission.

---

## Loan Terms (displayed in the form)

| Term | Value |
|---|---|
| Period | 8 weeks (56 days) |
| Payments | 4 equal fortnightly payments |
| APR | 49% |
| Interest | 4.7% for 8 weeks |
| Establishment fee (new) | $50 |
| Application fee (repeat) | $20 |
| Currency | NZD |

---

## Architecture

### Pattern — Multi-Step Wizard with `FormProvider`

- **Single `useForm` instance** in `apply/page.tsx` wrapping the entire schema.
- **`FormProvider`** makes form context available to all step sub-components via `useFormContext`.
- `shouldUnregister: false` (RHF default) keeps values of hidden steps in memory when navigating.
- `trigger(stepFieldKeys)` validates only the current step before advancing.
- Footer navigation: **Back** / **Next** (or **Submit** on step 8).

### UX Decisions

- **Mobile-first** single-column layout; 2-col grid on `sm+` for paired fields.
- Sticky top progress stepper (step number + label).
- Compact error messages inline below each field.
- Currency inputs display `NZD $` prefix.
- Expense tables show running totals (derived, not registered fields).
- Declarations step uses check-all pattern plus individual checkboxes.
- References step is optional — clearly labelled as such.

---

## File Structure

```
src/app/applicant/apply/
  page.tsx                          ← Multi-step wizard controller (replaced)
  _components/
    FormProgress.tsx                ← Sticky stepper UI
    Step1PersonalInfo.tsx
    Step2Employment.tsx
    Step3LivingExpenses.tsx
    Step4ExistingDebts.tsx
    Step5LoanRequest.tsx
    Step6BankDetails.tsx
    Step7References.tsx
    Step8Declarations.tsx
```

---

## Steps and Validated Fields

| # | Title | Schema key | Required? |
|---|---|---|---|
| 1 | Personal Information | `personalInfo` | Yes |
| 2 | Employment & Income | `employment` | Yes |
| 3 | Living Expenses | `livingExpenses` | Yes (defaults 0) |
| 4 | Existing Debts | `existingDebts` | Yes (defaults 0) |
| 5 | Loan Request | `loanRequest` | Yes |
| 6 | Bank Account & Repayment | `bankDetails` | Yes |
| 7 | References | `references` | Optional |
| 8 | Declarations & Consent | `declarations` | All boxes required |

---

## Schema Changes (`src/lib/validation/schemas.ts`)

New export: **`terepayApplicationSchema`** and **`TerepayApplicationInput`** type.

Key sections:
- `personalInfo` — personal details, visa, household
- `employment` — employer details + fortnightly income breakdown
- `livingExpenses` — non-discretionary, discretionary, subscriptions, BNPL (all default 0)
- `existingDebts` — typed debt table + 3 open-ended loan rows
- `loanRequest` — amount, purpose, PEP flag, remittance
- `bankDetails` — bank name/account/payment method
- `references` — two optional reference entries
- `declarations` — nine boolean fields all required `true`

---

## Type Changes (`src/types/application.ts`)

New interface **`TerePayApplicationData`** added alongside existing `LoanApplication`.
The Firestore document stores all sections as top-level fields for easy querying.

---

## API Changes (`src/app/api/applications/route.ts`)

The `POST /api/applications` endpoint:
1. Parses body with `terepayApplicationSchema`.
2. Maps new fields to existing `loanDetails` / `financialInformation` shapes (for lender views).
3. Stores all new sections (`personalInfo`, `employment`, `livingExpenses`, etc.) on the document.
4. Sets `currency: 'NZD'` and `requestedTerm: 2` (2 fortnights = 4 payments) by default.

---

## Security Considerations

- Sensitive fields (`dateOfBirth`, `bankDetails.accountNumber`) stored as-is in Firestore.
  Future: encrypt via existing `src/lib/encryption/crypto.ts` before persisting.
- Rate-limiting and auth middleware unchanged.
- PEP flag captured and stored for manual AML review.
- All declaration consents persisted with submission timestamp.
