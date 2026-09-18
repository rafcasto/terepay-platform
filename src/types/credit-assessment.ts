/**
 * AI credit assessment — queued from the lender's affordability wizard
 * (Results & Decision step) and executed by the credit-assessment worker on
 * the Raspberry Pi (`credit-assessment-agent/console/worker.js`).
 *
 * The site sends **every input the agent needs** in the job payload; the
 * worker only fetches the documents (by Drive id) and runs the pipeline:
 * statement parser → deterministic metrics → rules engine → local LLM analyst
 * note → rules engine again. The decision never depends on the model.
 *
 * Redis key contract (shared with the worker — change both sides together):
 *
 *   assessment:queue        list   job ids, LPUSH here / RPOP by the worker (served before training jobs)
 *   assessment:job:<id>     hash   the job record below
 *   training:worker         string worker heartbeat (shared with model training)
 */

export const CREDIT_ASSESSMENT_PAYLOAD_VERSION = 1 as const;

export type CreditAssessmentDocKind = 'statement' | 'payslip' | 'history' | 'other';

export interface CreditAssessmentDocument {
  /** Google Drive file id inside the application's `app_<id>` folder. */
  driveId: string;
  name: string;
  kind: CreditAssessmentDocKind;
  /** Platform document type the applicant uploaded it as (bank_statement, payslip, …). */
  type: string;
  mimeType?: string;
  size?: number;
}

/** Borrower Behaviour Scorecard items (same keys as the agent's `BEHAVIOUR_KEYS`). */
export const BEHAVIOUR_KEYS = [
  'paid_previous_loan_early',
  'paid_on_time_consistently',
  'communicates_proactively',
  'missed_payments_before',
  'existing_defaults',
  'write_off_history',
  'requests_bigger_loan_too_fast',
  'provides_multiple_excuses',
  'avoids_communication',
] as const;
export type BehaviourKey = (typeof BEHAVIOUR_KEYS)[number];

/** `behaviour_<key>: true|false` — authoritative scorecard ticks from TerePay's own loan history. */
export type BehaviourFlags = Partial<Record<`behaviour_${BehaviourKey}`, boolean>>;

/**
 * Application record exactly as the agent's `normaliseApp()` expects it.
 * Money is NZD. `income` / `expenses` are **monthly** (the agent compares
 * them with the monthly income it observes in the statements).
 */
export interface CreditAssessmentApplicationInput extends BehaviourFlags {
  id: string;
  reference: string;
  applicant_name: string;
  /** Amount under assessment (the lender's working figure, not necessarily the requested one). */
  loan_amount: number;
  /** Annual rate in percent, e.g. 49. */
  interest_rate: number;
  /** Verified monthly net income (wizard Step 3 total × 26 / 12). */
  income: number;
  /** Verified monthly expenses (wizard Step 4 total × 26 / 12). */
  expenses: number;
  /** Total owed across the declared existing debts. */
  existing_debt: number;
  loan_purpose: string;
  /** ISO date the application was submitted. */
  application_date: string;
  household_type: string;
  /** Number of prior TerePay loans the behaviour flags were derived from. */
  loan_history_count: number;
}

/** The affordability figures the lender arrived at, for the audit record and the analyst note. */
export interface CreditAssessmentAffordabilityInput {
  assessed_amount: number;
  requested_amount: number;
  fortnightly_income: number;
  fortnightly_expenses: number;
  fortnightly_loan_payment: number;
  fortnightly_surplus: number;
  household_multiplier: number;
  first_transaction_date: string;
  days_of_transaction_data: number;
}

export interface CreditAssessmentPayload {
  version: typeof CREDIT_ASSESSMENT_PAYLOAD_VERSION;
  application: CreditAssessmentApplicationInput;
  affordability: CreditAssessmentAffordabilityInput;
  documents: CreditAssessmentDocument[];
  /** Drive folder `app_<applicationId>` the documents live in. */
  folderId: string;
  /** Its parent (the KYC / applications root) — the worker refuses files outside it. */
  rootFolderId: string;
}

export type CreditAssessmentJobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export type CreditAssessmentRiskRating = 'Low' | 'Medium' | 'High';
export type CreditAssessmentRecommendation = 'Approve' | 'Conditional' | 'Deny';
export type CreditAssessmentEscalation = 'none' | 'credit_officer' | 'senior_credit_officer' | 'decline';
export type CreditAssessmentExpenseTier = 'Lower' | 'Moderate' | 'High' | 'Critical';
export type CreditAssessmentParserMode = 'deterministic' | 'fallback' | 'none';

export interface CreditAssessmentFactor {
  name: string;
  assessment: string;
  impact: 'Positive' | 'Negative' | 'Neutral';
}

export interface CreditAssessmentRuleHit {
  rule: string;
  value: unknown;
}

export interface CreditAssessmentResult {
  application_id: string;
  risk_rating: CreditAssessmentRiskRating;
  recommendation: CreditAssessmentRecommendation;
  /** 0–100 */
  confidence_score: number;
  escalation: CreditAssessmentEscalation;
  pathway: string;
  expense_risk_tier: CreditAssessmentExpenseTier;
  behaviour_score: number;
  behaviour_tier: string;
  factors: CreditAssessmentFactor[];
  /** Rules-engine header + analyst note (what goes on the file). */
  reasoning: string;
  /** The model's 40–80-word narrative on its own. */
  analyst_note: string;
  /** Verbatim flagged statement lines. */
  evidence: string[];
  data_gaps: string[];
  rule_hits: Record<'immediate_decline' | 'critical' | 'high' | 'moderate', CreditAssessmentRuleHit[]>;
  affordability: {
    declared_surplus: number | null;
    observed_income: number | null;
    income_mismatch_pct: number | null;
    payslip_income: number | null;
    payslip_status: string;
    hold: boolean;
  };
  parser_mode: CreditAssessmentParserMode;
  documents: { name: string; kind: string; transactions: number; unreadable: boolean }[];
  statement: {
    period_days: number | null;
    transactions: number;
    observed_net_monthly_income: number | null;
  } | null;
  model: string;
  framework_version: string;
  llm: { prompt_tokens: number | null; output_tokens: number | null; seconds: number | null; json_repaired: boolean } | null;
  processing_ms: number;
  completed_at: string;
}

export interface CreditAssessmentJob {
  id: string;
  type: 'assess_application';
  applicationId: string;
  status: CreditAssessmentJobStatus;
  payload: CreditAssessmentPayload | null;
  /** Epoch ms */
  createdAt: number;
  /** Lender email that queued the job */
  createdBy: string;
  startedAt?: number;
  endedAt?: number;
  worker?: string;
  progress?: string;
  /** Tail of the worker log */
  log?: string;
  result?: CreditAssessmentResult | null;
  error?: string;
}

/** Compact summary stored on the affordability assessment and the application. */
export interface CreditAssessmentSummary {
  assessmentId: string;
  status: CreditAssessmentJobStatus;
  risk_rating?: CreditAssessmentRiskRating;
  recommendation?: CreditAssessmentRecommendation;
  confidence_score?: number;
  escalation?: CreditAssessmentEscalation;
  expense_risk_tier?: CreditAssessmentExpenseTier;
  behaviour_score?: number;
  parser_mode?: CreditAssessmentParserMode;
  assessed_amount?: number;
  requestedAt: number;
  completedAt?: number;
  error?: string;
}

/** Firestore `creditAssessments/{jobId}` — the CCCFA s.9CA audit record (retain 7 years). */
export interface CreditAssessmentRecord {
  assessmentId: string;
  applicationId: string;
  version: number;
  status: CreditAssessmentJobStatus;
  requestedBy: string;
  requestedByName: string;
  requestedAt: number;
  startedAt?: number;
  completedAt?: number;
  worker?: string;
  inputs: CreditAssessmentPayload;
  result?: CreditAssessmentResult;
  error?: string;
  log?: string;
}
