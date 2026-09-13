'use client';

import { useEffect, useState } from 'react';
import type { TrainingBacktest, TrainingBacktestRow } from '@/types/training';
import { fmtMoney, rpc } from './lib';
import { BucketTable, Empty, Section, Tone, secondaryBtn, td, th } from './ui';
import type { TabProps } from './TrainingConsole';

function Misses({ title, rows, hint }: { title: string; rows: TrainingBacktestRow[]; hint: string }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 mb-2">{hint}</p>
      {rows.length === 0 ? <Empty>None.</Empty> : (
        <table className="min-w-full"><thead><tr className="border-b border-slate-200"><th className={th}>Case</th><th className={th}>Tier</th><th className={th}>Outcome</th><th className={th}>Days late</th><th className={th}>Amount</th><th className={th}>Triggers</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id} className="border-b border-slate-100 last:border-0"><td className={`${td} font-mono`}>{r.id}</td><td className={td}><Tone value={r.tier} /></td><td className={td}>{r.outcome}</td><td className={`${td} font-tabular`}>{r.max_days_late ?? '—'}</td><td className={`${td} font-tabular`}>{fmtMoney(r.loan_amount)}</td><td className={`${td} text-xs text-slate-500`}>{r.triggers.join(', ') || '—'}</td></tr>)}</tbody></table>
      )}
    </div>
  );
}

export default function BacktestTab({ overview, fail }: TabProps) {
  const [data, setData] = useState<TrainingBacktest | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!overview.workerOnline) return;
    setLoading(true);
    try { setData(await rpc<TrainingBacktest>('backtest.get')); } catch (e) { fail(e instanceof Error ? e.message : 'Could not run the backtest'); } finally { setLoading(false); }
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot data fetch on mount
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  if (!overview.workerOnline) return <Empty>Worker offline — the backtest runs on the assessment machine.</Empty>;

  return (
    <div className="space-y-5">
      <Section
        title="Backtest — rules engine vs what actually happened"
        hint="Bad rate (arrears, default, written off) by engine tier and recommendation over funded loans with a known outcome. This is the evidence for moving thresholds in scoring.js — the decision logic itself is not changed from here."
        actions={<button type="button" onClick={load} disabled={loading} className={secondaryBtn}>{loading ? 'Computing…' : 'Recompute'}</button>}
      >
        {!data ? <Empty>{loading ? 'Computing…' : 'No data yet.'}</Empty> : (
          <>
            <dl className="grid gap-x-8 gap-y-1 sm:grid-cols-3 text-sm mb-5">
              <div className="flex justify-between"><dt className="text-slate-500">Cases</dt><dd className="font-tabular">{data.total}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Funded with known outcome</dt><dd className="font-tabular">{data.with_outcome}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Base bad rate</dt><dd className="font-tabular">{data.base_bad_rate === null ? '—' : `${data.base_bad_rate}%`}</dd></div>
            </dl>
            <div className="grid gap-6 lg:grid-cols-3">
              <BucketTable title="By engine expense tier" rows={data.by_tier} />
              <BucketTable title="By engine recommendation" rows={data.by_recommendation} />
              <BucketTable title="By TerePay's actual decision" rows={data.by_terepay_decision} />
            </div>
            <div className="mt-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Triggers by bad rate</h3>
              {data.triggers.length === 0 ? <Empty>No triggers fired on loans with an outcome.</Empty> : (
                <table className="min-w-full"><thead><tr className="border-b border-slate-200"><th className={th}>Trigger</th><th className={th}>Loans</th><th className={th}>Bad</th><th className={th}>Bad rate</th></tr></thead>
                  <tbody>{[...data.triggers].sort((a, b) => b.bad_rate - a.bad_rate).map((t) => <tr key={t.trigger} className="border-b border-slate-100 last:border-0"><td className={`${td} font-mono text-xs`}>{t.trigger}</td><td className={`${td} font-tabular`}>{t.n}</td><td className={`${td} font-tabular`}>{t.bad}</td><td className={`${td} font-tabular`}>{t.bad_rate}%</td></tr>)}</tbody></table>
              )}
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <Misses title="Would approve, went bad" hint="The engine said Approve and the loan ended in arrears, default or write-off — thresholds too loose here." rows={data.would_approve_but_bad} />
              <Misses title="Would deny, repaid on time" hint="The engine said Deny and the loan repaid — thresholds too tight here." rows={data.would_deny_but_repaid} />
            </div>
            <div className="mt-6 text-xs text-slate-500">Outcomes: {Object.entries(data.outcomes).filter(([, n]) => n > 0).map(([k, n]) => `${k.replace(/_/g, ' ')} ${n}`).join(' · ') || '—'}</div>
          </>
        )}
      </Section>
    </div>
  );
}
