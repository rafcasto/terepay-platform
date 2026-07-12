# Early Repayment — Unearned Interest Rebate

**Status:** DRAFT — pending finance + legal review before production launch.
**Owner of the maths:** [`src/lib/loan/early-payoff.ts`](../src/lib/loan/early-payoff.ts) → `computeEarlyPayoff()`.
**Fee constant:** `EARLY_REPAYMENT_FEE = 25` in [`src/lib/constants/fees.ts`](../src/lib/constants/fees.ts).

This document sets out exactly how the early full-repayment (advance payoff)
amount is calculated, so finance and legal can confirm it meets CCCFA
requirements before we enable it in production. The whole calculation lives in
**one function** so any change agreed in review is a single, isolated edit.

---

## 1. The TerePay product (recap)

- Fixed micro-loan. Interest is **flat**: `LOAN_INTEREST_RATE = 4.7%` charged on
  the approved (financed) amount.
- Repaid in **4 equal fortnightly instalments** over an **8-week (56-day)** term.
- Original pricing (see `POST /api/applications/[id]/decision`):
  - `totalRepayment = approvedAmount × (1 + 0.047)`
  - `fortnightlyPayment = totalRepayment / 4`
  - **Total contractual interest** `I = totalRepayment − approvedAmount = approvedAmount × 0.047`
- The **application fee** ($50 new / $20 existing) is deducted from the
  disbursement — it is **not** part of `totalRepayment` and is **not** touched by
  the payoff calculation.

---

## 2. What we charge on early full repayment

When a borrower settles the whole loan early, we charge:

```
totalPayoff = netOutstanding + prepaymentFee
```

where

```
grossRemaining         = Σ (not-yet-paid instalments)          // principal + interest
unearnedInterestRebate = interest for the period after settlement (refunded)
netOutstanding         = grossRemaining − unearnedInterestRebate
prepaymentFee          = EARLY_REPAYMENT_FEE = $25              // fixed admin fee, non-refundable
```

So the borrower pays: **principal still owed + interest earned up to the
settlement date + a fixed $25 admin fee.** Interest for the future (unearned)
portion of the term is **refunded**.

---

## 3. Unearned interest rebate — the formula under review

Method implemented: **pro-rata time-apportionment (straight-line by elapsed
term).** Identifier in code: `INTEREST_REBATE_METHOD = 'pro_rata_time_apportionment'`.

```
I             = total contractual interest on the loan (NZD)
termDays      = finalDueDate − loanStartDate            // whole days, = 56 for a standard loan
elapsedDays   = clamp(settlementDate − loanStartDate, 0 … termDays)
remainingDays = termDays − elapsedDays

# 3a. Pure time-based unearned interest
timeRebate    = I × (remainingDays / termDays)

# 3b. Safety cap: never rebate more interest than is still sitting in the
#     unpaid instalments (i.e. never refund interest already collected)
N                   = total number of instalments (4)
r                   = number of unpaid instalments remaining
grossFutureInterest = I × (r / N)

unearnedInterestRebate = min( max(timeRebate, 0), grossFutureInterest )
```

**Dates used**
- `loanStartDate` = recorded disbursement date (`timeline.disbursedAt`); if
  absent, it falls back to **one fortnight before the first instalment**
  (the product schedules instalment 1 fourteen days after start).
- `finalDueDate` = due date of the last instalment.
- `settlementDate` = today, NZ calendar date (`Pacific/Auckland`).

**Why the cap (3b)?** With evenly-spaced fortnightly instalments, the pure
time-based figure (3a) and the flat per-instalment interest (`grossFutureInterest`)
are almost identical. The cap guarantees we never refund interest that was
already earned/collected in earlier instalments, so `netOutstanding` can never
drop below the principal the borrower still owes.

**Rounding:** all money is rounded to 2 dp (cents) at each step;
`*_Cents` values are the integer cents actually sent to the bank via Qippay PayBy.

---

## 4. Worked examples

Assume `approvedAmount = $500`, so `I = $500 × 0.047 = $23.50`,
`totalRepayment = $523.50`, `fortnightlyPayment = $130.875 ≈ $130.88`,
`termDays = 56`, `N = 4`.

### Example A — settle right after instalment 2 (day 28), 2 instalments left
- `grossRemaining = 2 × 130.875 = $261.75`
- `remainingDays = 56 − 28 = 28` → `timeRebate = 23.50 × 28/56 = $11.75`
- `grossFutureInterest = 23.50 × 2/4 = $11.75` → cap not binding
- `unearnedInterestRebate = $11.75`
- `netOutstanding = 261.75 − 11.75 = $250.00`
- **`totalPayoff = 250.00 + 25.00 = $275.00`**

### Example B — settle on day 20 (nothing paid yet, all 4 left)
- `grossRemaining = 4 × 130.875 = $523.50`
- `remainingDays = 56 − 20 = 36` → `timeRebate = 23.50 × 36/56 = $15.11`
- `grossFutureInterest = 23.50 × 4/4 = $23.50` → cap not binding
- `unearnedInterestRebate = $15.11`
- `netOutstanding = 523.50 − 15.11 = $508.39`
- **`totalPayoff = 508.39 + 25.00 = $533.39`**

### Example C — settle on the final due date (day 56)
- `remainingDays = 0` → `unearnedInterestRebate = $0.00`
- borrower pays the remaining balance in full + $25 fee (no interest to refund).

---

## 5. Audit trail

At initiation we snapshot the **full working** onto the application record at
`earlyRepayment.quote` (see `EarlyRepaymentQuote.rebateBreakdown`): method,
`totalInterest`, `termDays`, `elapsedDays`, `remainingDays`,
`grossFutureInterest`, `loanStartDate`, `finalDueDate`, `settlementDate`, and
every money figure in cents. The `early_repayment_initiated` audit-log entry
records the payoff, rebate and fee. This gives a defensible per-transaction
record for dispute resolution.

---

## 6. Questions for finance / legal

1. **Method.** Is pro-rata time-apportionment acceptable, or does the product
   require the **actuarial method** or another CCCFA-prescribed calculation for
   full prepayment (CCCFA 2003 ss 50–56 and the Credit Contracts and Consumer
   Finance Regulations)? The method is a single constant + formula to swap.
2. **Fee.** Is a fixed **$25** prepayment fee a "reasonable estimate of the
   creditor's loss / administrative cost" under the CCCFA, or should it be a
   formula (e.g. capped %)? It is a single constant (`EARLY_REPAYMENT_FEE`).
3. **Interest base.** Confirm interest is charged only on `approvedAmount` (not
   on the application fee), as the pricing implies.
4. **Loan start date.** Confirm using `timeline.disbursedAt` (fallback: first
   instalment − 14 days) as the accrual start is correct.
5. **Disclosure.** Confirm the borrower-facing wording in the payoff card and
   the return page meets CCCFA disclosure requirements.

Until sign-off, keep this behind the existing feature gating and `QIPPAY_MODE`
controls; do not enable early repayment in production.
