'use client';

import { useEffect, useState } from 'react';
import type { TrainingJob } from '@/types/training';
import { TRAINING_JOB_LABELS } from '@/types/training';
import { apiGet, apiSend, describePayload, fmtDuration, fmtTime } from './lib';
import { Empty, Section, StatusBadge, secondaryBtn, td, th } from './ui';
import type { TabProps } from './TrainingConsole';

export default function JobsTab({ overview, refresh, fail }: TabProps) {
  const [selected, setSelected] = useState<TrainingJob | null>(null);

  useEffect(() => {
    if (!selected || (selected.status !== 'running' && selected.status !== 'queued')) return;
    const id = setInterval(async () => {
      try { setSelected(await apiGet<TrainingJob>(`/api/training/jobs/${selected.id}`)); } catch { /* keep last */ }
    }, 4000);
    return () => clearInterval(id);
  }, [selected]);

  const open = async (job: TrainingJob) => {
    setSelected(job);
    try { setSelected(await apiGet<TrainingJob>(`/api/training/jobs/${job.id}`)); } catch (e) { fail(e instanceof Error ? e.message : 'Could not load job'); }
  };

  const cancel = async (job: TrainingJob) => {
    if (!window.confirm(`Cancel ${TRAINING_JOB_LABELS[job.type]} ${job.id}?`)) return;
    try {
      const updated = await apiSend<TrainingJob>(`/api/training/jobs/${job.id}`, 'DELETE');
      setSelected((cur) => (cur?.id === job.id ? updated : cur));
      await refresh();
    } catch (e) { fail(e instanceof Error ? e.message : 'Could not cancel'); }
  };

  return (
    <div className="space-y-5">
      <Section title="Background jobs" hint="Everything queued from this console, newest first. Click a row for its log and result.">
        {overview.jobs.length === 0 ? (
          <Empty>No jobs yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={th}>Job</th><th className={th}>Status</th><th className={th}>Queued</th><th className={th}>Duration</th><th className={th}>By</th><th className={th} />
                </tr>
              </thead>
              <tbody>
                {overview.jobs.map((j) => (
                  <tr key={j.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer" onClick={() => open(j)}>
                    <td className={td}>
                      <span className="font-medium">{TRAINING_JOB_LABELS[j.type]}</span>
                      <span className="block text-xs text-slate-500 truncate max-w-xs">{describePayload(j)}</span>
                    </td>
                    <td className={td}><StatusBadge status={j.status} /></td>
                    <td className={`${td} whitespace-nowrap text-slate-500`}>{fmtTime(j.createdAt)}</td>
                    <td className={`${td} font-tabular text-slate-500`}>{fmtDuration(j)}</td>
                    <td className={`${td} text-slate-500 truncate max-w-40`}>{j.createdBy}</td>
                    <td className={`${td} text-right`}>
                      {(j.status === 'queued' || j.status === 'running') && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); cancel(j); }} className="text-xs font-medium text-red-700 hover:text-red-800">Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {selected && (
        <Section
          title={`${TRAINING_JOB_LABELS[selected.type]} · ${selected.id}`}
          hint={`${describePayload(selected)} · started ${fmtTime(selected.startedAt)} · ${fmtDuration(selected)}${selected.worker ? ` · on ${selected.worker}` : ''}`}
          actions={<button type="button" onClick={() => setSelected(null)} className={secondaryBtn}>Close</button>}
        >
          <div className="mb-2"><StatusBadge status={selected.status} /></div>
          {selected.error && <p className="mb-3 text-sm text-red-700">{selected.error}</p>}
          <pre className="max-h-80 overflow-auto rounded-[10px] bg-[#0F1D2E] p-4 text-xs text-slate-200 font-mono whitespace-pre-wrap">
            {selected.log?.trim() || (selected.status === 'queued' ? 'Waiting for the worker…' : 'No log output.')}
          </pre>
          {selected.result !== undefined && selected.result !== null && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-[#1C2A3A]">Result</summary>
              <pre className="mt-2 max-h-96 overflow-auto rounded-[10px] bg-slate-50 border border-slate-200 p-4 text-xs font-mono text-[#1C2A3A]">{JSON.stringify(selected.result, null, 2)}</pre>
            </details>
          )}
        </Section>
      )}
    </div>
  );
}
