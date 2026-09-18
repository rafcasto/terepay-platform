# AI Credit Assessment (affordability wizard → Upstash Redis → assessment worker)

The lender's **Affordability assessment → Results & Decision** step carries an *AI Credit Assessment* panel. Pressing
**Run AI assessment** sends the application to the credit-assessment agent on the Raspberry Pi
(`credit-assessment-agent/console/worker.js` + `assess.js`), which parses the applicant's bank statements, applies the
Expense Red Flags checklist, the Client Behaviour thresholds and the Borrower Behaviour Scorecard, has a local model
write a short analyst note, and returns a rated, evidenced recommendation. It is **advisory**: the lender still picks
*Proceed* / *Decline* and owns the reasons (CCCFA s.9CA).

```
Results & Decision panel ──POST /api/applications/[id]/credit-assessment──> assemble ALL inputs
                                                                         │  (missing anything → 422 MISSING_INPUTS, nothing queued)
                                                                         ├─ Firestore  creditAssessments/<jobId>   (inputs on file)
                                                                         └─ Upstash    assessment:queue (LPUSH), assessment:job:<jobId> (hash)
                                                                                    │
                        Raspberry Pi worker  ── RPOP (assessment jobs first) ───────┘
                          validates the payload again · downloads the Drive documents (only from app_<id> inside the KYC root)
                          parse → metrics → provisional rules → llama3.2:3b judgement + note → gated merge → rules engine
                          HSET assessment:job:<jobId> status/log/result
                                                                                    │
panel polls GET …/credit-assessment?jobId= every 4 s ◄──────────────────────────────┘
  first poll that sees a terminal state copies result → creditAssessments/<jobId> + loanApplications.creditAssessment
Submit & Proceed / Submit Decline ──POST …/affordability { creditAssessmentId }──> stored on the affordability assessment
```

## Every input is sent; none is guessed

`src/lib/assessment/inputs.ts` builds the payload and collects every gap into one error
(`{ error: { code: 'MISSING_INPUTS', details: { missing: [...], skippedDocuments: [...] } } }`), which the panel lists.

| Input (agent field) | Source | Missing when |
|---|---|---|
| `applicant_name` | `personalInfo.firstName/lastName` | empty |
| `household_type` | `personalInfo.householdType` | absent |
| `loan_amount` | wizard **Loan Amount Under Assessment** | not a number or outside $200–$2,000 |
| `interest_rate` (% p.a.) | `buildSchedule().annualRate` (collections config) | rate ≤ 0 |
| `income` (monthly) | wizard Step 3 rows → `calcIncomeFinal` × 26 ÷ 12 | no rows, or total ≤ $0 |
| `expenses` (monthly) | wizard Step 4 rows → `calcExpenseFinal` × 26 ÷ 12 | no rows |
| `existing_debt` | Σ `existingDebts.*.totalOwed` (fallback `financialInformation.currentDebts`) | neither present |
| `loan_purpose` | `loanRequest.purpose` / `loanDetails.loanPurpose` | empty |
| `application_date` | `submittedAt` / `timeline.submittedAt` / `timeline.createdAt` | none |
| first transaction date / days of data | wizard Step 2 checklist | date empty |
| `documents[]` | `documents[]` cross-checked against Drive folder `app_<id>` | no non-rejected **bank statement** that is a PDF/CSV/TXT in Drive |
| `behaviour_*` | derived from the applicant's prior disbursed loans (`src/lib/assessment/behaviour.ts`) | never — no history means no ticks |

The agent reasons in **calendar months** while the wizard works in fortnights; the conversion is `× 26 / 12` and the
fortnightly figures are sent alongside (`affordability.*`) for the audit record.

Behaviour ticks derived from TerePay's own repayment history (authoritative for the scorecard):
`paid_previous_loan_early` (an early payoff was paid), `paid_on_time_consistently` (≥ 1 closed loan and never an
overdue / failed instalment, arrears or fee), `missed_payments_before`, `existing_defaults` (a live loan currently
delinquent), `requests_bigger_loan_too_fast` (> 1.5 × the last principal while that loan is live or closed < 90 days).
Communication-style items are left to the model, which may only tick them with evidence in a history document.

## Documents

Only `bank_statement`, `payslip`, `other_income` and `other` uploads are sent — never identity documents. The site
verifies each `documentId` actually sits in the application's Drive folder (`GOOGLE_DRIVE_APPLICATIONS_FOLDER_ID`, or
`GOOGLE_DRIVE_KYC_FOLDER_ID` — the same root the applicant upload route writes to) and passes only Drive ids; the worker
downloads with the shared read-only service account and refuses any file outside that folder. Photos of statements are
skipped (the parser needs a text layer); the panel says so.

## Result

`CreditAssessmentResult` (`src/types/credit-assessment.ts`): `risk_rating` Low/Medium/High, `recommendation`
Approve/Conditional/Deny, `confidence_score`, `escalation`, `expense_risk_tier`, `behaviour_score/tier`, `factors[]`
(engine rule hits first, model context after), `analyst_note`, `evidence[]` (verbatim statement lines, produced by
code), `data_gaps[]`, `rule_hits`, `affordability` (declared vs observed income, payslip reconciliation, `hold`),
`parser_mode` (`fallback` = statements could not be parsed; automatic approval is blocked and confidence ≤ 40).

The panel warns when the result was produced for a different amount than the one now under assessment; the form only
attaches `creditAssessmentId` to the submission when the amounts match. The affordability route re-checks that the id
belongs to the application and is complete before storing `creditAssessmentId` + a `creditAssessment` summary on the
`affordabilityAssessments` document.

## Redis key contract (shared with the worker)

| Key | Type | Purpose |
|---|---|---|
| `assessment:queue` | list | job ids; site `LPUSH`, worker `RPOP` — drained **before** `training:queue` |
| `assessment:job:<id>` | hash | `id type applicationId status payload createdAt createdBy startedAt endedAt worker log result error`, TTL 7 days |
| `training:worker` | string | the one worker heartbeat; the route refuses to queue while it is stale (> 90 s) |

Types: `src/types/credit-assessment.ts` · queue: `src/lib/assessment/queue.ts` · persistence: `src/lib/assessment/persist.ts`.

## Environment

| Where | Variable | Notes |
|---|---|---|
| Vercel + Pi | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | already set for rate limiting / training |
| Vercel + Pi | `GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL`, `…_PRIVATE_KEY` | already set (KYC uploads / training) |
| Vercel | `GOOGLE_DRIVE_KYC_FOLDER_ID` (or `GOOGLE_DRIVE_APPLICATIONS_FOLDER_ID`) | already set — where `app_<id>` folders live |
| Pi | `GOOGLE_DRIVE_KYC_FOLDER_ID` | same id; the worker refuses documents outside it |
| Pi (optional) | `OLLAMA_MODEL` (default `llama3.2:3b`), `LLM_BACKEND`, `ASSESSMENT_LLM_TIMEOUT_MS` | see the agent's `.env.example` |

## Security & compliance

- `POST`/`GET` are `withAuth(request, ['lender'])`, rate limited, and only the **assigned lender** may run or read an
  assessment; the application must be `under_assessment`, `waiting_for_docs` or `credit_check`.
- One assessment at a time per application (409 while one is queued / running).
- Payload is rebuilt server-side from Firestore + the wizard rows; the client's values are recomputed with the same
  shared maths as the affordability submit route.
- Audit log actions: `credit_assessment_requested` (success / failure incl. missing inputs); the affordability
  submission logs `creditAssessmentId`.
- The rules engine decides; the model only writes the note and answers a few gated judgement calls. Nothing about
  a purpose is used as a decline reason — medical / unplanned purposes route to officer review as an income-continuity
  check, per the agent README.
- Records in `creditAssessments` carry the full inputs and result — retain 7 years with the affordability assessment.
