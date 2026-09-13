/**
 * Model-training jobs — queued by the admin console into Upstash Redis and
 * executed by the credit-assessment worker on the Raspberry Pi
 * (`credit-assessment-agent/console/worker.js`). The Redis key contract is
 * shared with that worker; change both sides together.
 *
 *   training:queue        list   job ids, LPUSH here / RPOP by the worker (FIFO)
 *   training:jobs         zset   job ids scored by createdAt (listing)
 *   training:job:<id>     hash   the job record below
 *   training:worker       string worker heartbeat JSON, expires after 120 s
 *   training:state        string worker-published snapshot (dataset, models, exams)
 */

export type TrainingJobType =
  | 'import_batch'
  | 'import_outcomes'
  | 'backtest'
  | 'build_dataset'
  | 'finetune'
  | 'exam'
  | 'regenerate_synthetic';

export type TrainingJobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface TrainingJob {
  id: string;
  type: TrainingJobType;
  status: TrainingJobStatus;
  payload: Record<string, unknown>;
  /** Epoch ms */
  createdAt: number;
  /** Admin email that queued the job */
  createdBy: string;
  startedAt?: number;
  endedAt?: number;
  worker?: string;
  progress?: string;
  /** Tail of the worker log (≤ ~12 kB) */
  log?: string;
  result?: unknown;
  error?: string;
  /** 1 when cancellation has been requested */
  cancel?: number;
}

export interface TrainingWorkerHeartbeat {
  id: string;
  host: string;
  pid: number;
  version: string;
  startedAt: number;
  at: number;
  current: string | null;
  pollMs: number;
  /** Worker has Google Drive credentials configured */
  drive: boolean;
}

export interface TrainingDatasetInfo {
  stats: { examples: number; synthetic: number; edited: number; rejected: number; real_labelled: number; exam_cases: number; built_at: string } | null;
  has_train: boolean;
  has_exam: boolean;
  reviews: number;
  /** Real cases with an officer label (fine-tune input) */
  real: number;
  /** Real cases imported and analysed */
  real_cases: number;
}

export interface TrainingState {
  dataset: TrainingDatasetInfo;
  models: { name: string; size_gb: number; modified: string }[];
  exams: Record<string, unknown>[];
  backtest: { total: number; with_outcome: number; base_bad_rate: number | null; by_recommendation: Record<string, { n: number; bad: number; bad_rate: number | null }> } | null;
  settings: { gpu_mode: string; base_model: string; ollama_name: string; epochs: number; ssh_host_set: boolean; local_gpu: boolean };
  updatedAt: number;
}

export type TrainingDriveKind = 'folder' | 'zip' | 'csv' | 'other';

export interface TrainingDriveEntry {
  id: string;
  name: string;
  kind: TrainingDriveKind;
  size: number | null;
  modifiedTime: string | null;
}

export const TRAINING_JOB_LABELS: Record<TrainingJobType, string> = {
  import_batch: 'Import cases',
  import_outcomes: 'Import outcomes CSV',
  backtest: 'Backtest',
  build_dataset: 'Build dataset',
  finetune: 'Fine-tune',
  exam: 'Exam',
  regenerate_synthetic: 'Regenerate synthetic cases',
};

// ---------------------------------------------------------------------------
// Console data (served by the worker over the Redis request/reply channel)
// ---------------------------------------------------------------------------

/** Document kinds the trainer understands. `centrix` is stored as credit history. */
export type TrainingDocKind = 'statement' | 'payslip' | 'history' | 'centrix' | 'other';

export const TRAINING_DOC_KINDS: { kind: TrainingDocKind; label: string; hint: string; accept: string }[] = [
  { kind: 'statement', label: 'Bank statements', hint: 'Every statement held at decision time — all accounts, all months (PDF, TXT or CSV export)', accept: '.pdf,.txt,.csv' },
  { kind: 'payslip', label: 'Payslips', hint: 'Whatever payslips were actually supplied (PDF or TXT)', accept: '.pdf,.txt' },
  { kind: 'centrix', label: 'Centrix credit history', hint: 'Centrix / bureau report — read for the Borrower Behaviour Scorecard (PDF or TXT)', accept: '.pdf,.txt' },
  { kind: 'history', label: 'TerePay loan history notes', hint: 'Internal notes on prior loans, if any (PDF or TXT)', accept: '.pdf,.txt' },
];

/** Booleans the model may set; an officer label uses the same keys. */
export const TRAINING_JUDGEMENT_KEYS = [
  'income_matches_declared',
  'bnpl_used_for_essentials',
  'bnpl_cycling',
  'credit_paying_credit',
  'chaotic_spending',
  'remittances_crisis_driven',
  'remittances_undisclosed_obligation',
  'remittances_sent_while_bnpl_for_basics',
  'luxury_while_bnpl_basics',
  'medical_expense_explained',
] as const;
export type TrainingJudgementKey = (typeof TRAINING_JUDGEMENT_KEYS)[number];

/** Borrower Behaviour Scorecard ticks (+ / −). */
export const TRAINING_BEHAVIOUR_KEYS: { key: string; label: string; positive: boolean }[] = [
  { key: 'paid_previous_loan_early', label: 'Paid previous loan early', positive: true },
  { key: 'paid_on_time_consistently', label: 'Paid on time consistently', positive: true },
  { key: 'communicates_proactively', label: 'Communicates proactively', positive: true },
  { key: 'missed_payments_before', label: 'Missed payments before', positive: false },
  { key: 'existing_defaults', label: 'Existing defaults', positive: false },
  { key: 'write_off_history', label: 'Write-off history', positive: false },
  { key: 'requests_bigger_loan_too_fast', label: 'Requests bigger loan too fast', positive: false },
  { key: 'provides_multiple_excuses', label: 'Provides multiple excuses', positive: false },
  { key: 'avoids_communication', label: 'Avoids communication', positive: false },
];

export const TRAINING_OUTCOMES = ['unknown', 'repaid', 'repaid_late', 'arrears', 'default', 'written_off', 'current', 'declined'] as const;
export type TrainingOutcome = (typeof TRAINING_OUTCOMES)[number];
export const TRAINING_DECISIONS = ['', 'approved', 'conditional', 'declined'] as const;

/** Declared figures + outcome for one case — mirrors `application.json` on the worker. */
export interface TrainingApplication {
  id?: string;
  applicant_name?: string;
  application_date?: string;
  loan_amount?: number | null;
  interest_rate?: number | null;
  income?: number | null;
  expenses?: number | null;
  existing_debt?: number | null;
  loan_purpose?: string;
  decision_made?: string;
  decision_by?: string;
  outcome?: string;
  max_days_late?: number | null;
  outcome_notes?: string;
  [behaviour: `behaviour_${string}`]: boolean | undefined;
}

export interface TrainingCaseSummary {
  id: string;
  mode: 'deterministic' | 'fallback' | 'none';
  transactions: number;
  dated_lines: number;
  docs: Record<string, number>;
  decision: string;
  income: number | null;
  payslip: string | null;
  unclassified: number;
  labelled: boolean;
  outcome: string;
  decision_made: string;
  notes: string[];
}

export interface TrainingLabel {
  judgements: Record<string, boolean>;
  behaviour: string[];
  analyst_note: string;
  confidence: number;
  data_gaps: string[];
  officer: string;
  labelled_at?: string;
}

export interface TrainingCaseDetail {
  id: string;
  analysis: {
    mode: string;
    documents: { file: string; original: string; kind: string; chars: number; transactions: number; unreadable: boolean }[];
    parser: { transactions: number; dated_lines_in_text: number; notes: string[]; statements: { fileName: string; transactions: number; notes?: string[] }[] };
    categories: Record<string, number>;
    unclassified: { date: string; desc: string; amount: number }[];
    payslips: Record<string, unknown> | null;
    metrics: Record<string, unknown> | null;
    findings: {
      risk_rating: string;
      recommendation: string;
      expense_risk_tier: string;
      escalation: string;
      behaviour_score: number;
      behaviour_tier: string;
      rule_hits: Record<string, { rule: string; [k: string]: unknown }[]>;
      affordability: Record<string, unknown>;
      factors: string[];
      confidence: number;
      header: string;
    };
    evidence: string[];
    brief: string | null;
    transactions: { date: string; desc: string; amount: number; balance?: number; category?: string }[];
    analysed_at: string;
  };
  application: TrainingApplication;
  label: TrainingLabel | null;
  text: string;
}

export interface TrainingBacktestBucket { n: number; bad: number; repaid_late: number; bad_rate: number | null }
export interface TrainingBacktest {
  total: number;
  with_outcome: number;
  base_bad_rate: number | null;
  by_tier: Record<string, TrainingBacktestBucket>;
  by_recommendation: Record<string, TrainingBacktestBucket>;
  by_terepay_decision: Record<string, TrainingBacktestBucket>;
  triggers: { trigger: string; n: number; bad: number; bad_rate: number }[];
  would_approve_but_bad: TrainingBacktestRow[];
  would_deny_but_repaid: TrainingBacktestRow[];
  outcomes: Record<string, number>;
  rows: TrainingBacktestRow[];
}
export interface TrainingBacktestRow {
  id: string; tier: string; recommendation: string; risk: string; mode: string; decision_made: string; outcome: string;
  max_days_late: number | null; loan_amount: number | null; purpose: string; triggers: string[];
}

export interface TrainingGoldRow { id: string; profile: string; decision: string; status: string; words: number }
export interface TrainingGoldList { rows: TrainingGoldRow[]; total: number; counts: Record<string, number>; profiles: string[] }
export interface TrainingGoldCase {
  case: { id: string; profile: string; user: string; decision: string; triggered: string[]; gold: { judgements: Record<string, boolean>; behaviour: string[]; analyst_note: string; confidence: number; data_gaps: string[] } };
  review: { status: string; gold: TrainingGoldCase['case']['gold']; officer: string; reviewed_at: string } | null;
}

export interface TrainingExamSummary {
  file: string; model?: string; cases?: number; avg_secs?: number; json_valid?: number; json_repaired?: number;
  judgement_precision?: number; judgement_recall?: number; behaviour_f1?: number; note_length_ok?: number;
  finding_coverage?: number; contradictions?: number; invented_numbers?: number; conclusion_consistent?: number; total_min?: number;
}

export interface TrainingSettings {
  gpu_mode: 'ssh' | 'local';
  ssh_host: string; ssh_user: string; ssh_key: string; remote_dir: string;
  base_model: string; ollama_name: string; epochs: number; local_gpu: boolean;
}

export type TrainingRpcOp =
  | 'cases.list' | 'cases.get' | 'cases.label' | 'cases.reanalyse' | 'cases.delete'
  | 'backtest.get' | 'gold.list' | 'gold.get' | 'gold.review' | 'dataset.get'
  | 'exams.list' | 'exams.get' | 'settings.get' | 'settings.set' | 'prompts.list' | 'ping';

/** Ops only an admin may call. Trainers (lenders with access) get everything else. */
export const TRAINING_ADMIN_ONLY_OPS: TrainingRpcOp[] = ['settings.set', 'cases.delete'];
export const TRAINING_MUTATING_OPS: TrainingRpcOp[] = ['cases.label', 'cases.reanalyse', 'cases.delete', 'gold.review', 'settings.set'];
