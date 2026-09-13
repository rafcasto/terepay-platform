'use client';

import { useEffect, useState } from 'react';
import type { TrainingApplication, TrainingCaseSummary, TrainingDocKind, TrainingDriveEntry } from '@/types/training';
import { TRAINING_BEHAVIOUR_KEYS, TRAINING_DOC_KINDS, TRAINING_OUTCOMES } from '@/types/training';
import { apiGet, apiSend, enqueueJob, fmtMoney, fmtSize, fmtTime, readError, rpc } from './lib';
import { Empty, Field, Section, Tone, inputCls, primaryBtn, secondaryBtn, td, th } from './ui';
import type { TabProps } from './TrainingConsole';
import CaseDetail from './CaseDetail';

type DriveListing = { folderId: string; entries: TrainingDriveEntry[]; cases: TrainingDriveEntry[] };
type Pending = { kind: TrainingDocKind; file: File; status: 'pending' | 'uploading' | 'done' | 'failed'; error?: string };

const EMPTY_APP: TrainingApplication = {
  applicant_name: '', application_date: '', loan_amount: null, interest_rate: null, income: null, expenses: null, existing_debt: null,
  loan_purpose: '', decision_made: '', decision_by: '', outcome: 'unknown', max_days_late: null, outcome_notes: '',
};

const num = (v: string): number | null => (v.trim() === '' ? null : Number(v));

export default function CasesTab({ overview, refresh, notify, fail }: TabProps) {
  const canRun = overview.workerOnline;

  // --- Drive listing --------------------------------------------------------
  const [drive, setDrive] = useState<DriveListing | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(true);

  const loadDrive = async () => {
    try { setDrive(await apiGet<DriveListing>('/api/training/files')); setDriveError(null); }
    catch (e) { setDriveError(e instanceof Error ? e.message : 'Could not list the Drive folder'); }
  };

  // --- Cases on the worker -----------------------------------------------------
  const [cases, setCases] = useState<TrainingCaseSummary[] | null>(null);
  const [casesError, setCasesError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const loadCases = async () => {
    if (!overview.workerOnline) { setCases([]); return; }
    try { setCases(await rpc<TrainingCaseSummary[]>('cases.list')); setCasesError(null); }
    catch (e) { setCasesError(e instanceof Error ? e.message : 'Could not load cases'); }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot data fetch on mount
    loadDrive();
    loadCases();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only; refresh buttons re-fetch
  }, []);

  // --- Upload one case -----------------------------------------------------------
  const [applicationId, setApplicationId] = useState('');
  const [app, setApp] = useState<TrainingApplication>(EMPTY_APP);
  const [pending, setPending] = useState<Pending[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<TrainingDriveEntry[] | null>(null);

  const idOk = /^[a-z0-9][a-z0-9-]{1,39}$/.test(applicationId);
  const setField = <K extends keyof TrainingApplication>(k: K, v: TrainingApplication[K]) => setApp((a) => ({ ...a, [k]: v }));
  const addFiles = (kind: TrainingDocKind, list: FileList | null) => {
    if (!list) return;
    setPending((p) => [...p, ...Array.from(list).map((file) => ({ kind, file, status: 'pending' as const }))]);
  };

  const loadUploaded = async (id: string) => {
    try { const r = await apiGet<{ files: TrainingDriveEntry[] }>(`/api/training/files?case=${encodeURIComponent(id)}`); setUploaded(r.files); }
    catch { setUploaded(null); }
  };

  const saveCase = async (thenImport: boolean) => {
    if (!idOk) { fail('Enter an application ID (lowercase letters, digits, dashes).'); return; }
    setUploading(true);
    try {
      // 1. declared figures → application.json
      const { folderId } = await apiSend<{ folderId: string }>('/api/training/cases/application', 'POST', { applicationId, application: app });
      // 2. documents, one request each (Vercel body limit)
      let failed = 0;
      for (let i = 0; i < pending.length; i++) {
        const item = pending[i];
        if (item.status === 'done') continue;
        setPending((p) => p.map((x, j) => (j === i ? { ...x, status: 'uploading' } : x)));
        const fd = new FormData();
        fd.append('applicationId', applicationId); fd.append('kind', item.kind); fd.append('file', item.file);
        const res = await fetch('/api/training/cases/upload', { method: 'POST', body: fd });
        if (res.ok) setPending((p) => p.map((x, j) => (j === i ? { ...x, status: 'done' } : x)));
        else { failed++; const msg = await readError(res); setPending((p) => p.map((x, j) => (j === i ? { ...x, status: 'failed', error: msg } : x))); }
      }
      await loadUploaded(applicationId);
      if (failed) { fail(`${failed} document(s) failed to upload — fix and save again.`); return; }
      // 3. optionally queue the import of this case folder
      if (thenImport) {
        if (!canRun) { notify('Case saved to Drive. Start the worker to import it.'); return; }
        const job = await enqueueJob({ type: 'import_batch', driveId: folderId, replace: true });
        notify(`Case ${applicationId} saved and queued for import (${job.id}).`);
        await refresh();
      } else {
        notify(`Case ${applicationId} saved to Drive.`);
      }
      setPending((p) => p.filter((x) => x.status !== 'done'));
      await loadDrive();
    } catch (e) { fail(e instanceof Error ? e.message : 'Could not save the case'); }
    finally { setUploading(false); }
  };

  const removeUploaded = async (f: TrainingDriveEntry) => {
    if (!window.confirm(`Remove ${f.name} from Drive?`)) return;
    try { await apiSend(`/api/training/cases/upload?applicationId=${encodeURIComponent(applicationId)}&fileId=${encodeURIComponent(f.id)}`, 'DELETE'); await loadUploaded(applicationId); }
    catch (e) { fail(e instanceof Error ? e.message : 'Could not remove'); }
  };

  const importEntry = async (entry: TrainingDriveEntry) => {
    try {
      const type = entry.kind === 'csv' ? 'import_outcomes' : 'import_batch';
      const job = await enqueueJob(type === 'import_batch' ? { type, driveId: entry.id, replace: replaceExisting } : { type, driveId: entry.id });
      notify(`${entry.name} queued for import (${job.id}). Watch progress on the Jobs tab.`);
      await refresh();
    } catch (e) { fail(e instanceof Error ? e.message : 'Could not queue the import'); }
  };

  if (openId) {
    return <CaseDetail id={openId} isAdmin={overview.isAdmin} onClose={() => { setOpenId(null); loadCases(); }} notify={notify} fail={fail} />;
  }

  const driveUrl = drive ? `https://drive.google.com/drive/folders/${drive.folderId}` : null;

  return (
    <div className="space-y-5">
      {/* Upload one case */}
      <Section
        title="Upload one case"
        hint="One real application: the figures declared on the form, what TerePay decided and how the loan performed, plus every document held at decision time. Names and account numbers can be redacted — the engine needs dates, descriptions, amounts and balances."
      >
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Application ID *" className="md:col-span-2">
            <input value={applicationId} onChange={(e) => { setApplicationId(e.target.value.trim().toLowerCase()); setUploaded(null); }} onBlur={() => { if (idOk) loadUploaded(applicationId); }} placeholder="ln-2024-0001" className={`${inputCls} w-full font-mono`} />
          </Field>
          <Field label="Applicant (display only)"><input value={app.applicant_name ?? ''} onChange={(e) => setField('applicant_name', e.target.value)} className={`${inputCls} w-full`} /></Field>
          <Field label="Application date"><input type="date" value={app.application_date ?? ''} onChange={(e) => setField('application_date', e.target.value)} className={`${inputCls} w-full`} /></Field>
          <Field label="Loan amount ($)"><input type="number" min={0} value={app.loan_amount ?? ''} onChange={(e) => setField('loan_amount', num(e.target.value))} className={`${inputCls} w-full`} /></Field>
          <Field label="Interest rate (%)"><input type="number" min={0} step="0.01" value={app.interest_rate ?? ''} onChange={(e) => setField('interest_rate', num(e.target.value))} className={`${inputCls} w-full`} /></Field>
          <Field label="Declared income ($/month)"><input type="number" min={0} value={app.income ?? ''} onChange={(e) => setField('income', num(e.target.value))} className={`${inputCls} w-full`} /></Field>
          <Field label="Declared expenses ($/month)"><input type="number" min={0} value={app.expenses ?? ''} onChange={(e) => setField('expenses', num(e.target.value))} className={`${inputCls} w-full`} /></Field>
          <Field label="Existing debt ($/month)"><input type="number" min={0} value={app.existing_debt ?? ''} onChange={(e) => setField('existing_debt', num(e.target.value))} className={`${inputCls} w-full`} /></Field>
          <Field label="Loan purpose" className="md:col-span-3"><input value={app.loan_purpose ?? ''} onChange={(e) => setField('loan_purpose', e.target.value)} placeholder="e.g. car repair, medical, bond" className={`${inputCls} w-full`} /></Field>
        </div>

        <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">Historical outcome (if known)</h3>
        <div className="mt-2 grid gap-4 md:grid-cols-4">
          <Field label="TerePay decision">
            <select value={app.decision_made ?? ''} onChange={(e) => setField('decision_made', e.target.value)} className={`${inputCls} w-full`}>
              <option value="">—</option><option value="approved">Approved</option><option value="conditional">Conditional</option><option value="declined">Declined</option>
            </select>
          </Field>
          <Field label="Decision by (initials)"><input value={app.decision_by ?? ''} onChange={(e) => setField('decision_by', e.target.value)} className={`${inputCls} w-full`} /></Field>
          <Field label="Outcome">
            <select value={app.outcome ?? 'unknown'} onChange={(e) => setField('outcome', e.target.value)} className={`${inputCls} w-full`}>
              {TRAINING_OUTCOMES.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
            </select>
          </Field>
          <Field label="Worst days late"><input type="number" min={0} value={app.max_days_late ?? ''} onChange={(e) => setField('max_days_late', num(e.target.value))} className={`${inputCls} w-full`} /></Field>
          <Field label="Outcome notes" className="md:col-span-4"><input value={app.outcome_notes ?? ''} onChange={(e) => setField('outcome_notes', e.target.value)} className={`${inputCls} w-full`} /></Field>
        </div>

        <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">Borrower behaviour (from TerePay&apos;s own loan history — leave blank if unknown)</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TRAINING_BEHAVIOUR_KEYS.map((b) => {
            const key = `behaviour_${b.key}` as const;
            const v = app[key];
            return (
              <div key={b.key} className="flex items-center justify-between gap-2 rounded-[10px] border border-slate-200 px-3 py-2 text-sm">
                <span className="text-[#1C2A3A]">{b.label} <span className="text-xs text-slate-400">{b.positive ? '+' : '−'}</span></span>
                <select value={v === true ? 'yes' : v === false ? 'no' : ''} onChange={(e) => setField(key, e.target.value === '' ? undefined : e.target.value === 'yes')} className={`${inputCls} h-8 w-24`}>
                  <option value="">—</option><option value="yes">Yes</option><option value="no">No</option>
                </select>
              </div>
            );
          })}
        </div>

        <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">Documents (PDF, TXT or CSV, up to 4 MB each)</h3>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {TRAINING_DOC_KINDS.map((k) => (
            <label key={k.kind} className="block rounded-[10px] border border-dashed border-slate-300 px-3 py-3 hover:border-[#B45600] cursor-pointer">
              <span className="block text-sm font-medium text-[#1C2A3A]">{k.label}</span>
              <span className="block text-xs text-slate-500">{k.hint}</span>
              <input type="file" multiple accept={k.accept} onChange={(e) => { addFiles(k.kind, e.target.files); e.target.value = ''; }} className="mt-2 block w-full text-xs text-slate-500 file:mr-3 file:rounded-[8px] file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[#1C2A3A] hover:file:bg-slate-200" />
            </label>
          ))}
        </div>

        {(pending.length > 0 || (uploaded && uploaded.length > 0)) && (
          <ul className="mt-3 divide-y divide-slate-100 rounded-[10px] border border-slate-200 text-sm">
            {uploaded?.filter((f) => f.name !== 'application.json').map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="truncate text-[#1C2A3A]">{f.name} <span className="text-xs text-slate-500">{fmtSize(f.size)} · already in Drive</span></span>
                <button type="button" onClick={() => removeUploaded(f)} className="text-xs font-medium text-red-700 hover:text-red-800">Remove</button>
              </li>
            ))}
            {pending.map((p, i) => (
              <li key={`${p.file.name}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="truncate text-[#1C2A3A]"><span className="text-xs text-slate-500 mr-2">{p.kind}</span>{p.file.name} <span className="text-xs text-slate-500">{fmtSize(p.file.size)}</span></span>
                <span className={`text-xs ${p.status === 'failed' ? 'text-red-700' : p.status === 'done' ? 'text-green-700' : 'text-slate-500'}`}>
                  {p.status === 'pending' && <button type="button" onClick={() => setPending((x) => x.filter((_, j) => j !== i))} className="font-medium text-red-700 hover:text-red-800">Remove</button>}
                  {p.status === 'uploading' && 'Uploading…'}{p.status === 'done' && 'Uploaded'}{p.status === 'failed' && (p.error ?? 'Failed')}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" disabled={!idOk || uploading} onClick={() => saveCase(true)} className={primaryBtn}>{uploading ? 'Saving…' : 'Save and import'}</button>
          <button type="button" disabled={!idOk || uploading} onClick={() => saveCase(false)} className={secondaryBtn}>Save to Drive only</button>
          <span className="text-xs text-slate-500">Saving the same ID again replaces its figures and adds the new documents.</span>
        </div>
      </Section>

      {/* Batch import */}
      <Section
        title="Batch import from Google Drive"
        hint="Drop a .zip or a folder of applications (one sub-folder each plus applications.csv) into the shared training folder, or attach outcomes to existing cases with a .csv."
        actions={<>
          {driveUrl && <a href={driveUrl} target="_blank" rel="noopener noreferrer" className={secondaryBtn}>Open folder</a>}
          <button type="button" onClick={loadDrive} className={secondaryBtn}>Refresh</button>
        </>}
      >
        <label className="mb-3 flex items-center gap-2 text-sm text-[#1C2A3A]">
          <input type="checkbox" checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
          Replace cases that already exist with the same application ID
        </label>
        {driveError && <p className="text-sm text-red-700">{driveError}</p>}
        {!drive && !driveError && <Empty>Loading folder…</Empty>}
        {drive && drive.entries.length === 0 && drive.cases.length === 0 && <Empty>The folder is empty.</Empty>}
        {drive && (drive.entries.length > 0 || drive.cases.length > 0) && (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead><tr className="border-b border-slate-200"><th className={th}>Name</th><th className={th}>Type</th><th className={th}>Size</th><th className={th}>Modified</th><th className={th} /></tr></thead>
              <tbody>
                {drive.entries.map((f) => (
                  <tr key={f.id} className="border-b border-slate-100 last:border-0">
                    <td className={td}>{f.name}</td><td className={`${td} text-slate-500`}>{f.kind}</td><td className={`${td} text-slate-500 font-tabular`}>{fmtSize(f.size)}</td><td className={`${td} text-slate-500`}>{f.modifiedTime ? fmtTime(Date.parse(f.modifiedTime)) : ''}</td>
                    <td className={`${td} text-right`}>
                      {(f.kind === 'folder' || f.kind === 'zip') && <button type="button" disabled={!canRun} onClick={() => importEntry(f)} className={secondaryBtn}>Import cases</button>}
                      {f.kind === 'csv' && <button type="button" disabled={!canRun} onClick={() => importEntry(f)} className={secondaryBtn}>Import outcomes</button>}
                    </td>
                  </tr>
                ))}
                {drive.cases.map((f) => (
                  <tr key={f.id} className="border-b border-slate-100 last:border-0">
                    <td className={td}><span className="font-mono">{f.name}</span></td><td className={`${td} text-slate-500`}>uploaded case</td><td className={td} /><td className={`${td} text-slate-500`}>{f.modifiedTime ? fmtTime(Date.parse(f.modifiedTime)) : ''}</td>
                    <td className={`${td} text-right`}><button type="button" disabled={!canRun} onClick={() => importEntry({ ...f, kind: 'folder' })} className={secondaryBtn}>Import</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Cases */}
      <Section
        title="Cases"
        hint="Every application the engine has parsed and scored. Open one to see the findings, edit the declared figures or write the officer label used for fine-tuning."
        actions={<button type="button" onClick={loadCases} disabled={!canRun} className={secondaryBtn}>Refresh</button>}
      >
        {!canRun && <Empty>Worker offline — the case list lives on the assessment machine.</Empty>}
        {canRun && casesError && <p className="text-sm text-red-700">{casesError}</p>}
        {canRun && cases && cases.length === 0 && !casesError && <Empty>No cases imported yet.</Empty>}
        {canRun && cases && cases.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead><tr className="border-b border-slate-200"><th className={th}>ID</th><th className={th}>Docs</th><th className={th}>Tx</th><th className={th}>Engine</th><th className={th}>Income</th><th className={th}>Payslip</th><th className={th}>TerePay</th><th className={th}>Outcome</th><th className={th}>Label</th></tr></thead>
              <tbody>
                {cases.map((c) => {
                  const [risk, rec, tier] = c.decision.split('/');
                  return (
                    <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => setOpenId(c.id)}>
                      <td className={`${td} font-mono`}>{c.id}{c.mode !== 'deterministic' && <span className="ml-2 text-xs text-amber-800">{c.mode}</span>}</td>
                      <td className={`${td} text-slate-500`}>{Object.entries(c.docs).map(([k, n]) => `${n} ${k}`).join(', ') || '—'}</td>
                      <td className={`${td} font-tabular`}>{c.transactions}</td>
                      <td className={td}><span className="inline-flex gap-1"><Tone value={risk} /><Tone value={rec} /><span className="text-xs text-slate-500 self-center">{tier}</span></span></td>
                      <td className={`${td} font-tabular`}>{fmtMoney(c.income)}</td>
                      <td className={`${td} text-slate-500`}>{c.payslip ?? '—'}</td>
                      <td className={`${td} text-slate-500`}>{c.decision_made || '—'}</td>
                      <td className={`${td} text-slate-500`}>{c.outcome}</td>
                      <td className={td}>{c.labelled ? <span className="text-xs font-medium text-green-700">labelled</span> : <span className="text-xs text-slate-400">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
