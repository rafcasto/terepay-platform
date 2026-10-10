'use client';

import { useEffect, useState } from 'react';
import type { TrainingExamSummary } from '@/types/training';
import { enqueueJob, pct, rpc } from './lib';
import { Empty, Field, Section, inputCls, primaryBtn, td, th } from './ui';
import type { TabProps } from './TrainingConsole';

type ExamDetail = { file: string; summary: TrainingExamSummary; results: Record<string, unknown>[] };

const COLS: { key: keyof TrainingExamSummary; label: string; fmt?: (v: number) => string; good?: 'high' | 'low' }[] = [
  { key: 'cases', label: 'Cases' },
  { key: 'avg_secs', label: 'Secs / case', good: 'low' },
  { key: 'json_valid', label: 'JSON valid', fmt: (v) => pct(v), good: 'high' },
  { key: 'judgement_precision', label: 'Judgement precision', fmt: (v) => pct(v), good: 'high' },
  { key: 'judgement_recall', label: 'Judgement recall', fmt: (v) => pct(v), good: 'high' },
  { key: 'behaviour_f1', label: 'Behaviour F1', fmt: (v) => pct(v), good: 'high' },
  { key: 'note_length_ok', label: 'Note length ok', fmt: (v) => pct(v), good: 'high' },
  { key: 'finding_coverage', label: 'Finding coverage', fmt: (v) => pct(v), good: 'high' },
  { key: 'contradictions', label: 'Contradictions', good: 'low' },
  { key: 'invented_numbers', label: 'Invented numbers', fmt: (v) => pct(v), good: 'low' },
  { key: 'conclusion_consistent', label: 'Conclusion consistent', fmt: (v) => pct(v), good: 'high' },
];

export default function ExamsTab({ overview, refresh, notify, fail }: TabProps) {
  const models = overview.state?.models ?? [];
  const canRun = overview.workerOnline;
  const [model, setModel] = useState('');
  const [n, setN] = useState(12);
  const [exams, setExams] = useState<TrainingExamSummary[] | null>(null);
  const [detail, setDetail] = useState<ExamDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!canRun) return;
    try { setExams(await rpc<TrainingExamSummary[]>('exams.list')); } catch (e) { fail(e instanceof Error ? e.message : 'Could not load exams'); }
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot data fetch on mount
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  const run = async () => {
    setBusy(true);
    try { const job = await enqueueJob({ type: 'exam', model, n }); notify(`Exam on ${model} queued (${job.id}) — about ${Math.round((n * 100) / 60)} min on the Pi.`); await refresh(); }
    catch (e) { fail(e instanceof Error ? e.message : 'Could not queue'); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <Section title="Run the exam" hint="Scores a model on held-out cases with gold answers: JSON validity, judgement precision/recall, behaviour-tick F1, note length, coverage of the triggered findings, contradictions, invented numbers, conclusion consistency and speed. Run the baseline and the fine-tuned model on the same n.">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Model"><select value={model} onChange={(e) => setModel(e.target.value)} className={`${inputCls} w-64`}><option value="">Select…</option>{models.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}</select></Field>
          <Field label="Cases (1–200)"><input type="number" min={1} max={200} value={n} onChange={(e) => setN(Number(e.target.value))} className={`${inputCls} w-24`} /></Field>
          <button type="button" disabled={!canRun || busy || !model} onClick={run} className={primaryBtn}>Run exam</button>
        </div>
      </Section>

      <Section title="Results" hint="Adopt a fine-tuned model only if it is at least as good on every quality metric and faster.">
        {!canRun ? <Empty>Worker offline.</Empty> : !exams ? <Empty>Loading…</Empty> : exams.length === 0 ? <Empty>No exams yet.</Empty> : (
          <div className="overflow-x-auto">
            <table className="min-w-full"><thead><tr className="border-b border-slate-200"><th className={th}>Model</th>{COLS.map((c) => <th key={c.key} className={th}>{c.label}</th>)}</tr></thead>
              <tbody>{exams.map((e) => (
                <tr key={e.file} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer" onClick={async () => { try { setDetail(await rpc<ExamDetail>('exams.get', { file: e.file })); } catch (err) { fail(err instanceof Error ? err.message : 'Could not load'); } }}>
                  <td className={`${td} font-mono text-xs`}>{e.model ?? e.file}</td>
                  {COLS.map((c) => { const v = e[c.key]; return <td key={c.key} className={`${td} font-tabular`}>{typeof v === 'number' ? (c.fmt ? c.fmt(v) : v) : '—'}</td>; })}
                </tr>
              ))}</tbody></table>
          </div>
        )}
      </Section>

      {detail && (
        <Section title={detail.file} hint={`${detail.results.length} case results shown`} actions={<button type="button" onClick={() => setDetail(null)} className={inputCls}>Close</button>}>
          <pre className="max-h-96 overflow-auto rounded-[10px] bg-slate-50 border border-slate-200 p-4 text-xs font-mono text-[#1C2A3A]">{JSON.stringify(detail.results, null, 2)}</pre>
        </Section>
      )}
    </div>
  );
}
