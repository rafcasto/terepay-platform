'use client';

import { useEffect, useState } from 'react';
import type { TrainingApplication, TrainingCaseDetail, TrainingLabel } from '@/types/training';
import { TRAINING_BEHAVIOUR_KEYS, TRAINING_JUDGEMENT_KEYS, TRAINING_OUTCOMES } from '@/types/training';
import { fmtMoney, judgementLabel, rpc } from './lib';
import { Field, Section, Stat, Tone, dangerBtn, inputCls, primaryBtn, secondaryBtn, td, textareaCls, th } from './ui';

type Props = { id: string; isAdmin: boolean; onClose: () => void; notify: (m: string) => void; fail: (m: string) => void };

const EMPTY_LABEL: TrainingLabel = { judgements: {}, behaviour: [], analyst_note: '', confidence: 70, data_gaps: [], officer: '' };
const num = (v: string): number | null => (v.trim() === '' ? null : Number(v));

export default function CaseDetail({ id, isAdmin, onClose, notify, fail }: Props) {
  const [detail, setDetail] = useState<TrainingCaseDetail | null>(null);
  const [app, setApp] = useState<TrainingApplication>({});
  const [label, setLabel] = useState<TrainingLabel>(EMPTY_LABEL);
  const [busy, setBusy] = useState(false);
  const [gaps, setGaps] = useState('');

  const load = async () => {
    try {
      const d = await rpc<TrainingCaseDetail>('cases.get', { id });
      setDetail(d);
      setApp(d.application);
      setLabel(d.label ?? EMPTY_LABEL);
      setGaps((d.label?.data_gaps ?? []).join('\n'));
    } catch (e) { fail(e instanceof Error ? e.message : 'Could not load the case'); }
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot data fetch on mount
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per id
  }, [id]);

  const saveApp = async () => {
    setBusy(true);
    try { await rpc('cases.reanalyse', { id, application: app }); notify('Figures saved and the case re-scored.'); await load(); }
    catch (e) { fail(e instanceof Error ? e.message : 'Could not save'); } finally { setBusy(false); }
  };
  const saveLabel = async () => {
    setBusy(true);
    try {
      await rpc('cases.label', { id, label: { ...label, data_gaps: gaps.split('\n').map((s) => s.trim()).filter(Boolean) } });
      notify('Officer label saved — it will be included (×3) next time the dataset is built.'); await load();
    } catch (e) { fail(e instanceof Error ? e.message : 'Could not save the label'); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete case ${id} from the worker? Documents in Drive are kept.`)) return;
    try { await rpc('cases.delete', { id }); notify(`Case ${id} deleted.`); onClose(); }
    catch (e) { fail(e instanceof Error ? e.message : 'Could not delete'); }
  };

  if (!detail) return <p className="text-sm text-slate-500">Loading case…</p>;
  const f = detail.analysis.findings;
  const setField = <K extends keyof TrainingApplication>(k: K, v: TrainingApplication[K]) => setApp((a) => ({ ...a, [k]: v }));
  const tri = (k: string): 'yes' | 'no' | '' => (label.judgements[k] === true ? 'yes' : label.judgements[k] === false ? 'no' : '');
  const setJudgement = (k: string, v: string) => setLabel((l) => { const j = { ...l.judgements }; if (v === '') delete j[k]; else j[k] = v === 'yes'; return { ...l, judgements: j }; });
  const toggleBehaviour = (k: string) => setLabel((l) => ({ ...l, behaviour: l.behaviour.includes(k) ? l.behaviour.filter((x) => x !== k) : [...l.behaviour, k] }));

  return (
    <div className="space-y-5">
      <Section
        title={`Case ${id}`}
        hint={`Analysed ${detail.analysis.analysed_at ? new Date(detail.analysis.analysed_at).toLocaleString('en-NZ') : ''} · parser ${detail.analysis.mode} · ${detail.analysis.parser.transactions} transactions from ${detail.analysis.parser.dated_lines_in_text} dated lines`}
        actions={<>
          {isAdmin && <button type="button" onClick={remove} className={dangerBtn}>Delete</button>}
          <button type="button" onClick={onClose} className={secondaryBtn}>Back to cases</button>
        </>}
      >
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Tone value={f.risk_rating} /><Tone value={f.recommendation} /><Tone value={f.expense_risk_tier} />
          <span className="text-sm text-slate-500">escalation: {f.escalation} · behaviour {f.behaviour_score >= 0 ? '+' : ''}{f.behaviour_score} ({f.behaviour_tier}) · confidence {f.confidence}</span>
        </div>
        <pre className="whitespace-pre-wrap rounded-[10px] bg-slate-50 border border-slate-200 p-4 text-xs font-mono text-[#1C2A3A]">{f.header}</pre>
        <div className="mt-4 grid gap-5 md:grid-cols-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Rule hits</h3>
            {Object.entries(f.rule_hits ?? {}).flatMap(([tier, hits]) => hits.map((h) => `${tier}: ${h.rule}`)).length === 0 ? <p className="text-sm text-slate-500">None.</p> : (
              <ul className="space-y-1 text-sm text-[#1C2A3A]">{Object.entries(f.rule_hits ?? {}).flatMap(([tier, hits]) => hits.map((h, i) => <li key={`${tier}-${i}`}><Tone value={tier.charAt(0).toUpperCase() + tier.slice(1)} /> <span className="ml-1">{h.rule}</span></li>))}</ul>
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Engine factors</h3>
            {f.factors.length === 0 ? <p className="text-sm text-slate-500">None.</p> : <ul className="list-disc pl-4 space-y-1 text-sm text-[#1C2A3A]">{f.factors.map((x, i) => <li key={i}>{x}</li>)}</ul>}
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Evidence lines</h3>
            {detail.analysis.evidence.length === 0 ? <p className="text-sm text-slate-500">None.</p> : <ul className="space-y-1 text-xs font-mono text-[#1C2A3A]">{detail.analysis.evidence.slice(0, 20).map((x, i) => <li key={i} className="truncate">{x}</li>)}</ul>}
          </div>
        </div>
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Documents</h3>
          <table className="min-w-full"><thead><tr className="border-b border-slate-200"><th className={th}>File</th><th className={th}>Kind</th><th className={th}>Chars</th><th className={th}>Tx</th><th className={th}>Notes</th></tr></thead>
            <tbody>{detail.analysis.documents.map((d) => (
              <tr key={d.file} className="border-b border-slate-100 last:border-0"><td className={td}>{d.original}</td><td className={`${td} text-slate-500`}>{d.kind}</td><td className={`${td} font-tabular`}>{d.chars}</td><td className={`${td} font-tabular`}>{d.transactions}</td><td className={`${td} text-slate-500`}>{d.unreadable ? 'unreadable (scanned? run OCR)' : ''}</td></tr>
            ))}</tbody></table>
          {detail.analysis.parser.notes.length > 0 && <p className="mt-2 text-xs text-amber-800">{detail.analysis.parser.notes.slice(0, 5).join(' · ')}</p>}
        </div>
      </Section>

      <Section title="Application and outcome" hint="The declared figures the engine tests the statements against, and what actually happened. Saving re-scores the case." actions={<button type="button" onClick={saveApp} disabled={busy} className={primaryBtn}>Save and re-score</button>}>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Loan amount ($)"><input type="number" value={app.loan_amount ?? ''} onChange={(e) => setField('loan_amount', num(e.target.value))} className={`${inputCls} w-full`} /></Field>
          <Field label="Declared income ($/month)"><input type="number" value={app.income ?? ''} onChange={(e) => setField('income', num(e.target.value))} className={`${inputCls} w-full`} /></Field>
          <Field label="Declared expenses ($/month)"><input type="number" value={app.expenses ?? ''} onChange={(e) => setField('expenses', num(e.target.value))} className={`${inputCls} w-full`} /></Field>
          <Field label="Existing debt ($/month)"><input type="number" value={app.existing_debt ?? ''} onChange={(e) => setField('existing_debt', num(e.target.value))} className={`${inputCls} w-full`} /></Field>
          <Field label="Loan purpose" className="md:col-span-2"><input value={app.loan_purpose ?? ''} onChange={(e) => setField('loan_purpose', e.target.value)} className={`${inputCls} w-full`} /></Field>
          <Field label="TerePay decision"><select value={app.decision_made ?? ''} onChange={(e) => setField('decision_made', e.target.value)} className={`${inputCls} w-full`}><option value="">—</option><option value="approved">Approved</option><option value="conditional">Conditional</option><option value="declined">Declined</option></select></Field>
          <Field label="Outcome"><select value={app.outcome ?? 'unknown'} onChange={(e) => setField('outcome', e.target.value)} className={`${inputCls} w-full`}>{TRAINING_OUTCOMES.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}</select></Field>
          <Field label="Worst days late"><input type="number" value={app.max_days_late ?? ''} onChange={(e) => setField('max_days_late', num(e.target.value))} className={`${inputCls} w-full`} /></Field>
          <Field label="Outcome notes" className="md:col-span-3"><input value={app.outcome_notes ?? ''} onChange={(e) => setField('outcome_notes', e.target.value)} className={`${inputCls} w-full`} /></Field>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TRAINING_BEHAVIOUR_KEYS.map((b) => { const key = `behaviour_${b.key}` as const; const v = app[key]; return (
            <div key={b.key} className="flex items-center justify-between gap-2 rounded-[10px] border border-slate-200 px-3 py-2 text-sm"><span>{b.label} <span className="text-xs text-slate-400">{b.positive ? '+' : '−'}</span></span>
              <select value={v === true ? 'yes' : v === false ? 'no' : ''} onChange={(e) => setField(key, e.target.value === '' ? undefined : e.target.value === 'yes')} className={`${inputCls} h-8 w-24`}><option value="">—</option><option value="yes">Yes</option><option value="no">No</option></select></div>
          ); })}
        </div>
        {detail.analysis.metrics && (
          <dl className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3 border-t border-slate-100 pt-3">
            <Stat label="Observed net income / month" value={fmtMoney((detail.analysis.metrics.income as { observed_net_monthly?: number } | undefined)?.observed_net_monthly)} />
            <Stat label="Statement period" value={String((detail.analysis.metrics.period as { days?: number } | undefined)?.days ?? '—')} />
            <Stat label="Payslip check" value={String((f.affordability as { payslip_status?: string } | undefined)?.payslip_status ?? '—')} />
          </dl>
        )}
      </Section>

      <Section title="Officer label" hint="Your judgement calls and a 40–80 word analyst note in TerePay's voice. This is what the fine-tuned model learns to write; it never changes the engine's decision." actions={<button type="button" onClick={saveLabel} disabled={busy} className={primaryBtn}>Save label</button>}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Judgement calls (leave blank = unknown)</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TRAINING_JUDGEMENT_KEYS.map((k) => (
            <div key={k} className="flex items-center justify-between gap-2 rounded-[10px] border border-slate-200 px-3 py-2 text-sm"><span>{judgementLabel(k)}</span>
              <select value={tri(k)} onChange={(e) => setJudgement(k, e.target.value)} className={`${inputCls} h-8 w-24`}><option value="">—</option><option value="yes">True</option><option value="no">False</option></select></div>
          ))}
        </div>
        <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Behaviour ticks (only what the credit-history documents support)</h3>
        <div className="flex flex-wrap gap-2">
          {TRAINING_BEHAVIOUR_KEYS.map((b) => (
            <label key={b.key} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm cursor-pointer ${label.behaviour.includes(b.key) ? 'border-[#B45600] bg-orange-50 text-[#B45600]' : 'border-slate-300 text-[#1C2A3A]'}`}>
              <input type="checkbox" className="sr-only" checked={label.behaviour.includes(b.key)} onChange={() => toggleBehaviour(b.key)} />{b.label}
            </label>
          ))}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Analyst note (40–80 words)" className="md:col-span-2"><textarea rows={5} value={label.analyst_note} onChange={(e) => setLabel((l) => ({ ...l, analyst_note: e.target.value }))} className={`${textareaCls} w-full`} /><span className="text-xs text-slate-500">{label.analyst_note.trim() ? label.analyst_note.trim().split(/\s+/).length : 0} words</span></Field>
          <div className="space-y-3">
            <Field label="Confidence (0–100)"><input type="number" min={0} max={100} value={label.confidence} onChange={(e) => setLabel((l) => ({ ...l, confidence: Number(e.target.value) }))} className={`${inputCls} w-full`} /></Field>
            <Field label="Data gaps (one per line)"><textarea rows={3} value={gaps} onChange={(e) => setGaps(e.target.value)} className={`${textareaCls} w-full`} /></Field>
          </div>
        </div>
        {detail.label?.labelled_at && <p className="mt-2 text-xs text-slate-500">Last saved {new Date(detail.label.labelled_at).toLocaleString('en-NZ')} by {detail.label.officer || '—'}</p>}
      </Section>

      <Section title="What the model sees">
        <details><summary className="cursor-pointer text-sm font-medium text-[#1C2A3A]">Brief ({detail.analysis.brief ? `${detail.analysis.brief.length} chars` : 'not built — parser fallback'})</summary>
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-[10px] bg-slate-50 border border-slate-200 p-4 text-xs font-mono text-[#1C2A3A]">{detail.analysis.brief ?? '—'}</pre></details>
        <details className="mt-2"><summary className="cursor-pointer text-sm font-medium text-[#1C2A3A]">Parsed transactions (first {detail.analysis.transactions.length})</summary>
          <div className="mt-2 max-h-96 overflow-auto"><table className="min-w-full"><thead><tr className="border-b border-slate-200"><th className={th}>Date</th><th className={th}>Description</th><th className={th}>Amount</th><th className={th}>Category</th></tr></thead>
            <tbody>{detail.analysis.transactions.map((t, i) => <tr key={i} className="border-b border-slate-100"><td className={`${td} font-mono text-xs`}>{t.date}</td><td className={`${td} text-xs`}>{t.desc}</td><td className={`${td} font-tabular text-xs text-right`}>{t.amount}</td><td className={`${td} text-xs text-slate-500`}>{t.category ?? ''}</td></tr>)}</tbody></table></div></details>
        <details className="mt-2"><summary className="cursor-pointer text-sm font-medium text-[#1C2A3A]">Statement text</summary>
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-[10px] bg-slate-50 border border-slate-200 p-4 text-xs font-mono text-[#1C2A3A]">{detail.text || '—'}</pre></details>
      </Section>
    </div>
  );
}
