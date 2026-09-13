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
