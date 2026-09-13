'use client';

import { useEffect, useState } from 'react';
import type { TrainingGoldCase, TrainingGoldList } from '@/types/training';
import { TRAINING_BEHAVIOUR_KEYS, TRAINING_JUDGEMENT_KEYS } from '@/types/training';
import { judgementLabel, rpc } from './lib';
import { Empty, Field, Section, Tone, inputCls, primaryBtn, secondaryBtn, td, textareaCls, th } from './ui';
import type { TabProps } from './TrainingConsole';

const STATUS_TONE: Record<string, string> = { unreviewed: 'bg-slate-100 text-slate-600', approved: 'bg-green-50 text-green-700', edited: 'bg-amber-50 text-amber-800', rejected: 'bg-red-50 text-red-700' };

export default function GoldTab({ overview, notify, fail }: TabProps) {
  const [list, setList] = useState<TrainingGoldList | null>(null);
  const [profile, setProfile] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<TrainingGoldCase | null>(null);
  const [note, setNote] = useState('');
  const [judgements, setJudgements] = useState<Record<string, boolean>>({});
  const [behaviour, setBehaviour] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async (p = profile, s = status) => {
    if (!overview.workerOnline) return;
    try { setList(await rpc<TrainingGoldList>('gold.list', { ...(p ? { profile: p } : {}), ...(s ? { status: s } : {}) })); }
    catch (e) { fail(e instanceof Error ? e.message : 'Could not load gold cases'); }
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot data fetch on mount
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  const openCase = async (id: string) => {
    try {
      const c = await rpc<TrainingGoldCase>('gold.get', { id });
      const gold = c.review?.gold ?? c.case.gold;
      setOpen(c); setNote(gold.analyst_note); setJudgements({ ...gold.judgements }); setBehaviour([...gold.behaviour]);
    } catch (e) { fail(e instanceof Error ? e.message : 'Could not load'); }
  };

  const review = async (s: 'approved' | 'edited' | 'rejected') => {
    if (!open) return;
    setBusy(true);
    try {
      await rpc('gold.review', { id: open.case.id, review: s === 'edited' ? { status: s, judgements, behaviour, analyst_note: note } : { status: s } });
      notify(`${open.case.id} marked ${s}.`);
      const cur = list?.rows ?? []; const idx = cur.findIndex((r) => r.id === open.case.id);
      await load();
      const next = cur[idx + 1]; if (next) openCase(next.id); else setOpen(null);
    } catch (e) { fail(e instanceof Error ? e.message : 'Could not save review'); } finally { setBusy(false); }
  };

  if (!overview.workerOnline) return <Empty>Worker offline — gold cases live on the assessment machine.</Empty>;

  const tri = (k: string) => (judgements[k] === true ? 'yes' : judgements[k] === false ? 'no' : '');
  const setJ = (k: string, v: string) => setJudgements((j) => { const n = { ...j }; if (v === '') delete n[k]; else n[k] = v === 'yes'; return n; });

  return (
    <div className="space-y-5">
      <Section
        title="Review synthetic gold notes"
        hint="Each synthetic case has a gold answer the model is trained to reproduce. A credit officer should read a sample: approve the ones that read like TerePay would write, edit the wording where it doesn't, reject anything wrong. Rejected cases are left out of the dataset."
        actions={<>
          <select value={profile} onChange={(e) => { setProfile(e.target.value); load(e.target.value, status); }} className={inputCls}><option value="">All profiles</option>{(list?.profiles ?? []).map((p) => <option key={p} value={p}>{p}</option>)}</select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); load(profile, e.target.value); }} className={inputCls}><option value="">Any status</option><option value="unreviewed">Unreviewed</option><option value="approved">Approved</option><option value="edited">Edited</option><option value="rejected">Rejected</option></select>
        </>}
      >
        {list && (
          <p className="text-xs text-slate-500 mb-3">{Object.entries(list.counts).map(([k, n]) => `${k} ${n}`).join(' · ')} · showing {list.rows.length} of {list.total}</p>
        )}
        {!list ? <Empty>Loading…</Empty> : list.rows.length === 0 ? <Empty>Nothing matches.</Empty> : (
          <div className="max-h-80 overflow-auto">
            <table className="min-w-full"><thead><tr className="border-b border-slate-200"><th className={th}>Case</th><th className={th}>Profile</th><th className={th}>Decision</th><th className={th}>Words</th><th className={th}>Status</th></tr></thead>
              <tbody>{list.rows.map((r) => (
                <tr key={r.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer ${open?.case.id === r.id ? 'bg-orange-50' : ''}`} onClick={() => openCase(r.id)}>
                  <td className={`${td} font-mono text-xs`}>{r.id}</td><td className={td}>{r.profile}</td><td className={td}>{r.decision}</td><td className={`${td} font-tabular`}>{r.words}</td>
                  <td className={td}><span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_TONE[r.status] ?? ''}`}>{r.status}</span></td>
                </tr>
              ))}</tbody></table>
          </div>
        )}
      </Section>

      {open && (
        <Section
          title={`${open.case.id} · ${open.case.profile}`}
          hint={`Engine decision: ${open.case.decision}${open.case.triggered.length ? ` · triggered: ${open.case.triggered.join(', ')}` : ''}${open.review ? ` · currently ${open.review.status} by ${open.review.officer || '—'}` : ''}`}
          actions={<>
            <button type="button" disabled={busy} onClick={() => review('approved')} className={primaryBtn}>Approve</button>
            <button type="button" disabled={busy} onClick={() => review('edited')} className={secondaryBtn}>Save edits</button>
            <button type="button" disabled={busy} onClick={() => review('rejected')} className={secondaryBtn}>Reject</button>
          </>}
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Judgements</h3>
              <div className="grid gap-2">
                {TRAINING_JUDGEMENT_KEYS.map((k) => (
                  <div key={k} className="flex items-center justify-between gap-2 rounded-[10px] border border-slate-200 px-3 py-1.5 text-sm"><span>{judgementLabel(k)}</span>
                    <select value={tri(k)} onChange={(e) => setJ(k, e.target.value)} className={`${inputCls} h-8 w-24`}><option value="">—</option><option value="yes">True</option><option value="no">False</option></select></div>
                ))}
              </div>
              <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Behaviour ticks</h3>
              <div className="flex flex-wrap gap-2">
                {TRAINING_BEHAVIOUR_KEYS.map((b) => (
                  <label key={b.key} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm cursor-pointer ${behaviour.includes(b.key) ? 'border-[#B45600] bg-orange-50 text-[#B45600]' : 'border-slate-300'}`}>
                    <input type="checkbox" className="sr-only" checked={behaviour.includes(b.key)} onChange={() => setBehaviour((x) => (x.includes(b.key) ? x.filter((y) => y !== b.key) : [...x, b.key]))} />{b.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Field label={`Analyst note (${note.trim() ? note.trim().split(/\s+/).length : 0} words)`}><textarea rows={7} value={note} onChange={(e) => setNote(e.target.value)} className={`${textareaCls} w-full`} /></Field>
              <details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-[#1C2A3A]">Brief the model sees</summary>
                <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-[10px] bg-slate-50 border border-slate-200 p-3 text-xs font-mono text-[#1C2A3A]">{open.case.user}</pre></details>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Tone value={open.case.decision.split('/')[1] ?? open.case.decision} /> confidence {open.case.gold.confidence} · gaps: {open.case.gold.data_gaps.join(', ') || 'none'}</div>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
