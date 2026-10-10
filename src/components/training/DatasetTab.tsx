'use client';

import { useState } from 'react';
import { enqueueJob, fmtTime } from './lib';
import { Empty, Field, Section, Stat, inputCls, primaryBtn, secondaryBtn } from './ui';
import type { TabProps } from './TrainingConsole';

export default function DatasetTab({ overview, refresh, notify, fail }: TabProps) {
  const state = overview.state;
  const ds = state?.dataset ?? null;
  const canRun = overview.workerOnline;
  const [outName, setOutName] = useState('');
  const [synthN, setSynthN] = useState(200);
  const [synthSeed, setSynthSeed] = useState(11);
  const [busy, setBusy] = useState(false);

  const run = async (payload: Record<string, unknown>, what: string) => {
    setBusy(true);
    try { const job = await enqueueJob(payload); notify(`${what} queued (${job.id}). Watch the Jobs tab.`); await refresh(); }
    catch (e) { fail(e instanceof Error ? e.message : 'Could not queue'); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <Section
        title="Training dataset"
        hint="train.jsonl = synthetic gold (minus rejected, with edits applied) + every real case that has an officer label, weighted ×3. The 25 held-out exam cases are never included."
        actions={<button type="button" disabled={!canRun || busy} onClick={() => run({ type: 'build_dataset' }, 'Build dataset')} className={primaryBtn}>Build dataset</button>}
      >
        {!ds ? <Empty>No worker state yet.</Empty> : (
          <dl className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Examples" value={ds.stats?.examples ?? '—'} />
            <Stat label="Synthetic" value={ds.stats?.synthetic ?? '—'} />
            <Stat label="Edited by an officer" value={ds.stats?.edited ?? '—'} />
            <Stat label="Rejected" value={ds.stats?.rejected ?? '—'} />
            <Stat label="Real labelled cases" value={ds.stats?.real_labelled ?? '—'} />
            <Stat label="Held-out exam cases" value={ds.stats?.exam_cases ?? '—'} />
            <Stat label="Gold reviews on file" value={ds.reviews} />
            <Stat label="Real cases imported" value={ds.real_cases} />
            <Stat label="Built" value={ds.stats?.built_at ? fmtTime(Date.parse(ds.stats.built_at)) : 'never'} />
          </dl>
        )}
      </Section>

      {overview.isAdmin && (
        <Section title="Synthetic cases" hint="Regenerates the synthetic case set and its gold answers. Reviews of cases that no longer exist stop applying — do this before a review pass, not after.">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Cases"><input type="number" min={10} max={2000} value={synthN} onChange={(e) => setSynthN(Number(e.target.value))} className={`${inputCls} w-28`} /></Field>
            <Field label="Seed"><input type="number" min={0} value={synthSeed} onChange={(e) => setSynthSeed(Number(e.target.value))} className={`${inputCls} w-28`} /></Field>
            <button type="button" disabled={!canRun || busy} onClick={() => run({ type: 'regenerate_synthetic', n: synthN, seed: synthSeed }, 'Regenerate synthetic cases')} className={secondaryBtn}>Regenerate</button>
          </div>
        </Section>
      )}

      <Section
        title="Fine-tune"
        hint={`LoRA on the GPU host (${state?.settings.gpu_mode === 'local' ? 'this machine' : state?.settings.ssh_host_set ? 'SSH host configured' : 'no SSH host configured — see Settings'}), base ${state?.settings.base_model ?? '—'}, ${state?.settings.epochs ?? '—'} epochs. The result is imported into Ollama under the name below; switch it on by setting OLLAMA_MODEL on the worker once the exam says it is better.`}
      >
        {overview.isAdmin ? (
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Ollama model name"><input value={outName} onChange={(e) => setOutName(e.target.value)} placeholder={state?.settings.ollama_name ?? 'terepay-analyst'} className={`${inputCls} w-64`} /></Field>
            <button type="button" disabled={!canRun || busy || !ds?.has_train} onClick={() => run({ type: 'finetune', ...(outName ? { outName } : {}) }, 'Fine-tune')} className={primaryBtn}>Start fine-tune</button>
            {!ds?.has_train && <span className="text-xs text-slate-500">Build the dataset first.</span>}
          </div>
        ) : <Empty>Only an admin can start a fine-tune.</Empty>}
        <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Models available on the worker</h3>
        {!state || state.models.length === 0 ? <Empty>None reported.</Empty> : (
          <ul className="grid gap-1 sm:grid-cols-2 text-sm">{state.models.map((m) => <li key={m.name} className="flex justify-between rounded-[10px] border border-slate-200 px-3 py-1.5"><span className="font-mono">{m.name}</span><span className="text-slate-500 font-tabular">{m.size_gb} GB</span></li>)}</ul>
        )}
      </Section>
    </div>
  );
}
