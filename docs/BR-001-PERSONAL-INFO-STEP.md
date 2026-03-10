# BR-001 — Loan Application: Step 1 Personal Information
## Business Requirements Specification

**Document ID:** BR-001  
**Version:** 1.0  
**Date:** March 2026  
**Prepared by:** Business Analysis — TerePay Neophile Limited  
**Status:** Draft — Awaiting Review  
**Related Documents:** TerePay_LMS_Requirements.md · LOAN_APPLICATION_FORM_PLAN.md · DATA_STRUCTURE.md

---

## Table of Contents

1. [Overview](#1-overview)
2. [Business Drivers](#2-business-drivers)
3. [Scope](#3-scope)
4. [User Stories](#4-user-stories)
5. [Functional Requirements](#5-functional-requirements)
   - 5.1 [BR-001-01 — Pre-Population of Known Personal Details](#51-br-001-01--pre-population-of-known-personal-details)
   - 5.2 [BR-001-02 — Address Autocomplete via Google Places API](#52-br-001-02--address-autocomplete-via-google-places-api)
   - 5.3 [BR-001-03 — Manual Address Entry Fallback](#53-br-001-03--manual-address-entry-fallback)
   - 5.4 [BR-001-04 — Profile Persistence & Repeat Loan Pre-Population](#54-br-001-04--profile-persistence--repeat-loan-pre-population)
6. [Field Inventory & Behaviour Matrix](#6-field-inventory--behaviour-matrix)
7. [UX & Interaction Design](#7-ux--interaction-design)
8. [Data Model Impact](#8-data-model-impact)
9. [Integration Requirements](#9-integration-requirements)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Acceptance Criteria](#11-acceptance-criteria)
12. [Out of Scope](#12-out-of-scope)

---

## 1. Overview

Step 1 of the loan application wizard collects an applicant's core personal details. This document specifies how that step should be enhanced to:

1. **Reduce data re-entry** by pre-populating fields the system already holds from the applicant's account registration or previous loan application.
2. **Improve address accuracy** by integrating Google Places Autocomplete, allowing applicants to search and select a verified New Zealand address rather than typing every field manually.
3. **Persist personal details to the applicant's profile** so that repeat borrowers experience a frictionless, largely pre-filled application journey.

---

## 2. Business Drivers

| Driver | Detail |
|--------|--------|
| **Applicant Experience** | Requiring applicants to re-type information TerePay already holds increases friction and abandonment rates. |
| **Data Accuracy** | Free-text address entry introduces typos and non-standard formats that complicate lender review. Google Places returns structured, verified addresses. |
| **CCCFA Compliance** | Accurate residential address is a required identity verification data point. Pre-verified addresses reduce compliance risk. |
| **Operational Efficiency** | Fewer data-quality corrections post-submission reduces manual lender effort during document review. |
| **Repeat Borrower Delight** | Pre-filling a returning applicant's details signals a high-quality digital product and increases loan completion rates. |

---

## 3. Scope

| In Scope | Out of Scope |
|----------|------|
| Step 1 (Personal Information) of the loan application wizard | All other application steps (2–8) |
| Pre-population from Firebase Auth and Applicant Profile Firestore document | Automated identity verification (ID&V) |
| Google Places Autocomplete integration (NZ addresses) | International address resolution |
| Manual address entry fallback | Lender-side address editing |
| Saving Step 1 data back to the applicant profile on submission | Real-time address validation against third-party registries |

---

## 4. User Stories

### US-001 — Pre-Population of Known Fields
**As an** applicant starting a loan application,  
**I want** my first name, last name, and email address to be automatically filled in,  
**So that** I do not have to re-type information I provided when I registered.

**Acceptance:** Fields are pre-filled on page load. The applicant may edit them if needed.

---

### US-002 — Address Search
**As an** applicant completing Step 1,  
**I want** to type part of my street address and select it from a dropdown of suggestions,  
**So that** I get a correctly formatted, verified address without typing every field individually.

**Acceptance:** Typing ≥ 3 characters in the address search field triggers autocomplete suggestions. Selecting a suggestion populates all address sub-fields (street, suburb, city, postcode) automatically.

---

### US-003 — Manual Address Fallback
**As an** applicant whose address does not appear in the autocomplete results,  
**I want** to enter my address manually,  
**So that** I am not blocked from completing the application.

**Acceptance:** A clearly labelled link/button — "I can't find my address, enter manually" — switches the address field into manual entry mode with individual text inputs visible.

---

### US-004 — Profile Persistence
**As an** applicant who has previously saved or submitted a loan application,  
**I want** my personal details to be pre-filled on any new application,  
**So that** I only need to verify or update my information rather than re-entering it from scratch.

**Acceptance:** When a returning applicant opens a new application, Step 1 fields are populated from the most recently persisted profile data. The applicant can update any field before submitting.

---

### US-005 — Profile Update on Submission
**As an** applicant,  
**I want** the address and personal details I enter for a loan to be saved as my profile defaults,  
**So that** any future application automatically reflects my current details.

**Acceptance:** On successful application submission (status transitions to `pending_review`), the system writes the Step 1 personal information back to the applicant's profile document in Firestore.

---

## 5. Functional Requirements

### 5.1 BR-001-01 — Pre-Population of Known Personal Details

#### Description
When an authenticated applicant loads Step 1, the form fields listed in the table below must be pre-populated from data the system already holds. This data comes from two sources, checked in priority order:

| Priority | Source | Location in Firestore | Fields Provided |
|----------|--------|-----------------------|-----------------|
| 1 (highest) | Applicant Profile | `users/{uid}/applicantProfile/profile` | phone, dateOfBirth, address, suburb, city, postCode, housingStatus, yearsAtAddress |
| 2 | User Account | `users/{uid}` | firstName, lastName, email |

If a field exists in the Applicant Profile it takes precedence (it reflects the most recently confirmed value). If the Applicant Profile document does not yet exist (first-ever application), fields fall back to the User Account document.

#### Rules

| Rule ID | Rule |
|---------|------|
| PREP-01 | Fields are pre-populated client-side on component mount. |
| PREP-02 | All pre-populated fields remain fully editable by the applicant. No field is read-only. |
| PREP-03 | If a pre-populated value fails the form's validation rule (e.g., email address is malformed), the field is still displayed but marked as invalid, prompting the applicant to correct it before advancing. |
| PREP-04 | Pre-population must not block or delay the rendering of the form. Data is fetched via the existing `/api/auth/me` session endpoint and the applicant profile API. Loading state must be indicated with a skeleton or spinner while data resolves. |
| PREP-05 | Email address sourced from Firebase Auth is pre-filled but the applicant may update it within the form. The updated email is stored only in the application, not propagated back to the Firebase Auth account (a separate profile-update flow governs that). |

---

### 5.2 BR-001-02 — Address Autocomplete via Google Places API

#### Description
The residential address field is replaced with a **smart address search** component that queries the Google Places Autocomplete API. The component should:

1. Render a single search input labelled **"Start typing your address…"**.
2. When the user types ≥ 3 characters, display a dropdown of matching address suggestions returned by the API (restricted to New Zealand).
3. When the user selects a suggestion, automatically parse and populate the individual address sub-fields.
4. Allow the user to clear the selection and search again.

#### Autocomplete Behaviour

| Trigger | Behaviour |
|---------|-----------|
| User types < 3 characters | No API call, no dropdown shown |
| User types ≥ 3 characters | Debounced API call (300 ms). Dropdown shows up to 5 suggestions. |
| User selects a suggestion | Google Place Details API call retrieves full address components. All sub-fields auto-populated (see mapping table below). Search input shows the formatted full address. |
| User clears the input | All address sub-fields are cleared. Dropdown is hidden. |
| API returns no results | Dropdown shows a "No results found" message and a link to enter the address manually (see BR-001-03). |
| API call fails / times out | Silent graceful fallback: dropdown is hidden, a non-blocking inline message appears: "Address lookup unavailable — please enter your address manually." Manual entry mode is activated automatically. |

#### Address Component Mapping (Google → Form Fields)

| Google Place Component | `address_components` type(s) | Mapped Form Field |
|-----------------------|-------------------------------|-------------------|
| Street number + route | `street_number`, `route` | `personalInfo.address` (e.g., "123 Queen Street") |
| Suburb / locality | `sublocality`, `locality` | `personalInfo.suburb` |
| City | `locality`, `postal_town` | `personalInfo.city` |
| Post code | `postal_code` | `personalInfo.postCode` |
| Country | `country` | `personalInfo.country` (always "New Zealand" for NZ-restricted queries) |

> **Note:** Google's Place Details response structure varies. The mapping logic must handle missing components gracefully — if a component is absent, the corresponding field remains empty and the applicant fills it in manually.

#### Geographic Restriction
The API call must be made with:
- `componentRestrictions: { country: 'nz' }` — limits results to New Zealand addresses only.
- `types: ['address']` — returns street-level addresses, not businesses or points of interest.

---

### 5.3 BR-001-03 — Manual Address Entry Fallback

#### Description
If the applicant cannot find their address via autocomplete, they must be able to enter all address fields manually. This ensures no applicant is blocked from completing the application due to their address not being indexed in Google Places (e.g., newly built homes, rural properties, unit/flat addresses with non-standard formats).

#### Behaviour

| Rule ID | Rule |
|---------|------|
| MAN-01 | A link or button labelled **"Can't find your address? Enter manually"** is displayed beneath the address search input at all times. |
| MAN-02 | Clicking the link/button switches the address section to **manual entry mode**: the search input is hidden and individual text inputs for `address`, `suburb`, `city`, and `postCode` appear. |
| MAN-03 | In manual entry mode, a link labelled **"Search for address instead"** is shown, allowing the applicant to revert to the autocomplete search. Switching back clears all manually entered address fields. |
| MAN-04 | Manual entry mode is **automatically activated** when the Google Places API is unavailable (see BR-001-02 failure behaviour). |
| MAN-05 | Manual entry mode state is not persisted — it resets to autocomplete mode on page reload. |
| MAN-06 | All address sub-fields have the same validation rules regardless of entry mode (autocomplete or manual). |

---

### 5.4 BR-001-04 — Profile Persistence & Repeat Loan Pre-Population

#### Description
Personal information entered in Step 1 must be stored in the applicant's profile so future loan applications can be pre-filled. This turns the applicant profile into a living record of the applicant's most recently confirmed personal details.

#### Write Behaviour (Profile Save)

The system writes Step 1 data back to the applicant profile document (`users/{uid}/applicantProfile/profile`) at **two trigger points**:

| Trigger | Action |
|---------|--------|
| Application successfully submitted (status → `pending_review`) | Full Step 1 fields written to profile. This is the primary save trigger. |
| Applicant explicitly clicks **"Save & Continue Later"** (draft save) | Step 1 fields written to profile as a draft snapshot. |

Fields written from Step 1 to the applicant profile:

| Step 1 Field | Profile Field | Notes |
|---|---|---|
| `personalInfo.firstName` | `users/{uid}.firstName` | Written to the top-level user document. |
| `personalInfo.lastName` | `users/{uid}.lastName` | Written to the top-level user document. |
| `personalInfo.phone` | `applicantProfile.phone` | |
| `personalInfo.dateOfBirth` | `applicantProfile.dateOfBirth` | 🔒 Encrypted before write. |
| `personalInfo.address` | `applicantProfile.address` | |
| `personalInfo.suburb` | `applicantProfile.suburb` | New field — see §8 Data Model Impact. |
| `personalInfo.city` | `applicantProfile.city` | |
| `personalInfo.postCode` | `applicantProfile.zipCode` | |
| `personalInfo.country` | `applicantProfile.country` | |
| `personalInfo.housingStatus` | `applicantProfile.housingStatus` | |
| `personalInfo.yearsAtAddress` (derived from months) | `applicantProfile.yearsAtAddress` | |

> **Email is not written to the profile.** Email address changes are handled by a dedicated profile management flow and must not be silently overwritten by the application form.

#### Read Behaviour (Pre-Population for New Applications)

When an applicant starts a new application:

1. The system reads `users/{uid}` and `users/{uid}/applicantProfile/profile` in parallel.
2. Both documents are merged (profile takes precedence over user document for overlapping fields).
3. The merged data is used to pre-populate Step 1 form fields before the form is rendered to the applicant.
4. If the Applicant Profile document does not exist (first-ever application), only the User Account fields (`firstName`, `lastName`, `email`) are pre-populated and all other fields are empty.

#### Isolation Rule
Pre-population copies data **into the form state** at load time. Editing a field in the form does **not** update the profile in real time — the profile is only updated at the trigger points above (submission or draft save). This prevents partial or uncommitted edits from corrupting the stored profile.

---

## 6. Field Inventory & Behaviour Matrix

The table below captures every field in Step 1 and its pre-population source, editability, and profile-write behaviour.

| Field | Label | Pre-Pop Source | Editable? | Written to Profile on Submit? | Required? |
|-------|-------|---------------|-----------|-------------------------------|-----------|
| `personalInfo.firstName` | First Name | `users/{uid}.firstName` | Yes | Yes | Yes |
| `personalInfo.lastName` | Last Name | `users/{uid}.lastName` | Yes | Yes | Yes |
| `personalInfo.dateOfBirth` | Date of Birth | `applicantProfile.dateOfBirth` | Yes | Yes (encrypted) | Yes |
| `personalInfo.phone` | Mobile Phone | `applicantProfile.phone` | Yes | Yes | Yes |
| `personalInfo.email` | Email Address | `users/{uid}.email` | Yes (form only, does not update Auth) | No | Yes |
| `personalInfo.address` | Street Address | `applicantProfile.address` | Yes | Yes | Yes |
| `personalInfo.suburb` | Suburb | `applicantProfile.suburb` | Yes | Yes | No |
| `personalInfo.city` | City / Town | `applicantProfile.city` | Yes | Yes | Yes |
| `personalInfo.postCode` | Post Code | `applicantProfile.zipCode` | Yes | Yes | Yes |
| `personalInfo.country` | Country | `applicantProfile.country` (default: "New Zealand") | Yes | Yes | Yes |
| `personalInfo.housingStatus` | Housing Status | `applicantProfile.housingStatus` | Yes | Yes | Yes |
| `personalInfo.maritalStatus` | Marital Status | `applicantProfile.maritalStatus` | Yes | Yes | Yes |
| `personalInfo.numberOfDependants` | Number of Dependants | `applicantProfile.numberOfDependants` | Yes | Yes | Yes |
| `personalInfo.residencyStatus` | Residency / Visa Status | `applicantProfile.residencyStatus` | Yes | Yes | Yes |
| `personalInfo.visaType` | Visa Type | `applicantProfile.visaType` | Yes (shown conditionally) | Yes | Conditional |
| `personalInfo.visaExpiry` | Visa Expiry Date | `applicantProfile.visaExpiry` | Yes (shown conditionally) | Yes (encrypted) | Conditional |
| `personalInfo.nzbn` | IRD Number | `applicantProfile.irdNumber` | Yes | Yes (encrypted) | No |

---

## 7. UX & Interaction Design

### 7.1 Page Load Sequence

```
1. Applicant navigates to /applicant/apply
2. Wizard controller fetches authenticated user session (/api/auth/me)
3. Wizard controller fetches applicant profile (/api/users/profile)
4. Step 1 renders with skeleton loaders while data resolves
5. On data load:
   a. Form fields pre-populated from merged user + profile data
   b. Address shown in the Google Places search input as formatted address
      (if a saved address exists)
   c. If no saved address: search input is empty, ready for input
6. Pre-populated fields styled with a subtle "auto-filled" visual indicator
   (e.g., light blue background) that clears when the user edits the field
```

### 7.2 Address Section Layout

```
┌─────────────────────────────────────────────────────────┐
│  Residential Address *                                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 🔍  Start typing your address…                    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  123 Queen Street, Auckland CBD, Auckland 1010    │  │  ← Suggestion dropdown
│  │  45 Queen Street, Auckland CBD, Auckland 1010     │  │
│  │  123 Queen Street, Hastings, Hawke's Bay 4122     │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  Can't find your address? Enter manually  ←── always visible
│                                                          │
│  [After selection — confirmed address shown]             │
│  ┌─────────────────────────┐  ┌──────────────────────┐  │
│  │  Street Address          │  │  Suburb              │  │
│  │  123 Queen Street        │  │  Auckland CBD        │  │
│  └─────────────────────────┘  └──────────────────────┘  │
│  ┌─────────────────────────┐  ┌──────────────────────┐  │
│  │  City / Town             │  │  Post Code           │  │
│  │  Auckland                │  │  1010                │  │
│  └─────────────────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

After the applicant selects an address from the dropdown the sub-fields (Street Address, Suburb, City, Post Code) are shown in a read-only-style display to confirm selection. Each sub-field has an edit affordance (pencil icon or "Edit" link) so corrections can be made. If the applicant edits any sub-field, the search input updates to reflect the modified address.

### 7.3 Pre-Populated Field Indicator

Fields pre-populated from the system must be visually distinguished from fields the user has typed themselves so the applicant understands the data origin:

- Pre-populated fields: subtle light-blue (`#EFF6FF`) background tint.
- The field label may include a small badge or note: `(from your profile)`.
- The indicator is removed as soon as the applicant makes any change to the field.
- The indicator does not appear on fields the user populated themselves in the current session.

### 7.4 Accessibility & Validation

- The autocomplete dropdown must be keyboard-navigable (arrow keys, Enter to select, Escape to close).
- ARIA attributes: `role="combobox"` on the search input, `role="listbox"` on the dropdown, `role="option"` on each suggestion.
- All required fields display inline error messages on blur and on attempted "Next" navigation.
- The address search input must not be labelled as "required" in the traditional sense — the individual sub-fields hold the required validation, not the search input itself.

---

## 8. Data Model Impact

### 8.1 Applicant Profile — New & Modified Fields

The following additions are required to the Applicant Profile document stored at `users/{uid}/applicantProfile/profile`:

| Field | Type | New / Modified | Notes |
|-------|------|---------------|-------|
| `suburb` | `string` | **New** | Populated from the Google Place Details `sublocality` / `sublocality_level_1` address component. |
| `country` | `string` | Existing | Default value "New Zealand" set on first write. |
| `housingStatus` | `string` | **New** | Enum: `renting`, `owner`, `living_with_family`, `other`. |
| `maritalStatus` | `string` | **New** | Enum: `single`, `married`, `de_facto`, `separated`, `divorced`, `widowed`. |
| `numberOfDependants` | `number` | **New** | Integer ≥ 0. |
| `residencyStatus` | `string` | **New** | Enum: `nz_citizen`, `nz_permanent_resident`, `nz_resident_visa`, `work_visa`, `student_visa`, `other`. |
| `visaType` | `string` | **New** | Free text. Shown only if `residencyStatus` is a visa type. |
| `visaExpiry` | `string` | **New** | 🔒 Encrypted. Date string (YYYY-MM-DD). Shown only if `residencyStatus` is a visa type. |
| `irdNumber` | `string` | **New** | 🔒 Encrypted. Optional. |
| `yearsAtAddress` | `number` | **New** | Derived from months-at-address input. |
| `profileLastUpdatedAt` | `Timestamp` | **New** | Automatically set on every profile write. Used to determine data freshness for pre-population. |

### 8.2 Application Document — Step 1 Fields

No structural changes are required to the application Firestore document. Step 1 data is already stored in the `personalInfo` sub-object (`TerePayApplicationData.personalInfo`). The addition of `suburb` and the new profile fields listed above should also be added to the application `personalInfo` object for full record-keeping.

---

## 9. Integration Requirements

### 9.1 Google Places API

> **Cost note:** Google Places API includes a **free tier of up to 1,000 requests per month** at no charge. At TerePay's current loan application volume this free tier is sufficient. Usage should be monitored in the Google Cloud Console; alerts should be configured to notify if the monthly request count approaches 800 (80% of the free threshold) so a cost decision can be made before billing begins.

| Attribute | Detail |
|-----------|--------|
| **Service** | Google Maps Platform — Places API (New) or legacy Places Autocomplete API |
| **Free Tier** | 1,000 requests/month at no cost. Billed per request beyond that. |
| **APIs Required** | Places Autocomplete (for suggestions), Place Details (for address components) |
| **Restriction** | `componentRestrictions: { country: 'nz' }`, `types: ['address']` — limits results to NZ street addresses only |
| **Authentication** | API key stored as a server-side environment variable (`GOOGLE_PLACES_API_KEY`). The key is never exposed to the client. A **Next.js API route** (`/api/places/autocomplete`) acts as a thin proxy, forwarding the applicant's query to Google and returning sanitised results. |
| **Rate Limiting** | The proxy API route applies per-user rate limiting (max 60 requests per minute per authenticated user) to prevent API quota exhaustion and cost abuse. |
| **Error Handling** | If the proxy returns a non-200 response, the client activates manual entry mode automatically. No user-visible error message is shown; the transition is seamless. |
| **Client-Side Library** | Do **not** load the full `@googlemaps/js-api-loader` script client-side to avoid exposing the API key in the browser. All Google API calls are proxied through the server. |
| **Cost Control** | Session tokens must be used when making Autocomplete → Place Details call pairs — this counts the entire search session as a single billable event rather than one per keystroke, significantly reducing quota usage. The backend proxy manages session token assignment. |

**Address Component Mapping (Google Place Details → Form Fields)**

| Google `address_components` type(s) | Mapped Form Field |
|--------------------------------------|-------------------|
| `street_number` + `route` | `personalInfo.address` (e.g. "123 Queen Street") |
| `sublocality` / `sublocality_level_1` | `personalInfo.suburb` |
| `locality` / `postal_town` | `personalInfo.city` |
| `postal_code` | `personalInfo.postCode` |
| `country` | `personalInfo.country` (always "New Zealand" for NZ-restricted queries) |

> **Note:** Google's Place Details response structure can vary. The mapping logic must handle missing components gracefully — if a component is absent, the corresponding field remains empty and the applicant fills it in manually.

### 9.2 Applicant Profile API

The existing `/api/users/profile` endpoint must be extended to:

1. **GET** — Return the merged `user + applicantProfile` object for the authenticated applicant. This is used by the wizard to pre-populate Step 1.
2. **PATCH** — Accept a partial update payload covering the fields listed in §8.1. Called on application submission and on draft save.

Authentication: all calls must include the session cookie. The endpoint returns 401 if the session is missing or expired.

---

## 10. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Performance | Google Places Autocomplete suggestions must appear within 500 ms of the debounce window closing under normal network conditions. |
| NFR-02 | Performance | Step 1 form must render with pre-populated data within 2 seconds of page load (measured from browser navigation event to interactive form). |
| NFR-03 | Security | The Google Places API key must never be exposed in client-side JavaScript, network requests from the browser, or source code repositories. |
| NFR-04 | Security | The `/api/places/autocomplete` proxy route must require an authenticated session. Unauthenticated requests return 401. |
| NFR-05 | Security | The proxy route validates and sanitises the `input` query parameter before forwarding to Google to prevent injection attacks. Maximum length: 200 characters. Only printable characters are forwarded. |
| NFR-06 | Privacy | Address data is PII. All address fields written to Firestore are governed by TerePay's privacy policy and the Privacy Act 2020 (NZ). |
| NFR-07 | Reliability | If pre-population data fails to load (API timeout, profile not found), the form must still render in a blank/empty state. The applicant must not be blocked. |
| NFR-08 | Accessibility | Address autocomplete dropdown must meet WCAG 2.1 AA criteria. Keyboard navigation, screen reader ARIA labels, and visible focus indicators are required. |
| NFR-09 | Resilience | The system must function with no degradation in form submission capability if the Google Places API is unavailable. Manual entry is always available. |
| NFR-10 | Audit | Each profile write triggered by a loan application or draft save must record `profileLastUpdatedAt`, `updatedByApplicationId`, and the user's `uid` in the Firestore audit log. |

---

## 11. Acceptance Criteria

### AC-001 — Pre-Population: First Application (New Applicant)

**Given** an applicant is logging in for the first time and has no applicant profile document  
**When** Step 1 loads  
**Then** the `firstName`, `lastName`, and `email` fields are pre-populated from the Firebase Auth user record, and all other fields are empty.

---

### AC-002 — Pre-Population: Returning Applicant

**Given** an applicant has previously submitted a loan application and has a saved profile  
**When** Step 1 loads for a new application  
**Then** all fields listed in §6 that have a stored value are pre-populated from the applicant profile, including the formatted address in the search input.

---

### AC-003 — Address Autocomplete — Successful Selection

**Given** the applicant types "123 Queen St" in the address search input  
**When** 3 or more characters have been entered and the debounce period has elapsed  
**Then** a dropdown appears with up to 5 NZ address suggestions, and selecting one populates the `address`, `suburb`, `city`, and `postCode` sub-fields without requiring further input.

---

### AC-004 — Address Autocomplete — No Results

**Given** the applicant types an address that returns no Google Places results  
**When** the API responds with an empty suggestions array  
**Then** the dropdown shows "No results found" and a link to enter the address manually.

---

### AC-005 — Manual Entry Fallback — User Initiated

**Given** the applicant is on Step 1  
**When** the applicant clicks "Can't find your address? Enter manually"  
**Then** the search input is hidden and individual text inputs for street address, suburb, city, and postcode are displayed, all editable.

---

### AC-006 — Manual Entry Fallback — API Failure

**Given** the Google Places API proxy returns an error  
**When** the applicant is typing in the address search input  
**Then** manual entry mode activates automatically and an inline non-blocking message is shown: "Address lookup unavailable — please enter your address manually."

---

### AC-007 — Profile Written on Submission

**Given** an applicant has completed Step 1 with either autocomplete or manual address  
**When** the application is submitted and status transitions to `pending_review`  
**Then** the applicant's profile document in Firestore is updated with the Step 1 field values and `profileLastUpdatedAt` is set to the current timestamp.

---

### AC-008 — Google API Key Security

**Given** an applicant is using the address autocomplete feature  
**When** the browser network requests are inspected  
**Then** no Google API key appears in any client-side request, HTML, or JavaScript bundle.

---

### AC-009 — Pre-Populated Field Indicator

**Given** a returning applicant loads Step 1  
**When** fields are pre-populated from their profile  
**Then** pre-populated fields display a light blue background. When the applicant edits any pre-populated field, that field's blue background is removed.

---

### AC-010 — Form Submittable When Pre-Populated

**Given** all required fields in Step 1 are pre-populated from the applicant's profile  
**When** the applicant clicks "Next" without making any changes  
**Then** Step 1 validation passes and the wizard advances to Step 2.

---

## 12. Out of Scope

The following items are explicitly excluded from this requirements document and should be addressed separately:

| Item | Notes |
|------|-------|
| Email address change / update flow | A dedicated "Update Email" feature in the applicant's profile settings should handle Firebase Auth email updates. Out of scope for the loan application form. |
| Identity verification of address | Address entered by the applicant is not cross-checked against external registries (e.g., LINZ) in this phase. Identity verification (ID&V) is a separate integration. |
| International applicants / non-NZ addresses | The Google Places integration is restricted to NZ. International address support is a future enhancement. |
| Lender-side address editing | Lenders view applicant-submitted data. Address correction is handled via document re-request workflow at lender discretion. |
| Auto-save on field-by-field change | Address and personal field changes are not auto-saved to the profile in real time. Profile writes are batched at specific trigger points (submission, draft save). |
| Google Maps address visualisation (map pin) | Displaying a map preview of the selected address is a future UX enhancement, not required in this phase. |
