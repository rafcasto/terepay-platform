# TerePay Loan Management System (LMS)
## Business Requirements Specification
**Version:** 1.0  
**Date:** March 2026  
**Prepared by:** Business Analysis — TerePay Neophile Limited  
**FSP Number:** FSP1007414 | NZBN 9429052055232  
**Compliance Framework:** Credit Contracts and Consumer Finance Act 2003 (CCCFA), Responsible Lending Code (RLC)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Context & Objectives](#2-business-context--objectives)
3. [System Overview](#3-system-overview)
4. [User Roles & Permissions](#4-user-roles--permissions)
5. [Application Lifecycle & Loan Statuses](#5-application-lifecycle--loan-statuses)
6. [Functional Requirements](#6-functional-requirements)
   - 6.1 [Applicant Portal — Loan Application Form](#61-applicant-portal--loan-application-form)
     - 6.1.5 [Applicant Edit & Read-Only Rules](#615-applicant-edit--read-only-rules)
   - 6.2 [Document Management](#62-document-management)
   - 6.3 [Lender Workflow](#63-lender-workflow)
   - 6.4 [Affordability Assessment Module](#64-affordability-assessment-module)
   - 6.5 [Benchmark Catalog Module](#65-benchmark-catalog-module)
   - 6.6 [Credit Check Integration](#66-credit-check-integration)
   - 6.7 [Loan Approval & Disbursement](#67-loan-approval--disbursement)
   - 6.8 [Loan Decline Workflow](#68-loan-decline-workflow)
   - 6.9 [Notifications & Communications](#69-notifications--communications)
   - 6.10 [Lender Dashboard & Reporting](#610-lender-dashboard--reporting)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Data Requirements](#8-data-requirements)
9. [Integration Requirements](#9-integration-requirements)
10. [CCCFA Compliance Requirements](#10-cccfa-compliance-requirements)
11. [Acceptance Criteria Summary](#11-acceptance-criteria-summary)
12. [Appendix A — Loan Terms Reference](#appendix-a--loan-terms-reference)
13. [Appendix B — Affordability Decision Logic](#appendix-b--affordability-decision-logic)

---

## 1. Executive Summary

TerePay Neophile Limited is a registered Financial Services Provider (FSP1007414) offering short-term microloan products to migrants and underserved communities in New Zealand. The current loan origination and assessment process is manual, spreadsheet-based, and email-driven.

This document defines the full business requirements for a **Loan Management System (LMS)** that digitises and automates the end-to-end loan lifecycle — from applicant submission through affordability assessment, credit checking, approval/decline, and disbursement — while maintaining strict compliance with CCCFA obligations.

---

## 2. Business Context & Objectives

### 2.1 Business Drivers

- **Scale operations** without proportionally increasing manual effort from the lender team.
- **Reduce compliance risk** by enforcing CCCFA/Responsible Lending Code steps programmatically.
- **Improve applicant experience** with a digital-first, mobile-friendly application journey.
- **Centralise data** currently scattered across email, Excel affordability calculators, and manual checklists.
- **Maintain audit trails** for all lending decisions as required by CCCFA.

### 2.2 Business Objectives

| # | Objective | Success Metric |
|---|-----------|---------------|
| BO-01 | Fully digitise loan application intake | 100% of applications submitted via LMS |
| BO-02 | Enforce CCCFA compliance at every step | Zero non-compliant approvals; 100% audit trail coverage |
| BO-03 | Reduce average time-to-decision | Target: ≤ 2 business days for complete applications |
| BO-04 | Enable draft saving for applicants | Applicants can save and return before submission |
| BO-05 | Integrate affordability assessment tools | In-system affordability calculator aligned to TerePay templates |
| BO-06 | Automate status-driven communications | All applicant notifications triggered by status changes |

---

## 3. System Overview

### 3.1 High-Level Architecture

The LMS consists of four primary modules:

1. **Applicant Portal** — Public-facing application form with draft/submit capability
2. **Lender Workbench** — Internal tool for loan officers to review, assess, and decide
3. **Affordability Engine** — Digital implementation of TerePay's affordability calculator and assessment template (CCCFA-compliant)
4. **Lender Dashboard** — Operational overview, reporting, and configuration

### 3.2 Loan Product In Scope

| Parameter | Value |
|-----------|-------|
| Loan Period | 8 weeks (56 days) |
| Payment Frequency | 4 equal fortnightly payments |
| Annual Percentage Rate | 49% APR |
| Interest Rate | 4.7% for 8 weeks |
| Establishment Fee (New) | $50 (first loan only) |
| Application Fee (Repeat) | $20 (subsequent loans) |
| Minimum Loan Amount | $200 |
| Maximum Loan Amount | $2,000 |

---

## 4. User Roles & Permissions

### 4.1 Role Definitions

| Role | Description | Key Permissions |
|------|-------------|----------------|
| **Applicant** | Loan applicant (external) | Create/edit/submit application, save draft, upload documents, view own application status and history |
| **Lender** | TerePay staff member responsible for reviewing and assessing applications | View all applications in queue, claim and assess applications, complete affordability assessment, request documents, perform credit check, approve/decline |

### 4.2 Access Control Rules

- Applicants can only access their own application(s).
- Lenders can view all applications in the queue and any application assigned to them.
- All login events, data access, and decision actions must be logged to an immutable audit trail.

---

## 5. Application Lifecycle & Loan Statuses

### 5.1 Status Flow Diagram

```
[DRAFT] 
    → (Applicant submits) → [PENDING REVIEW]
        → (Lender claims & starts review) → [UNDER ASSESSMENT]
            → (Documents needed) → [WAITING FOR DOCUMENTATION]
                ← (Documents received) → [UNDER ASSESSMENT]
            → (Assessment complete — credit check triggered) → [CREDIT CHECK IN PROGRESS]
                → (Credit check pass) → [APPROVED — PENDING DISBURSEMENT]
                    → (Funds sent) → [DISBURSED / ACTIVE]
                        → (All repayments received) → [CLOSED — REPAID]
                → (Credit check fail OR affordability fail) → [DECLINED]
            → (Lender declines without credit check) → [DECLINED]
    → (Applicant withdraws) → [WITHDRAWN]
    → (Application expires — no activity 30 days) → [EXPIRED]
```

### 5.2 Status Definitions

| Status | Description | Who Can Transition |
|--------|-------------|-------------------|
| `DRAFT` | Application saved but not yet submitted | Applicant |
| `PENDING_REVIEW` | Submitted, awaiting lender to claim | System (on submit) |
| `UNDER_ASSESSMENT` | Lender is actively reviewing | Lender |
| `WAITING_FOR_DOCUMENTATION` | Lender has requested additional documents | Lender |
| `CREDIT_CHECK_IN_PROGRESS` | Affordability passed; Centrix credit check underway | System/Lender |
| `APPROVED_PENDING_DISBURSEMENT` | Loan approved; awaiting fund transfer | Lender |
| `DISBURSED` | Funds sent to applicant | System (on payment confirmation) |
| `ACTIVE` | Loan is open with outstanding repayments | System |
| `CLOSED_REPAID` | All repayments received | System |
| `DECLINED` | Application declined | Lender/System |
| `WITHDRAWN` | Applicant withdrew application | Applicant |
| `EXPIRED` | No activity after 30 days in DRAFT or WAITING_FOR_DOCUMENTATION | System (automated) |

---

## 6. Functional Requirements

### 6.1 Applicant Portal — Loan Application Form

#### 6.1.1 Form Access & Authentication

| Req ID | Requirement |
|--------|-------------|
| F-APP-001 | Applicants must provide a valid email address and mobile number to begin an application. The system sends an OTP to verify identity before the form is accessible. |
| F-APP-002 | Returning applicants may log in using their email + OTP to resume a draft or view a previous application. |
| F-APP-003 | The system must detect if the applicant already has an active or recent loan and display an appropriate message. |

#### 6.1.2 Form Sections

The application form must capture all data as defined in the TerePay Application Form, structured into the following validated sections:

**Section 1 — Personal Information**

| Field | Type | Validation |
|-------|------|-----------|
| Full Legal Name | Text | Required, min 2 words |
| Date of Birth | Date | Required, must be 18+ years |
| Email Address | Email | Required, valid format, OTP-verified |
| Mobile Phone | Phone | Required, NZ format |
| Residential Address | Text | Required |
| City/Town | Text | Required |
| Post Code | Text | Required, valid NZ postcode |
| Time at Address | Dropdown | Required |
| Housing Status | Dropdown | Rent / Own / Flatmates |
| Visa Status | Dropdown | Work Visa / Resident Visa / Student Visa / NZ Citizen / Other |
| Visa Expiry Date | Date | Required if not NZ Citizen/Resident; must be ≥ loan completion date + 3 months |
| Household Type | Dropdown | Single / Single+Children / Couple / Couple+Children |
| Number of Children | Number | Required, 0–20 |
| Number of Dependents | Number | Required, 0–20 |

**Section 2 — Employment & Income**

| Field | Type | Validation |
|-------|------|-----------|
| Employer Name | Text | Required |
| Employer Address | Text | Required |
| Occupation/Job Title | Text | Required |
| Hours per Week | Number | Required, 1–80 |
| Employment Status | Dropdown | Permanent / Fixed Term / Casual / Part-time |
| Time at Current Workplace | Text | Required |
| Previous Employer | Text | Required if < 6 months at current |
| Salary/Wages (before tax) | Currency | Required |
| Salary/Wages (after tax) | Currency | Required; must be ≤ before-tax amount |
| WINZ/Government Support | Currency | Optional |
| Other Income | Currency + description | Optional |
| Total Fortnightly Income | Currency | Auto-calculated, read-only |

**Section 3 — Living Expenses**

The form must capture all non-discretionary and discretionary expense categories as listed in the application form, including:

- Non-discretionary: Food & Groceries, Utilities, Personal Expenses, Transport, Medical, Childcare, Accommodation/Rent, Health Insurance, Car Insurance, Rates, Education, Child Support, Remittances
- Discretionary: Restaurants/Takeaways, Entertainment, Travel, Subscriptions, Home Improvement, Cash Withdrawals, Other
- Subscriptions detail: Gym, Netflix, Spotify, Sports, Others
- Buy Now Pay Later: Afterpay, Klarna, ZIP
- All amounts in NZD fortnightly; auto-calculated totals

**Section 4 — Existing Debts & Financial Commitments**

- Mortgage, Personal Loans, Car Loans, Credit Cards, Bank Overdrafts, Other Loans (up to 3)
- Each entry: Total Owed + Fortnightly Payment
- Free-text field: Purpose and expected end date of existing loans

**Section 5 — Loan Request**

| Field | Type | Validation |
|-------|------|-----------|
| Requested Amount | Currency | Required; $200–$2,000 |
| Loan Purpose | Text | Required; min 20 characters |
| Primary Income Source | Text | Required |
| PEP Declaration | Yes/No | Required; if Yes, detail field required |
| Remittance Frequency | Dropdown | Weekly / Fortnightly / Monthly / Occasionally / None |
| Average Remittance per Fortnight | Currency | Required if frequency ≠ None |
| Remittance Purpose | Multi-checkbox | Family support / Medical / Education / Mortgage-Rent / Business / Savings / Emergency / Special occasions |

**Section 6 — Bank Account & Repayment Details**

| Field | Type | Validation |
|-------|------|-----------|
| Bank Name | Text | Required |
| Account Holder Name | Text | Required |
| Account Number | Text | Required, valid NZ format (XX-XXXX-XXXXXXX-XX) |
| Payment Method | Radio | Direct Debit (preferred) / Bank Transfer |

**Section 7 — References (Optional)**

- Reference 1 & 2: Name, Email, Phone
- Validation: Cannot be family members (honour system + declaration)

**Section 8 — Declarations & Consent**

All checkboxes listed in the application form are required before submission:
- Accuracy declaration
- Verification authorisation
- Loan terms acknowledgement
- Affordability self-confirmation
- Disclosure statement receipt
- Default consequences understanding
- Privacy Policy agreement
- Credit reporting consent (Centrix authorisation)

#### 6.1.3 Draft & Save Functionality

| Req ID | Requirement |
|--------|-------------|
| F-APP-010 | Applicants must be able to save a draft at any point during form completion. |
| F-APP-011 | Draft data must persist for a minimum of 30 days. |
| F-APP-012 | The system must send the applicant an email with a secure link to resume their draft upon saving. |
| F-APP-013 | A draft expiry warning must be sent 3 days before the 30-day expiry. |
| F-APP-014 | The applicant portal must display a completion progress indicator (e.g., "Section 3 of 8 complete"). |
| F-APP-015 | Section-level validation must run on navigation away from each section; the full form validation runs on submission. |

#### 6.1.4 Submission

| Req ID | Requirement |
|--------|-------------|
| F-APP-020 | On submission, the system must validate all required fields and present a pre-submission summary for applicant review. |
| F-APP-021 | On confirmed submission, the application status must transition to `PENDING_REVIEW`. |
| F-APP-022 | An application reference number (e.g., `TP-2026-XXXXX`) must be generated and displayed to the applicant. |
| F-APP-023 | A submission confirmation email must be sent to the applicant within 5 minutes. |
| F-APP-024 | An internal notification must alert the lender queue of a new pending application. |

#### 6.1.5 Applicant Edit & Read-Only Rules

| Status | Applicant Can Edit Form | Applicant Access |
|--------|------------------------|-----------------|
| `DRAFT` | ✅ Yes — all sections editable | Full edit access |
| `PENDING_REVIEW` | ❌ No | Read-only view |
| `UNDER_ASSESSMENT` | ❌ No | Read-only view |
| `WAITING_FOR_DOCUMENTATION` | ❌ No — form locked; documents only | Can upload documents via secure link; form is read-only |
| `CREDIT_CHECK_IN_PROGRESS` | ❌ No | Read-only view |
| `APPROVED_PENDING_DISBURSEMENT` | ❌ No | Read-only view |
| `DISBURSED` / `ACTIVE` | ❌ No | Read-only view + repayment schedule |
| `CLOSED_REPAID` | ❌ No | Read-only view |
| `DECLINED` | ❌ No | Read-only view + decline letter |
| `WITHDRAWN` | ❌ No | Read-only view |

| Req ID | Requirement |
|--------|-------------|
| F-APP-025 | The applicant may only edit the application form while it is in `DRAFT` status. |
| F-APP-026 | Once the application is submitted, the form must be rendered as read-only for the applicant across all subsequent statuses. |
| F-APP-027 | The applicant portal must display a clear status banner indicating the current application status and any action required from the applicant. |
| F-APP-028 | If an applicant attempts to edit a submitted application, the system must display a message explaining the form is locked and provide a contact link to reach the lender. |

---

### 6.2 Document Management

#### 6.2.1 Required Documents

The system must manage two categories of documents:

**Identity Documents (submitted with application or requested post-submission):**
- Passport
- New Zealand Driver Licence
- Current Visa documentation

**Financial Verification Documents (requested by lender):**
- Payslips (last 3 months, minimum 2)
- Bank Statements (last 3 months, showing current residential address)

#### 6.2.2 Document Requirements

| Req ID | Requirement |
|--------|-------------|
| F-DOC-001 | Applicants must be able to upload documents via the portal in PDF, JPG, or PNG format. |
| F-DOC-002 | Maximum file size per document: 10MB. |
| F-DOC-003 | The system must display uploaded document filenames, upload date/time, and status (Pending Review / Accepted / Rejected). |
| F-DOC-004 | Lender must be able to mark each document as Accepted or Rejected with a mandatory reason for rejection. |
| F-DOC-005 | When an lender requests additional documents, the system must transition status to `WAITING_FOR_DOCUMENTATION` and notify the applicant with a specific list of required documents. |
| F-DOC-006 | Applicants must receive a secure, time-limited upload link when documents are requested. |
| F-DOC-007 | On document upload by the applicant, the lender must be notified automatically. |
| F-DOC-008 | The system must log all document uploads, views, and lender actions with timestamp and user ID. |
| F-DOC-009 | All documents must be stored in Google Drive, organised by application reference number. Access is restricted by role — applicants can only access their own documents; lenders can access all. |

---

### 6.3 Lender Workflow

#### 6.3.1 Application Queue

| Req ID | Requirement |
|--------|-------------|
| F-ASS-001 | The lender dashboard must display a queue of applications in `PENDING_REVIEW` status, ordered by submission date (oldest first). |
| F-ASS-002 | Each queue item must display: Application ID, Applicant Name, Loan Amount, Submission Date, and Days Pending. |
| F-ASS-003 | Lender must be able to claim an application, transitioning it to `UNDER_ASSESSMENT` and assigning it to themselves. |
| F-ASS-004 | An lender can only have a configurable maximum number of active applications at once (default: 10). |
| F-ASS-005 | Applications not claimed within 2 business days must be flagged with a visual warning indicator in the queue. |

#### 6.3.2 Application Review

| Req ID | Requirement |
|--------|-------------|
| F-ASS-010 | The lender must have a single-screen view of all application data, uploaded documents, and assessment history. |
| F-ASS-011 | The lender must be able to add internal notes at any stage of the review; notes must be timestamped and attributed to the lender. |
| F-ASS-012 | The lender must be able to trigger a document request at any point while the application is `UNDER_ASSESSMENT`. |
| F-ASS-013 | The system must display a checklist of mandatory assessment steps that must be completed before an approve/decline decision can be made (see Section 6.4). |

---

### 6.4 Affordability Assessment Module

This module is a direct digitalisation of TerePay's Affordability Assessment Template and Calculator (CCCFA v1.0). Completion of the affordability assessment is **mandatory for every application** — the system must block credit checks, approval, and disbursement until a completed and recorded assessment exists against the application.

#### 6.4.0 Mandatory Completion Rules

| Req ID | Requirement |
|--------|-------------|
| F-AFF-001 | The lender must complete the affordability assessment for every application before any further workflow step (document approval, credit check, or loan approval) can proceed. |
| F-AFF-002 | The system must display the affordability assessment as a required step in the lender workflow checklist. Incomplete assessments must be visually flagged and block forward progression. |
| F-AFF-003 | Once submitted, the affordability assessment record must be immutable. If the lender needs to revise it, a new assessment version must be created and linked to the application, with the prior version retained in full. |
| F-AFF-004 | Every completed assessment must be saved against the application record with: timestamp, lender user ID, assessment version number, all input values, calculated outputs, benchmarks applied, red flags acknowledged, and final recommendation. |
| F-AFF-005 | A PDF snapshot of the completed assessment must be automatically generated and stored in Google Drive under the application's folder upon submission. |

#### 6.4.1 Pre-Fill from Applicant Application

When the lender opens the affordability assessment for an application, the system must automatically pre-fill fields from the applicant's submitted application form. The lender may review and adjust pre-filled values, but must document a reason for any change.

| Affordability Assessment Field | Pre-filled From | Application Section |
|-------------------------------|----------------|---------------------|
| Customer Name | Full Legal Name | Section 1 |
| Loan Amount Requested | Requested Amount to Borrow | Section 5 |
| Loan Purpose | Purpose of Loan | Section 5 |
| Assessment Date | System date (auto) | — |
| Employment Status | Employment Status | Section 2 |
| Employer | Employer Name | Section 2 |
| Time with Employer | How long at current workplace | Section 2 |
| Visa Status | Visa Status | Section 1 |
| Visa Type | Visa Status (type) | Section 1 |
| Visa Expiry Date | Visa Expiry Date | Section 1 |
| Household Composition | Household Type + Number of Children | Section 1 |
| Salary/Wages (fortnightly, stated) | Salary/Wages after tax | Section 2 |
| Government Benefits | WINZ/Government Support | Section 2 |
| Other Income (stated) | Other Income | Section 2 |
| Accommodation / Rent | Accommodation Costs (Rental Payment) | Section 3 |
| Food & Groceries (stated) | Food & Groceries | Section 3 |
| Utilities (stated) | Utilities | Section 3 |
| Transport (stated) | Transport | Section 3 |
| Medical (stated) | Medical | Section 3 |
| Childcare (stated) | Childcare / Dependants | Section 3 |
| Health Insurance (stated) | Health Insurance | Section 3 |
| Car Insurance (stated) | Car Insurance | Section 3 |
| Education (stated) | Education | Section 3 |
| Child Support (stated) | Child Support | Section 3 |
| Remittances (stated) | Remittances | Section 3 |
| Restaurants & Dining (stated) | Restaurants & Dining/Takeaways | Section 3 |
| Entertainment (stated) | Entertainment | Section 3 |
| Subscriptions (stated) | Total Subscriptions | Section 3 |
| Buy Now Pay Later (stated) | Total BNPL | Section 3 |
| Existing Debt Repayments (stated) | Total Fortnightly Debt Payments | Section 4 |
| Mortgage (stated) | Mortgage Fortnightly Payment | Section 4 |
| Personal Loans (stated) | Personal Loans Fortnightly Payment | Section 4 |
| Car Loans (stated) | Car Loans Fortnightly Payment | Section 4 |
| Credit Cards (stated) | Credit Card Fortnightly Payment | Section 4 |

> **Pre-fill behaviour:** Pre-filled fields must be clearly marked as "From Application" in the UI. The lender enters independently verified values (from bank statements, payslips, or Centrix) alongside the pre-filled stated values. The system calculates the final value per the benchmark and verification rules below.

#### 6.4.2 Data Collection Checklist

The lender must complete and confirm all items before proceeding to the affordability calculation:

| Checklist Item | Validation Rule |
|---------------|----------------|
| Centrix Report obtained | Lender must enter Report Number; system records it |
| First transaction date verified | Lender inputs date; system auto-calculates days of data |
| **90+ days of transaction data** | **Hard block: if < 90 days, system must force DECLINE** |
| Payslips received (last 2–3) | Document must be marked Accepted in document manager |
| Employment verified | Lender selects verification method (payslip / phone / email / employer letter) |
| Visa status confirmed | System auto-checks from pre-filled Section 1 data; lender confirms |
| **Visa valid 3+ months beyond loan end** | **Hard block: if visa expires before loan end + 3 months, system must force DECLINE** |

#### 6.4.3 Income Verification

The affordability module must implement a four-column income verification table. The "Stated Amount" column is pre-filled from the applicant's application (see Section 6.4.1):

| Column | Source | Editable by Lender | Notes |
|--------|--------|--------------------|-------|
| Stated Amount | Pre-filled from applicant application | No — read-only reference | Applicant's self-reported income |
| Centrix Amount | Lender inputs from Centrix report | Yes | Bank transaction-derived income |
| Verified Amount | Lender inputs from payslips | Yes | Payslip-verified figure |
| Adjustment | Lender inputs | Yes | Document reason if sources differ |
| Final Amount | System auto-calculates | No — calculated field | Lower of Centrix and Verified amounts (conservative per CCCFA) |

Income categories: Salary/Wages, Bonus, Rental Income, Government Benefits, Investments, Other Income.

**Total Verified Fortnightly Income** = sum of Final Amount column (auto-calculated, read-only).

#### 6.4.4 Expense Verification & Benchmark Catalog

Expense benchmarks are managed as a **configurable catalog module** (see Section 6.10). Benchmarks are not hardcoded — the lender can update them via the catalog without a system deployment. The assessment always uses the benchmark values active at the time of assessment, which are recorded in the assessment record.

The expense table must implement five columns. The "Stated Amount" column is pre-filled from the applicant's application (see Section 6.4.1):

| Column | Source | Editable by Lender | Notes |
|--------|--------|--------------------|-------|
| Stated Amount | Pre-filled from applicant application | No — read-only reference | Applicant's self-reported expense |
| Centrix Amount | Lender inputs from bank statement analysis | Yes | Observed from transaction data |
| Benchmark Amount | Auto-populated from Benchmark Catalog × household multiplier | No — catalog-driven | Updates when catalog is updated |
| Adjustment | Lender inputs | Yes | Lender must document reason if adjusting |
| Final Amount | System auto-calculates | No — calculated field | Highest of: Centrix Amount, Benchmark Amount, or Adjustment |

**Household multipliers** are applied automatically to benchmark values based on pre-filled household composition:

| Household Composition | Multiplier |
|----------------------|-----------|
| Single adult | 1.0x |
| 2 adults | 1.5x |
| 2 adults + 1 child | 1.8x |
| 2 adults + 2 children | 2.0x |
| Each additional person | +0.3x |

**Benchmark Rule (CCCFA):** The system must always use the **highest** of stated expense, Centrix-observed expense, or benchmark. If the benchmark overrides stated or Centrix values, the system must flag it and the lender must acknowledge with a documented reason.

**Expense categories covered** (all pre-filled where available from application):
Accommodation/Rent, Food & Groceries, Utilities, Personal/Clothing, Transport, Medical, Childcare, Health Insurance, Car Insurance, Rates, Education, Child Support, Remittances, Restaurants/Takeaways, Entertainment, Travel, Subscriptions, Home Improvement, Cash Withdrawals, Buy Now Pay Later, Existing Debt Repayments, Other

#### 6.4.5 Affordability Calculation

The system must automatically calculate all values — no manual entry of totals:

```
Total Fortnightly Expenses  = Sum of all Final Expense Amounts
Net Disposable Income       = Total Verified Income - Total Fortnightly Expenses
Loan Fortnightly Payment    = Loan Amount × (1 + 0.047) / 4
Final Available Surplus     = Net Disposable Income - Loan Fortnightly Payment
```

**Loan Payment Quick Reference (auto-populated from requested loan amount):**

| Loan Amount | Fortnightly Payment | Total Repayment |
|-------------|--------------------|-----------------| 
| $200 | $52.35 | $209.40 |
| $500 | $130.88 | $523.50 |
| $800 | $209.40 | $837.60 |
| $1,000 | $261.75 | $1,047.00 |
| $1,200 | $314.10 | $1,256.40 |
| $1,500 | $392.63 | $1,570.50 |
| $2,000 | $523.50 | $2,094.00 |

#### 6.4.6 Affordability Decision Engine

**Instant Decline Triggers (hard blocks — system must prevent approval, cannot be overridden):**

| Condition | Rule |
|-----------|------|
| Days of transaction data < 90 | HARD DECLINE |
| Visa expires before loan completion | HARD DECLINE |
| Final Available Surplus ≤ $0 | HARD DECLINE |
| Income cannot be verified | HARD DECLINE |
| Recent payment defaults (within 90 days) | HARD DECLINE |
| Loan purpose: overseas remittances | HARD DECLINE |
| Loan purpose: planned expenses (visa fees, celebrations) | HARD DECLINE |

**Affordability Surplus Interpretation:**

| Final Surplus | System Flag | Lender Guidance |
|---------------|-------------|----------------|
| > $100/fortnight | ✓ LIKELY AFFORDABLE | Proceed subject to other checks |
| $50–$100/fortnight | ⚠ MARGINAL | Careful consideration required; lender justification mandatory |
| $0–$50/fortnight | ✗ HIGH RISK | Likely substantial hardship; decline recommended |
| ≤ $0 | ✗ NOT AFFORDABLE | Hard decline — system blocks approval |

**Red Flag Alerts (lender must acknowledge and document each before proceeding):**

- Food/grocery expenses very low for household size
- No rent/mortgage shown but applicant is not a homeowner
- Large discretionary spending relative to income
- Multiple existing short-term loans
- Employment ending soon (fixed-term ending before loan completion)
- Too many uncategorised transactions (> $50 or > 2% of income)

#### 6.4.7 Assessment Output & Record

| Req ID | Requirement |
|--------|-------------|
| F-AFF-010 | The completed assessment record must include: all pre-filled stated values, all lender-entered verified values, benchmark values applied (with catalog version reference), household multiplier used, all calculated totals, red flags raised and lender acknowledgements, final surplus, and the lender's recommendation (Proceed / Decline). |
| F-AFF-011 | An immutable PDF snapshot of the completed assessment must be auto-generated and stored in the application's Google Drive folder. |
| F-AFF-012 | The assessment must be linked to the application record by Application ID, Assessment ID, lender user ID, and timestamp. |
| F-AFF-013 | If a revised assessment is created, both the original and revised versions must be retained. The revised version becomes the active record; the original is archived but accessible for audit. |
| F-AFF-014 | The lender dashboard must show whether an affordability assessment has been completed for each application in the queue (status indicator: Not Started / In Progress / Complete). |

---

### 6.5 Benchmark Catalog Module

The Benchmark Catalog is a standalone configuration module that stores and manages the expense benchmark values used in affordability assessments. It decouples benchmark data from the system codebase so values can be updated by the lender without a deployment.

#### 6.5.1 Catalog Structure

Each benchmark entry in the catalog must contain:

| Field | Description |
|-------|-------------|
| Category Name | Expense category (e.g., "Food & Groceries") |
| Household Type | The base household type the value applies to (e.g., "Single Adult") |
| Fortnightly Amount | The benchmark value in NZD fortnightly |
| Range Low | Lower bound of acceptable range |
| Range High | Upper bound of acceptable range |
| Source | Reference for the benchmark (e.g., "Stats NZ HES 2023/24", "TerePay Internal 2026") |
| Effective From | Date from which this benchmark is active |
| Effective To | Date until which this benchmark is active (blank = currently active) |
| Created By | Lender user ID who created the entry |
| Last Updated | Timestamp of last modification |

#### 6.5.2 Catalog Requirements

| Req ID | Requirement |
|--------|-------------|
| F-CAT-001 | The lender must be able to view, add, edit, and deactivate benchmark entries via the Benchmark Catalog module without requiring a system deployment. |
| F-CAT-002 | Benchmark entries must be versioned. When a value is updated, the previous version is retained with its effective date range. Historical assessments always reference the benchmark version active at the time of assessment. |
| F-CAT-003 | The catalog must support all expense categories used in the affordability assessment (minimum: the full list in Section 6.4.4). |
| F-CAT-004 | The catalog must support household size multipliers as a separate configurable table (not hardcoded). |
| F-CAT-005 | When an affordability assessment is opened, the system must automatically load the currently active benchmark values from the catalog and record the catalog version used in the assessment record. |
| F-CAT-006 | The lender must be able to set an "Effective From" date when updating benchmarks, allowing future-dated changes to be pre-configured (e.g., updating January benchmarks in December). |
| F-CAT-007 | All catalog changes must be logged with the lender user ID, timestamp, previous value, new value, and reason for change. |
| F-CAT-008 | The catalog must display the current active benchmark values on the affordability assessment form as a read-only reference panel visible to the lender during assessment. |

---

### 6.6 Credit Check Integration

| Req ID | Requirement |
|--------|-------------|
| F-CC-001 | The system must integrate with **Centrix** (New Zealand credit bureau) to retrieve credit reports. |
| F-CC-002 | A credit check can only be initiated after the affordability assessment is completed and returns a "Proceed" recommendation. |
| F-CC-003 | On credit check initiation, the application status must transition to `CREDIT_CHECK_IN_PROGRESS`. |
| F-CC-004 | The system must store the Centrix report reference number, report date, and key outputs against the application. |
| F-CC-005 | Credit check results must include: credit score, payment history, existing credit commitments, defaults, and bankruptcies. |
| F-CC-006 | Credit check results must be viewable only by the Lender; not accessible to the Applicant. |
| F-CC-007 | If Centrix returns a fail result or hardcoded decline conditions are met (see Section 6.4.5), the system must transition to `DECLINED`. |
| F-CC-008 | If Centrix returns a pass, the lender must review and make a final decision (Approve or Decline). |
| F-CC-009 | All credit check results must be logged with timestamp, lender ID, and decision rationale. |

---

### 6.7 Loan Approval & Disbursement

| Req ID | Requirement |
|--------|-------------|
| F-APR-001 | A loan can only be approved when: (a) affordability assessment is complete with positive surplus, (b) all hard-decline conditions are clear, (c) credit check has passed, and (d) all required documents are Accepted. |
| F-APR-002 | The Lender must enter a mandatory approval note before confirming approval. |
| F-APR-003 | On approval, the system must generate a **Loan Agreement document** containing: applicant details, loan amount, APR, fees, fortnightly payment schedule (4 payments with dates), total repayment amount, and bank account details. |
| F-APR-004 | The Loan Agreement must be sent to the applicant for electronic signature before disbursement. |
| F-APR-005 | The system must track Loan Agreement signature status (Sent / Viewed / Signed / Declined). |
| F-APR-006 | Disbursement may only be initiated after the signed Loan Agreement is received. |
| F-APR-007 | On approval, the applicant must be notified by email and SMS with the loan terms, repayment schedule, and next steps. |
| F-APR-008 | Disbursement details (amount, date, payment reference) must be recorded in the system. |
| F-APR-009 | On disbursement confirmation, the status must transition to `DISBURSED` and then `ACTIVE`. |
| F-APR-010 | The system must generate a repayment schedule with 4 fortnightly payment dates, calculated from the disbursement date. |

---

### 6.8 Loan Decline Workflow

| Req ID | Requirement |
|--------|-------------|
| F-DEC-001 | When declining an application, the lender must select one or more decline reasons from a standardised list. |
| F-DEC-002 | Decline reasons must include all CCCFA-required categories (see Section 10). |
| F-DEC-003 | The lender must enter a free-text decline rationale (mandatory). |
| F-DEC-004 | The system must generate a **Loan Decline Letter** for the applicant, using TerePay's standard templates, including: applicant name, application reference, decline reason (summary only — no sensitive credit data), next steps, and hardship/complaint contact details. |
| F-DEC-005 | The Decline Letter must be sent to the applicant within 24 hours of the decline decision. |
| F-DEC-006 | Declined applications must be retained in the system for a minimum of 7 years (CCCFA record-keeping requirement). |
| F-DEC-007 | Applicants must be able to request a manual review within 10 business days; the system must support a `DECLINE_UNDER_REVIEW` sub-status. |

---

### 6.9 Notifications & Communications

All communications must be triggered automatically by status transitions.

| Trigger | Channel | Recipient | Message Type |
|---------|---------|-----------|-------------|
| Application submitted | Email + SMS | Applicant | Submission confirmation + reference number |
| New application pending | Email | Lender | Internal alert |
| Application claimed | Email | Applicant | "Under review" notification |
| Document request | Email + SMS | Applicant | Document checklist with upload link |
| Documents received | Email | Lender | Internal alert |
| Approved | Email + SMS | Applicant | Approval details + loan agreement |
| Loan Agreement signed | Email | Lender | Ready for disbursement |
| Disbursed | Email + SMS | Applicant | Funds sent + repayment schedule |
| Repayment reminder | Email + SMS | Applicant | 3 days before each repayment date |
| Declined | Email | Applicant | Decline letter |
| Draft expiry warning | Email | Applicant | 3 days before 30-day expiry |
| Application expired | Email | Applicant | Expiry notice + re-apply option |

**Communication Requirements:**
- F-COM-001: All email communications must be sent from `info@terepay.co.nz`.
- F-COM-002: All communications must include TerePay branding, FSP number, and NZBN.
- F-COM-003: SMS messages must be concise (< 160 characters) with a portal link.
- F-COM-004: All communications sent must be logged against the application record (timestamp, channel, recipient, content).
- F-COM-005: Applicants must be able to opt out of SMS; email is mandatory for regulatory communications.

---

### 6.10 Lender Dashboard & Reporting

| Req ID | Requirement |
|--------|-------------|
| F-ADM-001 | The Lender dashboard must display real-time KPIs: Total Applications (by status), Average Time-to-Decision, Approval Rate, Decline Rate, Total Loan Value Disbursed. |
| F-ADM-002 | The Lender must be able to generate reports filtered by: date range, status, loan amount range, and loan purpose. Exportable as CSV. |
| F-ADM-003 | The system must maintain a full, immutable audit log: every status change, user action, document upload/access, assessment entry, and communication sent. |
| F-ADM-004 | The Lender must be able to manage the Benchmark Catalog (see Section 6.5) and configure draft expiry period. |
| F-ADM-005 | The Lender must be able to view and search the full application history including declined and expired records. |

---

## 7. Non-Functional Requirements

### 7.1 Performance

| Req ID | Requirement |
|--------|-------------|
| NF-PERF-001 | Page load time must not exceed 3 seconds on a standard 4G mobile connection. |
| NF-PERF-002 | Form auto-save (draft) must complete within 2 seconds. |
| NF-PERF-003 | Affordability calculations must return results in < 1 second. |
| NF-PERF-004 | The system must support at least 200 concurrent users without performance degradation. |

### 7.2 Availability & Reliability

| Req ID | Requirement |
|--------|-------------|
| NF-REL-001 | System uptime target: 99.5% (excluding scheduled maintenance windows). |
| NF-REL-002 | Scheduled maintenance windows must occur outside of NZ business hours (9am–6pm NZST weekdays). |
| NF-REL-003 | Application data must be backed up daily with a recovery point objective (RPO) of 24 hours. |

### 7.3 Security

| Req ID | Requirement |
|--------|-------------|
| NF-SEC-001 | All data in transit must be encrypted using TLS 1.2 or higher. |
| NF-SEC-002 | All data at rest must be encrypted (AES-256 or equivalent). |
| NF-SEC-003 | Authentication must support multi-factor authentication (MFA) for Lender login. |
| NF-SEC-004 | The system must enforce password policies: minimum 12 characters, complexity requirements, 90-day rotation. |
| NF-SEC-005 | Sessions must auto-expire after 30 minutes of inactivity for internal users. |
| NF-SEC-006 | The system must be protected against OWASP Top 10 vulnerabilities. |
| NF-SEC-007 | All PII (personally identifiable information) must be masked in system logs. |

### 7.4 Usability

| Req ID | Requirement |
|--------|-------------|
| NF-UX-001 | The applicant portal must be fully responsive and functional on mobile, tablet, and desktop. |
| NF-UX-002 | The form must support English. Consideration for Filipino (Tagalog) and Samoan localisations in a future phase. |
| NF-UX-003 | Inline help text and tooltips must be present for all non-obvious fields (e.g., "fortnightly," "PEP"). |
| NF-UX-004 | Validation error messages must be clear, specific, and appear adjacent to the relevant field. |

### 7.5 Scalability

| Req ID | Requirement |
|--------|-------------|
| NF-SCA-001 | The architecture must support horizontal scaling to accommodate future growth. |
| NF-SCA-002 | The system must be designed to support multiple loan products (future phases) without core re-architecture. |

---

## 8. Data Requirements

### 8.1 Data Retention

| Data Type | Minimum Retention Period | Basis |
|-----------|--------------------------|-------|
| Loan application (all statuses) | 7 years from decision date | CCCFA s.99 |
| Loan agreements | 7 years from loan closure | CCCFA s.99 |
| Credit reports (Centrix) | 7 years | CCCFA / Privacy Act |
| Affordability assessments | 7 years | CCCFA s.99 |
| Audit logs | 7 years | CCCFA compliance |
| Communications sent | 7 years | CCCFA compliance |
| Draft applications (not submitted) | 30 days from last save | Operational |

### 8.2 Privacy

- The system must comply with the **New Zealand Privacy Act 2020**.
- Applicant data must only be accessible by authorised roles.
- Applicants must be able to request access to their own data.
- The Privacy Policy URL must be surfaced on the application form (www.terepay.co.nz).

---

## 9. Integration Requirements

| System | Integration Type | Purpose |
|--------|-----------------|---------|
| **Centrix** | REST API | Credit report retrieval |
| **Email Service** (e.g., Mailgun, SendGrid) | SMTP/API | Transactional email delivery |
| **SMS Gateway** (e.g., Twilio) | API | Transactional SMS notifications |
| **E-Signature** (e.g., DocuSign, HelloSign) | API | Loan agreement signing |
| **Bank Payment System** (e.g., Windcave, manual) | API or manual trigger | Disbursement confirmation |
| **Direct Debit Processor** | API | Repayment collection |
| **Google Drive** | API | Document storage, retrieval, and organisation by application reference |

---

## 10. CCCFA Compliance Requirements

| Req ID | Compliance Requirement | CCCFA / RLC Reference |
|--------|----------------------|----------------------|
| C-001 | Affordability assessment must be completed for every application before approval | RLC s.7 |
| C-002 | Lender must verify income from an independent source (payslips, bank statements) | RLC s.7.3 |
| C-003 | Lender must use benchmarks when stated expenses appear unrealistically low | RLC s.7.4 |
| C-004 | Loan must not be approved if it would cause substantial hardship (surplus ≤ $0) | CCCFA s.9C |
| C-005 | Lender must obtain credit report and assess existing credit obligations | RLC s.7.5 |
| C-006 | Disclosure Statement must be presented to applicant before or at application | CCCFA s.17 |
| C-007 | Loan Agreement must include all prescribed key terms (APR, total cost, payment schedule) | CCCFA s.17 |
| C-008 | Applicant must consent to credit reporting before credit check is run | Privacy Act / CCCFA |
| C-009 | Decline reasons must be documented and retained | CCCFA s.99 |
| C-010 | All lending decisions, assessment data, and supporting documents must be retained for 7 years | CCCFA s.99 |
| C-011 | Lender must not approve a loan where visa expires before loan completion | RLC — responsible lending principles |
| C-012 | PEP screening must be conducted for AML/CFT compliance | AML/CFT Act 2009 |
| C-013 | Hardship information must be provided with every decline communication | CCCFA s.55 |

---

## 11. Acceptance Criteria Summary

The following high-level acceptance criteria must be met for the system to be considered production-ready:

| # | Acceptance Criterion |
|---|---------------------|
| AC-01 | Applicant can complete, save as draft, and submit a loan application end-to-end on mobile and desktop |
| AC-02 | Draft saving persists data correctly and applicant can resume via email link |
| AC-03 | All Section 1–8 validations function correctly, including visa expiry and age checks |
| AC-04 | Documents can be uploaded, viewed, accepted, and rejected by lenders |
| AC-05 | Application status transitions correctly through all defined states |
| AC-06 | Lender dashboard displays application queue and allows claim/assignment |
| AC-07 | Affordability calculator pre-fills from applicant application, correctly applies catalog benchmarks and household multipliers, calculates surplus, and saves a complete immutable record |
| AC-07a | Benchmark Catalog module allows lender to add, edit, and version benchmark values; assessments reference the catalog version active at time of assessment |
| AC-08 | Hard-decline conditions block approval — system cannot be bypassed |
| AC-09 | Centrix integration retrieves and stores credit report against application |
| AC-10 | Loan Agreement is generated with correct terms, sent for e-signature, and disbursement is blocked until signed |
| AC-11 | All status-triggered notifications are sent within defined SLAs |
| AC-12 | Full audit log is captured for all actions — immutable and exportable |
| AC-13 | System passes basic penetration testing and OWASP checks |
| AC-14 | All application and assessment records are retained per CCCFA 7-year requirement |

---

## Appendix A — Loan Terms Reference

| Parameter | Value |
|-----------|-------|
| Loan Period | 8 weeks (56 days) |
| Payment Frequency | 4 fortnightly payments |
| APR | 49% |
| Interest Rate (8 weeks) | 4.7% |
| Establishment Fee (new customer) | $50 — first loan only |
| Application Fee (repeat customer) | $20 — subsequent loans |
| Minimum Loan | $200 |
| Maximum Loan | $2,000 |
| Repayment Formula | (Loan Amount × 1.047) ÷ 4 |
| FSP Number | FSP1007414 |
| NZBN | 9429052055232 |

---

## Appendix B — Affordability Decision Logic

```
Step 1: Data Completeness Check
  IF days_of_transaction_data < 90 → HARD DECLINE
  IF visa_expiry < (disbursement_date + 56 days + 90 days) → HARD DECLINE

Step 2: Income Verification
  total_verified_income = SUM(lower of centrix_amount vs payslip_amount per category)

Step 3: Expense Verification
  FOR each expense_category:
    final_expense = MAX(stated_expense, benchmark × household_multiplier)
  total_expenses = SUM(all final_expense values)

Step 4: Surplus Calculation
  net_disposable_income = total_verified_income - total_expenses
  loan_fortnightly_payment = (loan_amount × 1.047) / 4
  final_surplus = net_disposable_income - loan_fortnightly_payment

Step 5: Surplus Decision
  IF final_surplus <= 0 → HARD DECLINE
  IF final_surplus < 50 → HIGH RISK — lender must decline unless exceptional
  IF final_surplus 50–100 → MARGINAL — lender must document justification
  IF final_surplus > 100 → PROCEED TO CREDIT CHECK

Step 6: Loan Purpose Check
  IF loan_purpose IN [remittances, visa_fees, celebrations, planned_events] → HARD DECLINE

Step 7: Credit Check
  Run Centrix credit check
  IF recent_defaults (90 days) = YES → HARD DECLINE
  IF multiple_short_term_loans = YES → FLAG for lender review
  IF credit_check_pass = YES → ASSESSOR MAKES FINAL DECISION

Step 8: Final Decision
  Lender approves OR declines with documented rationale
```

---

*Document ends.*

**TerePay Neophile Limited**  
FSP1007414 | NZBN 9429052055232  
27 Henry Partington Place, Greenhithe 0632, New Zealand  
www.terepay.co.nz | info@terepay.co.nz
