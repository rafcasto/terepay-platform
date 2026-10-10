# Model Training (site console → Upstash Redis → assessment worker)

The **Model Training** console replaces the LAN-only trainer console that used to run on the Raspberry Pi. It is
available at `/admin/training` (admins) and `/lender/training` (lenders an admin has granted **Model training
access** to on the Users page — a Firestore flag `users/{uid}.trainingAccess`, applied immediately, no re-login).
Nothing heavy runs on Vercel: the site queues *messages* and the Pi does the work.

Tabs mirror the old console: **Cases** (upload one case, batch import from Drive, case list → findings, figures,
officer label), **Backtest**, **Gold review**, **Dataset & fine-tune**, **Exams**, **Jobs**, **Settings** (admin).

```
browser ──> /api/training/jobs (POST) ──────────────> Upstash Redis  training:queue   (LPUSH)   long jobs
browser ──> /api/training/rpc  (POST) ──────────────> Upstash Redis  training:rpc     (LPUSH)   quick reads/writes
                                                       worker replies  training:rpc:<id> (SET, EX 60)
                                                            │
   Raspberry Pi: credit-assessment-agent/console/worker.js  ┘ RPOP every 5 s, no inbound port needed
        │  pulls data from the Google Drive training folder (service account, read-only)
        │  runs the same functions as the trainer console (import, backtest, dataset, fine-tune, exam)
        └─ HSET training:job:<id>  status / log tail / result   <── page polls GET /api/admin/training/jobs
```

## Why Upstash Redis and Google Drive

- The Pi sits behind NAT. Upstash is reached over HTTPS from both sides, so the Pi **pulls** work and pushes
  status; the site never needs a route into the office network.
- Vercel functions cap request bodies at ~4.5 MB. Historical batches are bigger, so the admin uploads to a
  **shared Google Drive folder** and the site only lists it; the worker downloads directly with the same service
  account the site already uses for KYC documents.
- The site already had `@upstash/redis` (rate limiting) and `googleapis` — no new dependencies.

## Environment variables

| Where | Variable | Notes |
|---|---|---|
| Vercel + Pi | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Same database on both sides (already set on Vercel for rate limiting) |
| Vercel + Pi | `GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY` | Already set on Vercel; copy to the Pi `.env` |
| Vercel | `GOOGLE_DRIVE_TRAINING_FOLDER_ID` | Folder shared with the service account (Viewer is enough). The page refuses to queue anything outside it. |
| Pi (optional) | `GOOGLE_DRIVE_TRAINING_FOLDER_ID` | If set, the worker also refuses items outside the folder |

## Redis key contract (shared with `console/worker.js`)

| Key | Type | Purpose |
|---|---|---|
| `training:queue` | list | job ids; site `LPUSH`, worker `RPOP` (FIFO) |
| `training:jobs` | zset | job ids scored by `createdAt` for listing (latest 50 shown) |
| `training:job:<id>` | hash | `id type status payload createdAt createdBy startedAt endedAt worker log result error cancel` |
| `training:worker` | string | heartbeat JSON, `EX 120`; the page shows Offline when older than 90 s |
| `training:state` | string | worker snapshot: dataset stats, Ollama models, latest exams, backtest summary |
| `training:rpc` | list | request/reply requests `{id, op, args}`; worker pumps it every second (`console/rpc.js`) |
| `training:rpc:<id>` | string | reply `{ok, data}` or `{ok:false, error}`, `EX 60` |

Types live in [src/types/training.ts](../src/types/training.ts); queue helpers in
[src/lib/training/queue.ts](../src/lib/training/queue.ts).

## Job types

| Type | Payload | What the worker does |
|---|---|---|
| `import_batch` | `driveId`, `driveKind` (`folder`/`zip`), `replace` | Downloads the folder tree or zip, parses and scores every application folder (see `docs/historical-data-format.md` in the agent repo) |
| `import_outcomes` | `driveId` (csv) | Attaches declared figures / outcomes to already-imported cases |
| `backtest` | – | Rules-engine tiers vs. real outcomes; result stored on the job and summarised in `training:state` |
| `build_dataset` | – | Builds `train.jsonl` from synthetic gold + reviews + labelled real cases |
| `finetune` | `outName?` | LoRA fine-tune on the GPU host configured in the worker's settings, imports GGUF into Ollama |
| `exam` | `model`, `n` | Scores a model on held-out cases |
| `regenerate_synthetic` | `n`, `seed` | Rebuilds the synthetic case set |

Cancel: queued jobs are removed from the list immediately; running jobs get `cancel=1` and the worker kills the
child process at its next check (≤ 4 s).

## Uploading cases from the site

`Cases → Upload one case` writes `training/cases/<applicationId>/` in the Drive folder: `application.json`
(declared figures, TerePay decision, outcome, behaviour flags) plus one document per request, named
`<kind>-<n>-<file>` where kind is `statement`, `payslip`, `centrix` (credit history), `history` or `other`.
Each document is capped at 4 MB (Vercel body limit); statements are uploaded one at a time. "Save and import"
then queues `import_batch` for that folder — the worker recognises a folder holding only files as a single case.

## RPC ops (`/api/training/rpc`)

`cases.list/get/label/reanalyse/delete`, `backtest.get`, `gold.list/get/review`, `dataset.get`, `exams.list/get`,
`settings.get/set`, `prompts.list`, `ping`. `settings.set` and `cases.delete` are admin only; officer attribution
on labels and reviews comes from the session email, never the form.

## Security

- Every route is `withAuth(request, ['admin', 'lender'])` + `assertTrainingAccess()` + rate limited; mutations
  are audit-logged (`training_job_queued`, `training_job_cancelled`, `training_case_document_uploaded`,
  `training_case_application_saved`, `training_cases_label`, `training_gold_review`, …).
- Fine-tune, synthetic regeneration, worker settings and case deletion are admin only.
- The site validates the Drive id is a direct child of the training folder before queuing, so the worker can
  never be pointed at other Drive content. Payloads are rebuilt server-side; the client's values are not trusted.
- Training data contains bank statements. Keep the Drive folder restricted to admins and the service account;
  redact before upload where possible (the parser needs dates, descriptions, amounts and balances only).
- Fine-tuning never changes a decision: the rules engine decides, the model only writes the analyst note.

## Operating the worker

```bash
# on the Pi
cd ~/credit-assessment-agent/console && npm install
cp ../deploy/terepay-worker.service ~/.config/systemd/user/ && systemctl --user daemon-reload
systemctl --user enable --now terepay-worker
journalctl --user -u terepay-worker -f
```
