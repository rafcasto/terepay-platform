# TerePay — response to Qippay integration review

Prepared for Qippay's merchant-readiness review of TerePay's SetPay and PayBy integration. Every statement reflects the code on the `dev` branch as of this document. Items marked **Evidence** are things we will attach from a UAT run against Qippay's sandbox.

---

## 0. How TerePay uses each Qippay product

| Product | Used for | Who initiates | Frequency |
|---|---|---|---|
| **SetPay** (enduring payment consent) | Collecting the **scheduled loan instalments** (4 × fortnightly) | The customer authorises the consent **once** at their bank; TerePay then lodges each instalment against it | One consent per loan |
| **PayBy** (one-off payment) | An **optional early payoff** of the whole remaining balance | The customer, from their application page, if and when they choose | At most once per loan |

Loan instalments are never PayBy payments and customers never initiate instalments themselves. PayBy is only ever a voluntary, single, customer-initiated payoff.

---

## 1. Customer-facing journeys

### 1.1 PayBy — optional early repayment

**Do customers initiate each payment individually?** Only this one, optional payment. The borrower opens their application, sees the *Early repayment* card with a server-calculated payoff quote (outstanding balance − unearned-interest rebate + $25 prepayment fee + any arrears charges), accepts the advance-payment terms, and clicks *Pay by bank with Qippay*. The regular instalment schedule is unaffected by whether they do this.

**How are customers notified / is there a reminder or link?** Not applicable — there is no due date for an early payoff and no reminder is sent. The payment is started from within the authenticated app, never from an emailed link.

**How is the payment request triggered and communicated?** `POST /v1/payment_initiation` (NZD amount, `success_url`, `failure_url`, customer IP/UA, `merchant_customer_identification`, statement fields `TerePay / PAYOFF / <loan ref>`, `expires_at` = +24 h). The customer then enters their mobile number and picks a bank in-app (`POST /v1/pay` — CIBA push, handoff, or redirect) or is sent to the Hosted Payment Page. Our return page confirms via `GET /v1/payment_status/{id}` and polls while `pending`.

**If the customer doesn't complete it?** Nothing adverse happens. The PayBy payment expires after 24 h, the loan stays open, and the SetPay schedule continues unchanged; they can start another payoff later. On `success` we mark every remaining instalment paid, close the loan, and call `POST /v1/enduring_initiation/cancel` so no further SetPay instalments are collected.

### 1.2 SetPay — complete payer journey

| # | Where | Customer sees / what happens |
|---|---|---|
| 1 | Applicant app | Accepts the loan offer. The lender's **Disburse** action is locked until the repayment authority is active. |
| 2 | Applicant app — *Authorise your repayments* card | Lists every instalment (date, amount) and total, with the copy: *"Before funds can be released, your bank needs to authorise the fortnightly repayments using Pay by bank with Qippay. **You approve this once** in your own banking app — it lets TerePay collect each of the 4 instalments below on its due date, and you won't be asked to approve them one by one. No money moves at this step."* The intro explains the bank will show the payee, amount per fortnight, number of payments and end date, and that the authority can be cancelled at any time in their banking app or by contacting us. A SetPay-specific FAQ (*Do I approve every repayment? Can I cancel the authority?*) sits under the button. *"All loans are charged interest. Applications can be declined and terms apply."* |
| 3 | `POST /v1/enduring_initiation` | Consent terms: `frequency_period: Fortnightly`, `frequency_total_amount` = one instalment, `total_amount` = total repayable, `total_count` = number of instalments, `from_date_time` = today, `to_date_time` = last due date + 7 days, `merchant_customer_identification` = customer id, `metadata.applicationId`. Banks fetched from `GET /v1/payment_providers`. |
| 4 | Bank picker | Customer chooses their bank (alphabetical, per brand guide) and confirms their **mobile number** (pre-filled, normalised to `+64-…`). |
| 5 | `POST /v1/approve_enduring` | **CIBA**: *"We've sent the request to [Bank]. Approve it in your banking app — this page refreshes automatically."* **Redirect**: customer is sent to the bank. |
| 6 | **Bank** | Customer authorises the enduring consent in their banking app / online banking, seeing payee, per-period limit, frequency, total/count and expiry as supplied in step 3. |
| 7 | Return page | Reconciles via `GET /v1/enduring_initiation/{epcId}`. **Active** → *"Bank authorisation complete — your fortnightly repayments are set up with Pay by bank with Qippay. Your lender can now release the loan funds."* **Failed / expired / cancelled** → *"Bank authorisation not completed"* with a retry path. **Pending** → spinner + poller. The bank-verified account number is stored (encrypted) and replaces any self-declared number (audited). |
| 8 | Lender app | Disburses. `scheduleInstallments()` lodges each instalment with `POST /v1/setpay` (`scheduled_for`, exact amortised amount, `max_retry: 4`, `success_url`/`failure_url` for Qippay's hosted fallback page). Instalments whose rolling period hasn't opened stay pending and are lodged by the daily backfill. |

**Evidence:** screen recording of steps 2–7 on UAT including the bank's consent screen; the consent object from Qippay for that run.

### 1.3 SetPay — authorisation and UX checks

| Item | Response |
|---|---|
| **Repayment dates and amounts** | 4 × $130.93 = **$523.72** = the consent's `total_amount`; `frequency_total_amount` = $130.93 per fortnightly period; `total_count` = 4. Each `/v1/setpay` instalment is lodged with the exact amortised amount from the same schedule the customer authorised. **Evidence:** consent `consent_overall_status` (`count_scheduled`, `amount_scheduled`) for the UAT loan. |
| **Automatic payment authorisation** | Fixed. The consent card now states *"You approve this once … you won't be asked to approve them one by one"* in the header, the intro, the confirm step and the FAQ (*"Do I approve every repayment? No…"*). The generic one-off-payment FAQ ("you approve every payment") is no longer shown on the consent step — it remains only on the PayBy early-repayment card, where it is accurate. |
| **Payment recipient and consent limits** | Sent on the consent (beneficiary TerePay, per-period limit, frequency, total, count, from/to) and shown to the customer by their bank; the card tells them to expect these on the bank screen. **Evidence:** bank consent screenshot. |
| **Revocation of authority** | *Customer information:* the consent card, the FAQ and the post-authorisation state all say the authority can be cancelled at any time in the banking app or by contacting TerePay, and that the loan and due dates still stand. *Enforcement:* `enduring.status.revoked` (webhook) **and** the daily status poll both mark the consent `cancelled` and every unpaid instalment `cancelled`; the scheduler refuses to lodge against any non-active consent, so a revoked authority can never be used for a further payment. *Notification:* the customer receives one email ("Your repayment authority was cancelled") explaining that no further instalments will be collected, that the loan is unchanged, how to set up another way to pay, and the hardship contact. The assigned lender sees the loan flagged and follows up. |
| **Loan summary figures** | Relabelled. The summary is now two clearly separated groups: *Loan amount $500.00 → Application fee − $20.00 (deducted from the loan before payout — not part of your repayments) → **Paid to your account $480.00***, then *Interest → **You repay $523.72** (4 fortnightly instalments of $130.93 — loan amount plus interest) → Total cost of borrowing $543.72 (repayments plus the application fee)*. The hero tiles read "Paid to your account" and "Application fee (deducted)". |
| **Credit disclosures and lending terms** | Confirmed. TerePay is the registered financial service provider and lender of record and owns all CCCFA obligations: initial and variation disclosure, affordability and suitability assessment, fee and interest disclosure, hardship, complaints and dispute resolution. Qippay is the payment rail only; no lending-compliance review is required from Qippay. |

---

## 2. Technical readiness

### 2.1 Payment statuses and webhooks

**Source of truth is Qippay's status endpoint, not the webhook.** Webhooks accelerate updates; a daily reconciliation guarantees convergence even if every webhook is lost.

| Event | Handling (`POST /api/webhooks/qippay`) | TerePay state |
|---|---|---|
| `payment.status.success` | Reads `GET /v1/enduring_initiation/{epcId}/status`, takes `count_complete`, marks every instalment with `installmentNumber ≤ count_complete` as `success` (handles several settlements between events) | instalment → **success** |
| `setpay.status.retry` | Next outstanding instalment → `retrying`, `retryCount++` | lender sees *Retrying ×N* |
| `setpay.status.failure` | Next outstanding instalment → `failed`, reason recorded | arrears flow (§3) |
| `enduring.status.revoked` | Consent → `cancelled`; unpaid instalments → `cancelled`; customer emailed once | no further lodging possible |
| `enduring.status.success` / `.cancelled` | Audit-logged (consent state is owned by the redirect/return flow) | — |
| Unknown event | Audit-logged, `200 { received:false, reason }` | — |

- **Signature:** HMAC-SHA256 over `${x-timestamp}.${rawBody}`, constant-time compared with `x-signature`. Invalid → **401** (the only non-2xx we return). Secret and on/off toggle live in admin integration settings.
- **Responses:** always **200** once verified — even on an internal processing error (which is logged and audited) — so Qippay never retries indefinitely. Feature-flag-off or receiver-disabled → `200 { received:false }`.
- **Pending:** instalment lodged (`scheduled`) but `count_complete` not yet reached.

**Delayed or missed webhooks — reconciliation**

1. **Daily reconciliation sweep** (`/api/cron/payment-refresh`, Vercel cron, once per day at an admin-set NZT hour): every loan with an active consent is checked against `GET …/status`; instalments advance to `success` by `count_complete`, `revoked` is detected, then the arrears engine runs. Admin can run the same sweep on demand ("Verify now").
2. **Lender on-demand** *Check Status* on the loan page runs the same reconciler.
3. **Customer return pages** reconcile consent / PayBy status on landing and poll while pending.
4. **Daily backfill** (`/api/cron/schedule-payments`) lodges pending instalments whose period has opened and retries earlier lodgement errors.

All reconcilers are idempotent: terminal states are never overwritten, transitions are forward-only, and a 10-second freshness window prevents polling storms.

**Who handles discrepancies and exceptions?** The **assigned lender** owns the loan: the Scheduled Payments panel shows each instalment's state, Qippay payment id, retry count and the exact upstream failure reason (including Qippay's `trace_id` for escalation to Qippay support). **TerePay admin** owns the integration (webhook secret/toggle, sweep schedule, UAT test cadence). Every transition — webhook, poll or manual — is written to the audit log with actor, IP, mandate id and before/after state.

### 2.2 Duplicate payments, retries and errors

| Protection | Mechanism |
|---|---|
| No duplicate consents | `consent/initiate` runs in a database transaction; if a non-terminal consent exists it **returns the existing mandate**. Only `failed/expired/cancelled` consents can be re-initiated; previous attempts are archived on the application. `consent/approve` returns `alreadyActive` for an active consent. |
| No duplicate instalment lodgement | Only instalments in `pending` are sent to `/v1/setpay`; once lodged the instalment stores `qippayPaymentId`, `scheduledAt`, `scheduleAttempts` and is never re-sent. Lodging is sequential, lowest instalment first. Past-due instalments are not lodged. |
| No duplicate PayBy payoff | `early-repayment/initiate` resumes an in-flight payment (returns the same hosted URL); a repaid loan refuses. The payoff is applied exactly once (terminal check inside the transaction). |
| No double collection after payoff | On PayBy `success` the consent is marked cancelled locally **first**, then cancelled at Qippay (`/v1/enduring_initiation/cancel`, which also cancels lodged instalments). If the upstream cancel fails it is audited for ops follow-up, and the scheduler is already blocked. |
| Server-side amounts | Payoff and instalment amounts are computed server-side; client-supplied amounts are never trusted. |
| Qippay-side retries | `max_retry: 4` per instalment (within the instalment's period). TerePay never auto-re-lodges a failed instalment — resolution moves to the arrears flow, so a customer is never debited twice for one instalment. |
| Auth + rate limiting | Every payment route is behind session auth with ownership checks and the stricter payment rate limiter. |

**Timeouts, errors and interrupted journeys**

- Every Qippay call has an **8 s timeout**. Network errors / 5xx → "Bank payment service temporarily unavailable" (HTTP 502); 4xx → mapped bad-request error. Raw upstream bodies are logged server-side only and never returned to the customer; Qippay's `trace_id` is persisted on the affected instalment.
- Customer abandons the bank step: the consent stays non-terminal; the return page or next page load reconciles it; after Qippay's expiry the card offers "try again" (new consent; the old attempt is archived).
- Lodgement error: the instalment stays `pending` with the reason; the daily backfill and the lender's *Schedule now* retry it.
- Webhook payloads carry only `epcId` (no event id), so de-duplication relies on idempotent, forward-only state transitions rather than an event-id ledger.

**Test evidence:** `QIPPAY_MODE=stub` exercises the full flow deterministically offline; the admin **SetPay Testing** page (non-production only) compresses the fortnightly cadence to minutes so consent → disbursement → 4 collections → closure can be demonstrated end to end, with "Verify now" running the production sweep. Unit tests cover the collections / arrears engine. **Evidence:** audit-log export from a sandbox run showing `setpay_payments_scheduled`, `setpay_payment_success`, `setpay_payment_retry`, `setpay_payment_failed`, `payment_consent_revoked`, `consent_revoked_notice_sent`.

---

## 3. Payment schedules and notifications

**Confirmed: TerePay maintains the payment schedule, the records and all customer notifications.** Qippay holds only the consent and the individual instalments TerePay lodges.

**Schedule maintenance and instruction initiation (SetPay)**

1. The schedule is computed at offer (reducing-balance amortisation), frozen on the consent as the authorised schedule, and authorised by the bank as a whole.
2. At disbursement each instalment is lodged individually via `POST /v1/setpay` (`scheduled_for` = due date, amount, statement fields `TerePay / Inst<n> / <ref>`). Instalments whose rolling period isn't open yet are lodged by the daily backfill cron.
3. Collection results flow back via webhook + daily reconciliation into the instalment record, then into the canonical loan record, PDF statements and the lender's portfolio.

**Notifications** — email, one per stage per instalment, de-duplicated; every email keeps interest and fees visible and links hardship and dispute contacts:

| Stage | When | Content |
|---|---|---|
| Upcoming payment | 1–3 days before due (every instalment) | Amount, date, "will be collected automatically from your linked bank account under the repayment authority you approved — please ensure funds" |
| Payment missed | day 1 overdue | "We were unable to collect… we'll keep trying over the next few days; interest accruing" |
| Late-fee warning | end of 3-day grace | "$10 late fee applies if not paid" |
| Late fee charged | day 4 | "$10 late fee applied; $25 default fee if more than 7 days overdue" |
| Default warning | day 6 | "Avoid the $25 default fee; hardship help available" |
| Authority cancelled | on revocation | "No further instalments can be collected; loan unchanged; here's how to keep paying" |

The **upcoming-payment reminder is sent for every instalment**, 1–3 days before it is collected, by the daily sweep — this does not depend on any configuration. The wording reflects how the loan is collected: with an active repayment authority it says the instalment *"will be collected automatically from your linked bank account under the repayment authority you approved"*; a loan being repaid directly to TerePay is told to pay by the due date instead. The overdue sequence and fees come from the arrears engine, which runs automatically in the sweep when automatic arrears is enabled and can also be run per loan by the assigned lender (*Assess arrears now*). Every reminder is de-duplicated per instalment and stage, so a customer never receives the same notice twice.

### Playbook — changed, cancelled and failed payments

| Scenario | Detection | Automatic handling | Lender / ops | Customer comms |
|---|---|---|---|---|
| **Instalment fails** (e.g. insufficient funds) | `setpay.status.retry` (Qippay retries daily, up to 4 within the period) → `setpay.status.failure`; also the daily poll | Instalment `retrying` → `failed`; daily interest on the unpaid balance; $10 late fee after 3-day grace (capped $40 per loan); $25 default fee after 7 days | Lender sees *Failed* + reason; contacts the customer; can record a manual bank transfer; can agree a hardship arrangement | Missed → late-fee warning → late fee charged → default warning emails. Qippay's hosted fallback page (`success_url` supplied) lets the customer pay the failed instalment from another account. |
| **Authority revoked by customer** | `enduring.status.revoked` or daily poll | Consent `cancelled`; unpaid instalments `cancelled`; no further lodging possible; loan stays open | Lender contacts the customer to set up a new authority or manual repayments; arrears engine continues on the original due dates | "Your repayment authority was cancelled" email (once per authority) with next steps and hardship contact |
| **Authority fails / expires before disbursement** | Return page / status poll | Consent `failed`/`expired`; disbursement stays locked | None required | Card: "Your previous authorisation wasn't completed. You can try again." |
| **Instalment could not be lodged** (Qippay error, period not open) | Lodgement result | Stays `pending` with reason + Qippay trace id; daily backfill retries | *Schedule now*; escalate to Qippay support with the trace id if persistent | None (not customer-caused) |
| **Early payoff (PayBy)** | Return page / poll | Loan closed, instalments settled, consent cancelled at Qippay | Confirm the cancel audit entry; cancel manually at Qippay if it reports failure | Return-page confirmation; closure letter available |
| **Schedule change** (date or amount variation) | Lender-initiated | A SetPay authority's limits are fixed, so a variation is handled as: lender agrees the new terms and issues CCCFA variation disclosure → lender records the variation → existing authority is cancelled → customer completes a new authority for the revised schedule from their application page (same journey as §1.2) → new instalments lodged. Until the new authority is active, repayments are recorded manually by the lender. | Lender runs the procedure above | Variation disclosure + instruction to complete the new authority |
| **Webhook outage** | Nothing received | Daily sweep converges within 24 h; lender *Check Status* at any time | Admin *Verify now* | None needed |

---

## 4. Evidence pack (to attach)

1. Screen recording / screenshots of the full SetPay journey on UAT: consent card → bank picker + mobile → CIBA push or bank redirect → **bank consent screen** (payee, limit, frequency, total/count, expiry) → return page.
2. Qippay-side consent for that run showing `frequency_period`, `frequency_total_amount`, `total_amount`, `total_count`, `from/to_date_time` matching 4 × $130.93.
3. Audit-log export from a test-cadence run: scheduled → success / retry / failure / revoked / revoked-notice-sent.
4. Lender Scheduled Payments panel showing scheduled, retrying, failed and success rows.
5. Samples of the six customer emails.
6. PayBy early-repayment card and return page.
